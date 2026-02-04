import Foundation
import Combine

// MARK: - Dashboard Item (combines item with request info for display)

public struct DashboardItem: Identifiable {
    public let item: RequestItem
    public let request: Request

    public var id: String { item.id }

    // Convenience accessors
    public var requesterName: String { request.requesterName }
    public var requesterMobile: String { request.requesterMobile }
    public var departmentID: String { request.departmentID }
}

// MARK: - Dashboard ViewModel

/// ViewModel for the macOS coordinator dashboard - now item-centric
public final class DashboardViewModel: ObservableObject {

    // MARK: - Published State

    @Published public var items: [DashboardItem] = []
    @Published public var filteredItems: [DashboardItem] = []
    @Published public var selectedFilter: ItemStatus?
    @Published public var showActiveOnly: Bool = true  // Active vs Complete toggle
    @Published public var selectedItem: DashboardItem?
    @Published public var searchText: String = ""

    @Published public var runners: [Runner] = []
    @Published public var departments: [Department] = []
    @Published public var requests: [Request] = []  // Keep for reference

    @Published public var isLoading: Bool = false
    @Published public var error: Error?

    // Runner shopping status tracking (red/yellow/green buttons)
    @Published public var runnerShoppingStatus: [String: RunnerShoppingStatus] = [:]

    // Statistics (item-based)
    @Published public var pendingCount: Int = 0
    @Published public var assignedCount: Int = 0
    @Published public var purchasedCount: Int = 0
    @Published public var deliveredTodayCount: Int = 0
    @Published public var totalCostToday: Double = 0

    // MARK: - Dependencies

    private let cloudKitService: CloudKitService
    private let syncEngine: CloudKitSyncEngine
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    public init(
        cloudKitService: CloudKitService = .shared,
        syncEngine: CloudKitSyncEngine? = nil
    ) {
        self.cloudKitService = cloudKitService
        self.syncEngine = syncEngine ?? CloudKitSyncEngine(cloudKitService: cloudKitService)

        setupBindings()
    }

    // MARK: - Bindings

