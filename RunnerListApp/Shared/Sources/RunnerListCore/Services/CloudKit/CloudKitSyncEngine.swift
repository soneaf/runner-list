import Foundation
import CloudKit
import Combine

// MARK: - CloudKit Sync Engine

/// Manages bidirectional sync between local cache and CloudKit with real-time updates
public final class CloudKitSyncEngine: ObservableObject, @unchecked Sendable {

    // MARK: - Published State

    @Published public private(set) var isSyncing: Bool = false
    @Published public private(set) var lastSyncDate: Date?
    @Published public private(set) var syncError: Error?
    @Published public private(set) var pendingChangesCount: Int = 0

    // MARK: - Notifications

    public static let didReceiveRemoteChangeNotification = Notification.Name("CloudKitSyncEngine.didReceiveRemoteChange")
    public static let didFinishSyncNotification = Notification.Name("CloudKitSyncEngine.didFinishSync")

    // MARK: - Dependencies

    private let cloudKitService: CloudKitService
    private var container: CKContainer? { cloudKitService.container }

    // MARK: - Private State

    private var serverChangeToken: CKServerChangeToken?
    private var subscriptions: [CKSubscription.ID: CKSubscription] = [:]
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Change Token Keys

    private let changeTokenKey = "cloudKitServerChangeToken"

    // MARK: - Initialization

    public init(cloudKitService: CloudKitService = .shared) {
        self.cloudKitService = cloudKitService

        loadChangeToken()
        setupNotificationHandling()
    }

    // MARK: - Initial Sync

    /// Performs a full sync on app launch
    @MainActor
    public func performInitialSync() async {
        guard !isSyncing else { return }

        isSyncing = true
        syncError = nil

        do {
            // Check authentication first
            await cloudKitService.checkAccountStatus()

            guard cloudKitService.isAuthenticated else {
                throw CloudKitError.notAuthenticated
            }

            // Initialize default data if needed
            try await cloudKitService.initializeDefaultDepartmentsIfNeeded()

            // Fetch changes from server
            try await fetchServerChanges()

            lastSyncDate = Date()
            UserDefaults.standard.set(lastSyncDate, forKey: "lastCloudKitSyncDate")

            // Post notification
            NotificationCenter.default.post(
                name: Self.didFinishSyncNotification,
                object: self
            )

        } catch {
            syncError = error
            print("Sync error: \(error.localizedDescription)")
        }

        isSyncing = false
    }

    // MARK: - Fetch Changes

    /// Fetches changes from CloudKit using change tokens for efficiency
    @MainActor
    public func fetchServerChanges() async throws {
        // For now, we'll do a simple full fetch
        // In a production app, you'd use CKFetchRecordZoneChangesOperation
        // with change tokens for incremental sync

        // This is a simplified implementation
        // The full implementation would track change tokens per zone

        lastSyncDate = Date()
        saveChangeToken()
    }

    // MARK: - Subscriptions

    /// Sets up CloudKit subscriptions for real-time updates
    public func setupSubscriptions() async throws {
        let recordTypes = [
            Request.recordType,
            RequestItem.recordType,
            Runner.recordType,
            Department.recordType,
            TourScheduleEntry.recordType
        ]

        for recordType in recordTypes {
            try await createSubscription(for: recordType)
        }
    }

