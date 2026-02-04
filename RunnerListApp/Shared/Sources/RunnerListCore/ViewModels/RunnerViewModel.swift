import Foundation
import Combine

// MARK: - Runner ViewModel

/// ViewModel for the iOS runner app
public final class RunnerViewModel: ObservableObject {

    // MARK: - Published State

    @Published public var currentRunner: Runner?
    @Published public var assignedItems: [RequestItem] = []
    @Published public var assignedRequests: [Request] = []

    @Published public var allRunners: [Runner] = []
    @Published public var departments: [Department] = []

    @Published public var isLoading: Bool = false
    @Published public var error: Error?

    // MARK: - User Defaults Keys

    private let selectedRunnerIDKey = "selectedRunnerID"

    // MARK: - Dependencies

    private let cloudKitService: CloudKitService
    private let syncEngine: CloudKitSyncEngine
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Computed Properties

    public var hasSelectedRunner: Bool {
        currentRunner != nil
    }

    public var activeItemsCount: Int {
        assignedItems.filter { !$0.isPurchased }.count
    }

    public var purchasedItemsCount: Int {
        assignedItems.filter { $0.isPurchased }.count
    }

    // MARK: - Initialization

    public init(
        cloudKitService: CloudKitService = .shared,
        syncEngine: CloudKitSyncEngine? = nil
    ) {
        self.cloudKitService = cloudKitService
        self.syncEngine = syncEngine ?? CloudKitSyncEngine(cloudKitService: cloudKitService)

        setupBindings()
        loadSavedRunner()
    }

    // MARK: - Bindings

    private func setupBindings() {
        // Listen for sync notifications
        NotificationCenter.default
            .publisher(for: CloudKitSyncEngine.didFinishSyncNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                Task {
                    await self?.loadAssignedItems()
                }
            }
            .store(in: &cancellables)
    }

    // MARK: - Runner Selection

    private func loadSavedRunner() {
        guard let savedID = UserDefaults.standard.string(forKey: selectedRunnerIDKey) else {
            return
        }

        // Will be populated after loadAllRunners is called
        Task {
            await loadAllRunners()
            currentRunner = allRunners.first { $0.id == savedID }
            if currentRunner != nil {
                await loadAssignedItems()
            }
        }
    }

    public func selectRunner(_ runner: Runner) {
        currentRunner = runner
        UserDefaults.standard.set(runner.id, forKey: selectedRunnerIDKey)

        Task {
            await loadAssignedItems()
        }
    }

    public func clearRunnerSelection() {
        currentRunner = nil
        assignedItems = []
        assignedRequests = []
        UserDefaults.standard.removeObject(forKey: selectedRunnerIDKey)
    }

    // MARK: - Data Loading

    public func loadAllRunners() async {
        isLoading = true
        error = nil

        do {
            allRunners = try await cloudKitService.fetchAllRunners()
            departments = try await cloudKitService.fetchAllDepartments()

            // If we had a saved runner ID, find it
            if let savedID = UserDefaults.standard.string(forKey: selectedRunnerIDKey),
               currentRunner == nil {
                currentRunner = allRunners.first { $0.id == savedID }
            }
        } catch {
            self.error = error
            print("Failed to load runners: \(error)")
        }

        isLoading = false
    }

    public func loadAssignedItems() async {
        guard let runner = currentRunner else { return }

        isLoading = true
        error = nil

        do {
            // Fetch requests assigned to this runner
            let requests = try await cloudKitService.fetchRequests(forRunnerID: runner.id)

            // Filter to only show active requests (not completed)
            assignedRequests = requests.filter { $0.status != .completed }

            // Fetch items for each request
            var allItems: [RequestItem] = []
            for request in assignedRequests {
                let items = try await cloudKitService.fetchItems(forRequestID: request.id)
                allItems.append(contentsOf: items)
            }

            assignedItems = allItems

        } catch {
            self.error = error
            print("Failed to load assigned items: \(error)")
        }

        isLoading = false
    }

    public func refresh() async {
        await syncEngine.refresh()
        await loadAssignedItems()
    }

    // MARK: - Actions

    public func markItemPurchased(_ item: RequestItem, cost: Double) async throws {
        var updatedItem = item
        updatedItem.isPurchased = true
        updatedItem.purchasedAt = Date()
        updatedItem.actualCost = cost
        updatedItem.modifiedAt = Date()

        let savedItem = try await cloudKitService.saveItem(updatedItem)

        // Update local state
        if let index = assignedItems.firstIndex(where: { $0.id == item.id }) {
            assignedItems[index] = savedItem
        }

        // Update the parent request's total cost
        await updateRequestTotalCost(for: item.requestID)
    }

    private func updateRequestTotalCost(for requestID: String) async {
        guard var request = assignedRequests.first(where: { $0.id == requestID }) else {
            return
        }

        // Calculate total cost from items
        let items = assignedItems.filter { $0.requestID == requestID }
        let totalCost = items.compactMap(\.actualCost).reduce(0, +)

        request.totalCost = totalCost
        request.modifiedAt = Date()

        // Check if all items are purchased
        let allPurchased = items.allSatisfy { $0.isPurchased }
        if allPurchased {
            request.status = .purchased
        }

        do {
            let savedRequest = try await cloudKitService.saveRequest(request)
            if let index = assignedRequests.firstIndex(where: { $0.id == requestID }) {
                assignedRequests[index] = savedRequest
            }
        } catch {
            print("Failed to update request total cost: \(error)")
        }
    }

    // MARK: - Helpers

    public func request(for item: RequestItem) -> Request? {
        assignedRequests.first { $0.id == item.requestID }
    }

    public func items(for request: Request) -> [RequestItem] {
        assignedItems.filter { $0.requestID == request.id }
    }

    public func department(for request: Request) -> Department? {
        departments.first { $0.id == request.departmentID }
    }
}