    private func setupBindings() {
        // React to filter changes
        Publishers.CombineLatest3($selectedFilter, $searchText, $showActiveOnly)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] filter, search, activeOnly in
                self?.applyFilters(status: filter, search: search, activeOnly: activeOnly)
            }
            .store(in: &cancellables)

        // React to items changes
        $items
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.calculateStatistics()
                self?.applyFilters(
                    status: self?.selectedFilter,
                    search: self?.searchText ?? "",
                    activeOnly: self?.showActiveOnly ?? true
                )
            }
            .store(in: &cancellables)

        // Listen for sync notifications
        NotificationCenter.default
            .publisher(for: CloudKitSyncEngine.didFinishSyncNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                Task {
                    await self?.loadData()
                }
            }
            .store(in: &cancellables)

        // Listen for runner changes (from SettingsViewModel)
        NotificationCenter.default
            .publisher(for: .runnersDidChange)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.reloadRunners()
            }
            .store(in: &cancellables)
    }

    /// Reloads just the runners from SharedFileStore (called when runners change in settings)
    private func reloadRunners() {
        let savedRunners = SharedFileStore.shared.loadAllRunners()
        if !savedRunners.isEmpty {
            runners = savedRunners.map { stored in
                Runner(
                    id: stored.id,
                    name: stored.name,
                    phoneNumber: stored.phoneNumber,
                    city: stored.city
                )
            }
        }
    }

    // MARK: - Data Loading

    @MainActor
    public func loadData() async {
        isLoading = true
        error = nil

        do {
            // Load all data in parallel
            async let requestsTask = cloudKitService.fetchAllRequests()
            async let runnersTask = cloudKitService.fetchAllRunners()
            async let departmentsTask = cloudKitService.fetchAllDepartments()

            requests = try await requestsTask
            runners = try await runnersTask
            departments = try await departmentsTask

            // Now fetch all items and combine with their requests
            var allItems: [DashboardItem] = []
            for request in requests {
                let requestItems = try await cloudKitService.fetchItems(forRequestID: request.id)
                for item in requestItems {
                    allItems.append(DashboardItem(item: item, request: request))
                }
            }

            items = allItems

        } catch {
            self.error = error
            print("Failed to load dashboard data: \(error)")

            // Load mock data when CloudKit isn't available
            loadMockData()
        }

        isLoading = false
    }

    private func loadMockData() {
        // Load from shared file storage (iOS/macOS submissions)
        let sharedRequests = SharedFileStore.shared.loadAllRequests()

        // Provide default departments
        departments = Department.defaults

        // Load saved runners from SharedFileStore, or use defaults if none saved
        let savedRunners = SharedFileStore.shared.loadAllRunners()
        if savedRunners.isEmpty {
            // First time - use default mock runners and save them
            let defaultRunners = [
                Runner(id: "mock-runner-mike-wilson", name: "Mike Wilson", phoneNumber: "(555) 111-2222", city: "Los Angeles"),
                Runner(id: "mock-runner-sarah-lee", name: "Sarah Lee", phoneNumber: "(555) 333-4444", city: "New York"),
                Runner(id: "mock-runner-john-runner", name: "John Runner", phoneNumber: "(555) 555-6666", city: "Chicago")
            ]
            runners = defaultRunners

            // Save defaults so they persist
            for runner in defaultRunners {
                SharedFileStore.shared.saveRunner(SharedFileStore.StoredRunner(
                    id: runner.id,
                    name: runner.name,
                    phoneNumber: runner.phoneNumber,
                    city: runner.city
                ))
            }
        } else {
            // Load from saved runners
            runners = savedRunners.map { stored in
                Runner(
                    id: stored.id,
                    name: stored.name,
                    phoneNumber: stored.phoneNumber,
                    city: stored.city
                )
            }
        }

        // Load data from shared store (may be empty - that's OK)
        if !sharedRequests.isEmpty {
            loadFromSharedStore(sharedRequests)
        } else {
            // No data - start with empty lists
            requests = []
            items = []
        }
    }

    /// Loads data from shared file storage (iOS submissions)
    private func loadFromSharedStore(_ sharedRequests: [SharedFileStore.StoredRequest]) {
        var loadedRequests: [Request] = []
        var loadedItems: [DashboardItem] = []

        for storedRequest in sharedRequests {
            // Convert stored request to Request model
            let request = Request(
                id: storedRequest.id,
                requesterName: storedRequest.requesterName,
                requesterMobile: storedRequest.requesterMobile,
                departmentID: storedRequest.departmentID,
                status: .pending,
                hasASAPItems: storedRequest.hasASAPItems,
                itemCount: storedRequest.items.count,
                createdAt: storedRequest.createdAt
            )
            loadedRequests.append(request)

            // Convert stored items to RequestItem models
            for storedItem in storedRequest.items {
                let itemStatus: ItemStatus = {
                    switch storedItem.status {
                    case "assigned": return .assigned
                    case "purchased": return .purchased
                    case "delivered": return .delivered
                    default: return .pending
                    }
                }()

                var linkURL: URL? = nil
                if let linkString = storedItem.itemLink, !linkString.isEmpty {
                    if !linkString.contains("://") {
                        linkURL = URL(string: "https://\(linkString)")
                    } else {
                        linkURL = URL(string: linkString)
                    }
                }

                let requestItem = RequestItem(
                    id: storedItem.id,
                    requestID: request.id,
                    itemName: storedItem.itemName,
                    itemDescription: storedItem.itemDescription,
                    itemLink: linkURL,
                    storeName: storedItem.storeName,
                    imageData: storedItem.imageData,
                    isASAP: storedItem.isASAP,
                    status: itemStatus,
                    assignedRunnerID: storedItem.assignedRunnerID,
                    actualCost: storedItem.actualCost,
                    sortOrder: storedItem.sortOrder
                )

                loadedItems.append(DashboardItem(item: requestItem, request: request))
            }
        }

        requests = loadedRequests
        items = loadedItems
        print("Loaded \(loadedRequests.count) requests with \(loadedItems.count) items from SharedFileStore")
    }

    public func refresh() async {
        await syncEngine.refresh()
        await loadData()
    }

    // MARK: - Filtering

    public func selectFilter(_ status: ItemStatus?) {
        selectedFilter = status
    }

    public func setActiveOnly(_ activeOnly: Bool) {
        showActiveOnly = activeOnly
    }

    public func clearFilters() {
        selectedFilter = nil
        searchText = ""
    }

    private func applyFilters(status: ItemStatus?, search: String, activeOnly: Bool) {
        var filtered = items

        // Apply active/complete filter
        if activeOnly {
            filtered = filtered.filter { $0.item.status != .delivered }
        } else {
            filtered = filtered.filter { $0.item.status == .delivered }
        }

        // Apply status filter
        if let status {
            filtered = filtered.filter { $0.item.status == status }
        }

        // Apply search filter
        if !search.isEmpty {
            let lowercaseSearch = search.lowercased()
            filtered = filtered.filter { dashboardItem in
                dashboardItem.item.itemName.lowercased().contains(lowercaseSearch) ||
                dashboardItem.requesterName.lowercased().contains(lowercaseSearch) ||
                (dashboardItem.item.storeName?.lowercased().contains(lowercaseSearch) ?? false)
            }
        }

        filteredItems = filtered
    }

    // MARK: - Statistics

    private func calculateStatistics() {
        // Count items by status (only non-delivered for active counts)
        pendingCount = items.filter { $0.item.status == .pending }.count
        assignedCount = items.filter { $0.item.status == .assigned }.count
        purchasedCount = items.filter { $0.item.status == .purchased }.count

        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())

        let deliveredToday = items.filter { dashboardItem in
            guard dashboardItem.item.status == .delivered,
                  let deliveredAt = dashboardItem.item.deliveredAt else { return false }
            return calendar.isDate(deliveredAt, inSameDayAs: today)
        }

        deliveredTodayCount = deliveredToday.count
        totalCostToday = deliveredToday.compactMap { $0.item.actualCost }.reduce(0, +)
    }

    // MARK: - Item Actions

    public func selectItem(_ item: DashboardItem) {
        selectedItem = item
    }

    @MainActor
    public func assignRunner(_ runnerID: String, to itemID: String) async throws {
        guard let index = items.firstIndex(where: { $0.item.id == itemID }) else {
            throw CloudKitError.recordNotFound
        }

        let request = items[index].request  // Capture request before modifying items
        var updatedItem = items[index].item
        updatedItem.status = .assigned
        updatedItem.assignedRunnerID = runnerID
        updatedItem.assignedAt = Date()
        updatedItem.modifiedAt = Date()

        // Update local state immediately (optimistic update)
        items[index] = DashboardItem(item: updatedItem, request: request)

        // Update shared file storage
        let runnerName = runners.first { $0.id == runnerID }?.name
        SharedFileStore.shared.updateItemStatus(
            requestID: request.id,
            itemID: itemID,
            status: "assigned",
            assignedRunnerID: runnerID,
            assignedRunnerName: runnerName
        )

        // Try to persist to CloudKit (may fail in demo mode, which is OK)
        do {
            let savedItem = try await cloudKitService.saveItem(updatedItem)
            // Update with server response if successful
            if let currentIndex = items.firstIndex(where: { $0.item.id == itemID }) {
                items[currentIndex] = DashboardItem(item: savedItem, request: request)
            }
        } catch {
            // In demo mode, CloudKit will fail - that's OK, local state is already updated
            print("CloudKit save failed (demo mode?): \(error)")
        }
    }

    @MainActor
    public func markPurchased(_ itemID: String, cost: Double?) async throws {
        guard let index = items.firstIndex(where: { $0.item.id == itemID }) else {
            throw CloudKitError.recordNotFound
        }

        let request = items[index].request  // Capture request before modifying items
        var updatedItem = items[index].item
        updatedItem.status = .purchased
        updatedItem.isPurchased = true
        updatedItem.purchasedAt = Date()
        updatedItem.actualCost = cost
        updatedItem.modifiedAt = Date()

        // Update local state immediately (optimistic update)
        items[index] = DashboardItem(item: updatedItem, request: request)

        // Update shared file storage
        SharedFileStore.shared.updateItemStatus(
            requestID: request.id,
            itemID: itemID,
            status: "purchased",
            actualCost: cost
        )

        // Check if all items for this runner are now purchased/delivered
        // If so, mark runner as available (green) - they're back from shopping
        if let runnerID = updatedItem.assignedRunnerID {
            checkAndUpdateRunnerStatus(runnerID: runnerID)
        }

        // Try to persist to CloudKit (may fail in demo mode, which is OK)
        do {
            let savedItem = try await cloudKitService.saveItem(updatedItem)
            if let currentIndex = items.firstIndex(where: { $0.item.id == itemID }) {
                items[currentIndex] = DashboardItem(item: savedItem, request: request)
            }
        } catch {
            print("CloudKit save failed (demo mode?): \(error)")
        }
    }

    /// Checks if a runner has any remaining assigned items. If not, marks them as available.
    private func checkAndUpdateRunnerStatus(runnerID: String) {
        // Get all items still assigned to this runner (status = .assigned, not yet purchased/delivered)
        let remainingAssignedItems = items.filter { item in
            item.item.assignedRunnerID == runnerID && item.item.status == .assigned
        }

        // If no more assigned items, runner is done shopping - mark as available (green)
        if remainingAssignedItems.isEmpty {
            markRunnerAvailable(runnerID: runnerID)
        }
    }

    @MainActor
    public func markDelivered(_ itemID: String) async throws {
        guard let index = items.firstIndex(where: { $0.item.id == itemID }) else {
            throw CloudKitError.recordNotFound
        }

        let request = items[index].request  // Capture request before modifying items
        var updatedItem = items[index].item
        updatedItem.status = .delivered
        updatedItem.deliveredAt = Date()
        updatedItem.modifiedAt = Date()

        // Update local state immediately (optimistic update)
        items[index] = DashboardItem(item: updatedItem, request: request)

        // Update shared file storage
        SharedFileStore.shared.updateItemStatus(
            requestID: request.id,
            itemID: itemID,
            status: "delivered"
        )

        // Try to persist to CloudKit (may fail in demo mode, which is OK)
        do {
            let savedItem = try await cloudKitService.saveItem(updatedItem)
            if let currentIndex = items.firstIndex(where: { $0.item.id == itemID }) {
                items[currentIndex] = DashboardItem(item: savedItem, request: request)
            }
        } catch {
            print("CloudKit save failed (demo mode?): \(error)")
        }
    }

    @MainActor
    public func undoItemStatus(_ itemID: String) async throws {
        guard let index = items.firstIndex(where: { $0.item.id == itemID }),
              let previousStatus = items[index].item.status.previousStatus else {
            throw CloudKitError.recordNotFound
        }

        let request = items[index].request  // Capture request before modifying items
        var updatedItem = items[index].item
        updatedItem.status = previousStatus
        updatedItem.modifiedAt = Date()

        // Clear status-specific fields when going back
        switch previousStatus {
        case .pending:
            updatedItem.assignedRunnerID = nil
            updatedItem.assignedAt = nil
        case .assigned:
            updatedItem.isPurchased = false
            updatedItem.purchasedAt = nil
            updatedItem.actualCost = nil
        case .purchased:
            updatedItem.deliveredAt = nil
        case .delivered:
            break
        }

        // Update local state immediately (optimistic update)
        items[index] = DashboardItem(item: updatedItem, request: request)

        // Try to persist to CloudKit (may fail in demo mode, which is OK)
        do {
            let savedItem = try await cloudKitService.saveItem(updatedItem)
            if let currentIndex = items.firstIndex(where: { $0.item.id == itemID }) {
                items[currentIndex] = DashboardItem(item: savedItem, request: request)
            }
        } catch {
            print("CloudKit save failed (demo mode?): \(error)")
        }
    }

    @MainActor
    public func deleteItem(_ itemID: String) async throws {
        guard let index = items.firstIndex(where: { $0.item.id == itemID }) else {
            return // Item not found, nothing to delete
        }

        let item = items[index].item
        let request = items[index].request

        // Remove locally immediately (optimistic update)
        items.remove(at: index)

        // Remove from shared file storage
        SharedFileStore.shared.removeItem(requestID: request.id, itemID: itemID)

        // Try to delete from CloudKit (may fail in demo mode, which is OK)
        do {
            try await cloudKitService.deleteItem(item)
        } catch {
            print("CloudKit delete failed (demo mode?): \(error)")
        }
    }

    // MARK: - Helpers

    public func department(for item: DashboardItem) -> Department? {
        departments.first { $0.id == item.departmentID }
    }

    public func runner(for item: DashboardItem) -> Runner? {
        guard let runnerID = item.item.assignedRunnerID else { return nil }
        return runners.first { $0.id == runnerID }
    }

    public func runner(byID runnerID: String) -> Runner? {
        runners.first { $0.id == runnerID }
    }

    // MARK: - Runner Lists

    /// Returns runners who have items assigned to them (status = assigned, not yet purchased/delivered)
    public var runnersWithAssignedItems: [(runner: Runner, items: [DashboardItem])] {
        // Get all items that are assigned but not yet delivered
        let assignedItems = items.filter { item in
            item.item.status == .assigned && item.item.assignedRunnerID != nil
        }

        // Group by runner
        var runnerItemsMap: [String: [DashboardItem]] = [:]
        for item in assignedItems {
            if let runnerID = item.item.assignedRunnerID {
                runnerItemsMap[runnerID, default: []].append(item)
            }
        }

        // Convert to array of tuples with runner objects
        var result: [(runner: Runner, items: [DashboardItem])] = []
        for (runnerID, runnerItems) in runnerItemsMap {
            if let runner = runners.first(where: { $0.id == runnerID }) {
                result.append((runner: runner, items: runnerItems))
            }
        }

        // Sort by runner name
        return result.sorted { $0.runner.name < $1.runner.name }
    }

    /// Returns items assigned to a specific runner
    public func items(forRunnerID runnerID: String) -> [DashboardItem] {
        items.filter { $0.item.assignedRunnerID == runnerID && $0.item.status == .assigned }
    }

    // MARK: - Runner Shopping Status

    /// Gets the shopping status for a runner
    public func shoppingStatus(for runnerID: String) -> RunnerShoppingStatus {
        // If we have a manually set status (e.g., shopping after PDF sent), use that
        if let status = runnerShoppingStatus[runnerID] {
            return status
        }

        // Otherwise, calculate based on assigned items
        let assignedItems = items(forRunnerID: runnerID)
        if assignedItems.isEmpty {
            return .available  // Green - no items assigned
        } else {
            return .listReady  // Red - has items, list not sent yet
        }
    }

    /// Sets a runner's shopping status (e.g., when PDF is sent)
    public func setShoppingStatus(_ status: RunnerShoppingStatus, for runnerID: String) {
        runnerShoppingStatus[runnerID] = status
    }

    /// Called when a runner's list PDF is sent - changes status to shopping (yellow)
    public func markRunnerListSent(runnerID: String) {
        runnerShoppingStatus[runnerID] = .shopping
    }

    /// Called when a runner returns (all items delivered) - changes status to available (green)
    public func markRunnerAvailable(runnerID: String) {
        runnerShoppingStatus[runnerID] = .available
    }

    /// Returns all runners with their current shopping status for display
    public var allRunnersWithStatus: [(runner: Runner, status: RunnerShoppingStatus, itemCount: Int)] {
        runners.map { runner in
            let status = shoppingStatus(for: runner.id)
            let itemCount = items(forRunnerID: runner.id).count
            return (runner: runner, status: status, itemCount: itemCount)
        }.sorted { $0.runner.name < $1.runner.name }
    }
}