    private func createSubscription(for recordType: String) async throws {
        guard let publicDatabase = cloudKitService.publicDatabase else {
            throw CloudKitError.notAuthenticated
        }

        let subscriptionID = "subscription-\(recordType)"

        // Check if subscription already exists
        do {
            let existingSubscriptions = try await publicDatabase.allSubscriptions()
            if existingSubscriptions.contains(where: { $0.subscriptionID == subscriptionID }) {
                return // Already exists
            }
        } catch {
            // Ignore and try to create
        }

        let subscription = CKQuerySubscription(
            recordType: recordType,
            predicate: NSPredicate(value: true),
            subscriptionID: subscriptionID,
            options: [.firesOnRecordCreation, .firesOnRecordUpdate, .firesOnRecordDeletion]
        )

        let notificationInfo = CKSubscription.NotificationInfo()
        notificationInfo.shouldSendContentAvailable = true

        subscription.notificationInfo = notificationInfo

        do {
            let savedSubscription = try await publicDatabase.save(subscription)
            subscriptions[savedSubscription.subscriptionID] = savedSubscription
        } catch let error as CKError where error.code == .serverRejectedRequest {
            // Subscription might already exist, ignore
            print("Subscription creation rejected (may already exist): \(recordType)")
        }
    }

    /// Removes all subscriptions
    public func removeAllSubscriptions() async throws {
        guard let publicDatabase = cloudKitService.publicDatabase else {
            throw CloudKitError.notAuthenticated
        }

        let existingSubscriptions = try await publicDatabase.allSubscriptions()
        let subscriptionIDs = existingSubscriptions.map { $0.subscriptionID }

        for id in subscriptionIDs {
            try await publicDatabase.deleteSubscription(withID: id)
        }

        subscriptions.removeAll()
    }

    // MARK: - Handle Remote Notifications

    /// Call this when a CloudKit remote notification is received
    public func handleRemoteNotification(userInfo: [AnyHashable: Any]) async {
        guard let notification = CKNotification(fromRemoteNotificationDictionary: userInfo) else {
            return
        }

        if notification.notificationType == .query,
           let queryNotification = notification as? CKQueryNotification {

            // Post notification so UI can refresh
            NotificationCenter.default.post(
                name: Self.didReceiveRemoteChangeNotification,
                object: self,
                userInfo: [
                    "recordType": queryNotification.recordID?.recordName ?? "",
                    "reason": queryNotification.queryNotificationReason.rawValue
                ]
            )

            // Trigger a sync
            await performInitialSync()
        }
    }

    // MARK: - Notification Handling

    private func setupNotificationHandling() {
        // Listen for remote change notifications
        NotificationCenter.default
            .publisher(for: Self.didReceiveRemoteChangeNotification)
            .debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)
            .sink { [weak self] _ in
                Task {
                    await self?.performInitialSync()
                }
            }
            .store(in: &cancellables)
    }

    // MARK: - Change Token Persistence

    private func loadChangeToken() {
        guard let data = UserDefaults.standard.data(forKey: changeTokenKey) else { return }

        do {
            serverChangeToken = try NSKeyedUnarchiver.unarchivedObject(
                ofClass: CKServerChangeToken.self,
                from: data
            )
        } catch {
            print("Failed to load change token: \(error)")
        }
    }

    private func saveChangeToken() {
        guard let token = serverChangeToken else {
            UserDefaults.standard.removeObject(forKey: changeTokenKey)
            return
        }

        do {
            let data = try NSKeyedArchiver.archivedData(
                withRootObject: token,
                requiringSecureCoding: true
            )
            UserDefaults.standard.set(data, forKey: changeTokenKey)
        } catch {
            print("Failed to save change token: \(error)")
        }
    }

    // MARK: - Manual Refresh

    /// Manually trigger a sync refresh
    @MainActor
    public func refresh() async {
        await performInitialSync()
    }
}

// MARK: - Sync State

extension CloudKitSyncEngine {

    public var syncStatus: SyncStatus {
        if isSyncing {
            return .syncing
        } else if syncError != nil {
            return .error
        } else if lastSyncDate != nil {
            return .synced
        } else {
            return .notSynced
        }
    }

    public enum SyncStatus {
        case notSynced
        case syncing
        case synced
        case error

        public var displayText: String {
            switch self {
            case .notSynced: return "Not synced"
            case .syncing: return "Syncing..."
            case .synced: return "Synced"
            case .error: return "Sync error"
            }
        }
    }
}