// MARK: - Shared File Store

/// Stores requests in a shared location accessible by both iOS and macOS apps.
/// Uses App Group UserDefaults when available, falls back to standard UserDefaults.
public final class SharedFileStore {

    // MARK: - Singleton

    public static let shared = SharedFileStore()

    // MARK: - App Group

    /// The App Group identifier - must match the entitlements in both iOS and macOS targets
    private let appGroupIdentifier = "group.com.runnerlist.shared"

    // MARK: - Storage Keys

    private let pendingRequestsKey = "sharedPendingRequests"

    // MARK: - Stored Request Model

    public struct StoredRequest: Codable, Identifiable, Sendable {
        public let id: String
        public let requesterName: String
        public let requesterMobile: String
        public let departmentID: String
        public let departmentName: String
        public let hasASAPItems: Bool
        public let items: [StoredItem]
        public let createdAt: Date

        public init(
            id: String = UUID().uuidString,
            requesterName: String,
            requesterMobile: String,
            departmentID: String,
            departmentName: String,
            hasASAPItems: Bool,
            items: [StoredItem],
            createdAt: Date = Date()
        ) {
            self.id = id
            self.requesterName = requesterName
            self.requesterMobile = requesterMobile
            self.departmentID = departmentID
            self.departmentName = departmentName
            self.hasASAPItems = hasASAPItems
            self.items = items
            self.createdAt = createdAt
        }
    }

    public struct StoredItem: Codable, Identifiable, Sendable {
        public let id: String
        public let itemName: String
        public let itemDescription: String?
        public let itemLink: String?
        public let storeName: String?
        public let isASAP: Bool
        public let sortOrder: Int
        public var imageData: Data?

        // Status tracking
        public var status: String  // "pending", "assigned", "purchased", "delivered"
        public var assignedRunnerID: String?
        public var assignedRunnerName: String?
        public var actualCost: Double?

        public init(
            id: String = UUID().uuidString,
            itemName: String,
            itemDescription: String?,
            itemLink: String?,
            storeName: String?,
            isASAP: Bool,
            sortOrder: Int,
            imageData: Data? = nil,
            status: String = "pending",
            assignedRunnerID: String? = nil,
            assignedRunnerName: String? = nil,
            actualCost: Double? = nil
        ) {
            self.id = id
            self.itemName = itemName
            self.itemDescription = itemDescription
            self.itemLink = itemLink
            self.storeName = storeName
            self.isASAP = isASAP
            self.sortOrder = sortOrder
            self.imageData = imageData
            self.status = status
            self.assignedRunnerID = assignedRunnerID
            self.assignedRunnerName = assignedRunnerName
            self.actualCost = actualCost
        }
    }

    // MARK: - Initialization

    private init() {
        if let fileURL = sharedFileURL {
            print("SharedFileStore: Using file-based storage at \(fileURL.path)")
        } else {
            print("SharedFileStore: ERROR - No storage location available!")
        }
    }

    // MARK: - Shared File URL

    /// Returns a shared file location that both iOS simulator and macOS apps can access
    private var sharedFileURL: URL? {
        // For development: iOS simulator and macOS have SEPARATE App Group containers,
        // so we use /tmp which is accessible to both on the same machine
        #if targetEnvironment(simulator) || os(macOS)
        let sharedDir = URL(fileURLWithPath: "/tmp/runnerlist_shared")

        do {
            try FileManager.default.createDirectory(at: sharedDir, withIntermediateDirectories: true)
        } catch {
            print("SharedFileStore: Failed to create shared directory: \(error)")
        }

        return sharedDir.appendingPathComponent("shared_requests.json")
        #else
        // On real iOS device: Use App Group container for sharing with watchOS, widgets, etc.
        if let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) {
            return containerURL.appendingPathComponent("shared_requests.json")
        }

        // Fallback: Use Documents directory (won't sync, but at least persists locally)
        if let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
            return docs.appendingPathComponent("shared_requests.json")
        }
        return nil
        #endif
    }

    // MARK: - Save Request

    public func saveRequest(_ request: StoredRequest) {
        var pending = loadAllRequests()

        if let existingIndex = pending.firstIndex(where: { $0.id == request.id }) {
            pending[existingIndex] = request
        } else {
            pending.append(request)
        }

        saveAllRequests(pending)
        print("SharedFileStore: Request saved. Total requests: \(pending.count)")
    }

    // MARK: - Load Requests

    public func loadAllRequests() -> [StoredRequest] {
        // Use file-based storage
        guard let fileURL = sharedFileURL else {
            print("SharedFileStore: No shared file URL available")
            return []
        }

        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            print("SharedFileStore: No data file exists yet at \(fileURL.path)")
            return []
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let requests = try JSONDecoder().decode([StoredRequest].self, from: data)
            print("SharedFileStore: Loaded \(requests.count) requests from \(fileURL.path)")
            return requests
        } catch {
            print("SharedFileStore: Failed to load/decode requests: \(error)")
            return []
        }
    }

    public var requestCount: Int {
        loadAllRequests().count
    }

    // MARK: - Update Item Status

    public func updateItemStatus(
        requestID: String,
        itemID: String,
        status: String,
        assignedRunnerID: String? = nil,
        assignedRunnerName: String? = nil,
        actualCost: Double? = nil
    ) {
        var requests = loadAllRequests()

        guard let requestIndex = requests.firstIndex(where: { $0.id == requestID }) else {
            return
        }

        var request = requests[requestIndex]
        var items = request.items

        guard let itemIndex = items.firstIndex(where: { $0.id == itemID }) else {
            return
        }

        var item = items[itemIndex]
        item = StoredItem(
            id: item.id,
            itemName: item.itemName,
            itemDescription: item.itemDescription,
            itemLink: item.itemLink,
            storeName: item.storeName,
            isASAP: item.isASAP,
            sortOrder: item.sortOrder,
            imageData: item.imageData,
            status: status,
            assignedRunnerID: assignedRunnerID ?? item.assignedRunnerID,
            assignedRunnerName: assignedRunnerName ?? item.assignedRunnerName,
            actualCost: actualCost ?? item.actualCost
        )

        items[itemIndex] = item

        let updatedRequest = StoredRequest(
            id: request.id,
            requesterName: request.requesterName,
            requesterMobile: request.requesterMobile,
            departmentID: request.departmentID,
            departmentName: request.departmentName,
            hasASAPItems: request.hasASAPItems,
            items: items,
            createdAt: request.createdAt
        )

        requests[requestIndex] = updatedRequest
        saveAllRequests(requests)
    }

    // MARK: - Delete Operations

    public func removeRequest(withID id: String) {
        var pending = loadAllRequests()
        pending.removeAll { $0.id == id }
        saveAllRequests(pending)
    }

    public func removeItem(requestID: String, itemID: String) {
        var requests = loadAllRequests()

        guard let requestIndex = requests.firstIndex(where: { $0.id == requestID }) else {
            return
        }

        var request = requests[requestIndex]
        var items = request.items
        items.removeAll { $0.id == itemID }

        if items.isEmpty {
            requests.remove(at: requestIndex)
        } else {
            let updatedRequest = StoredRequest(
                id: request.id,
                requesterName: request.requesterName,
                requesterMobile: request.requesterMobile,
                departmentID: request.departmentID,
                departmentName: request.departmentName,
                hasASAPItems: items.contains { $0.isASAP },
                items: items,
                createdAt: request.createdAt
            )
            requests[requestIndex] = updatedRequest
        }

        saveAllRequests(requests)
    }

    public func clearAllRequests() {
        guard let fileURL = sharedFileURL else {
            return
        }

        do {
            if FileManager.default.fileExists(atPath: fileURL.path) {
                try FileManager.default.removeItem(at: fileURL)
                print("SharedFileStore: Cleared all requests")
            }
        } catch {
            print("SharedFileStore: Failed to clear requests: \(error)")
        }
    }

    // MARK: - Private Helpers

    private func saveAllRequests(_ requests: [StoredRequest]) {
        guard let fileURL = sharedFileURL else {
            print("SharedFileStore: No shared file URL available for saving")
            return
        }

        do {
            let data = try JSONEncoder().encode(requests)
            try data.write(to: fileURL, options: .atomic)
            print("SharedFileStore: Saved \(requests.count) requests to \(fileURL.path)")
        } catch {
            print("SharedFileStore: Failed to save requests: \(error)")
        }
    }

    // MARK: - Runner Storage

    /// File URL for storing runners
    private var runnersFileURL: URL? {
        guard let baseURL = sharedFileURL?.deletingLastPathComponent() else { return nil }
        return baseURL.appendingPathComponent("shared_runners.json")
    }

    /// Stored runner model for persistence
    public struct StoredRunner: Codable, Identifiable, Sendable {
        public let id: String
        public let name: String
        public let phoneNumber: String
        public let city: String?

        public init(id: String, name: String, phoneNumber: String, city: String?) {
            self.id = id
            self.name = name
            self.phoneNumber = phoneNumber
            self.city = city
        }
    }

    /// Save a runner to persistent storage
    public func saveRunner(_ runner: StoredRunner) {
        var runners = loadAllRunners()

        if let existingIndex = runners.firstIndex(where: { $0.id == runner.id }) {
            runners[existingIndex] = runner
        } else {
            runners.append(runner)
        }

        saveAllRunners(runners)
        print("SharedFileStore: Runner saved. Total runners: \(runners.count)")
    }

    /// Load all saved runners
    public func loadAllRunners() -> [StoredRunner] {
        guard let fileURL = runnersFileURL else {
            print("SharedFileStore: No runners file URL available")
            return []
        }

        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            print("SharedFileStore: No runners file exists yet")
            return []
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let runners = try JSONDecoder().decode([StoredRunner].self, from: data)
            print("SharedFileStore: Loaded \(runners.count) runners")
            return runners
        } catch {
            print("SharedFileStore: Failed to load runners: \(error)")
            return []
        }
    }

    /// Remove a runner from storage
    public func removeRunner(withID id: String) {
        var runners = loadAllRunners()
        runners.removeAll { $0.id == id }
        saveAllRunners(runners)
    }

    private func saveAllRunners(_ runners: [StoredRunner]) {
        guard let fileURL = runnersFileURL else {
            print("SharedFileStore: No runners file URL available for saving")
            return
        }

        do {
            let data = try JSONEncoder().encode(runners)
            try data.write(to: fileURL, options: .atomic)
            print("SharedFileStore: Saved \(runners.count) runners to \(fileURL.path)")
        } catch {
            print("SharedFileStore: Failed to save runners: \(error)")
        }
    }
}
