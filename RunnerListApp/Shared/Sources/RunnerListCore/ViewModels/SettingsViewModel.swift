import Foundation
import Combine

// MARK: - Notifications

public extension Notification.Name {
    /// Posted when runners list changes (add/delete)
    static let runnersDidChange = Notification.Name("runnersDidChange")
}

// MARK: - Settings ViewModel

/// ViewModel for app settings and configuration
public final class SettingsViewModel: ObservableObject {

    // MARK: - Published State

    @Published public var runners: [Runner] = []
    @Published public var departments: [Department] = []
    @Published public var tourSchedule: [TourScheduleEntry] = []
    @Published public var todayEntry: TourScheduleEntry?

    @Published public var newRunnerName: String = ""
    @Published public var newRunnerPhone: String = ""
    @Published public var newRunnerCity: String = ""
    @Published public var newDepartmentName: String = ""

    @Published public var isLoading: Bool = false
    @Published public var error: Error?
    @Published public var successMessage: String?

    // MARK: - Dependencies

    private let cloudKitService: CloudKitService
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    public init(cloudKitService: CloudKitService = .shared) {
        self.cloudKitService = cloudKitService
    }

    // MARK: - Data Loading

    @MainActor
    public func loadData() async {
        isLoading = true
        error = nil

        do {
            async let runnersTask = cloudKitService.fetchAllRunners()
            async let departmentsTask = cloudKitService.fetchAllDepartments()
            async let scheduleTask = cloudKitService.fetchAllTourEntries()
            async let todayTask = cloudKitService.fetchTodaysTourEntry()

            runners = try await runnersTask
            departments = try await departmentsTask
            tourSchedule = try await scheduleTask
            todayEntry = try await todayTask

        } catch {
            self.error = error
            print("Failed to load settings: \(error)")

            // Load mock data when CloudKit isn't available
            loadMockData()
        }

        isLoading = false
    }

    private func loadMockData() {
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

        tourSchedule = []
        todayEntry = nil
    }

    // MARK: - Runner Management

    @MainActor
    public func addRunner() async {
        guard !newRunnerName.isEmpty else {
            error = SettingsError.emptyName
            return
        }

        error = nil

        let cityValue = newRunnerCity.trimmingCharacters(in: .whitespaces)
        let runner = Runner(
            name: newRunnerName.trimmingCharacters(in: .whitespaces),
            phoneNumber: newRunnerPhone.trimmingCharacters(in: .whitespaces),
            city: cityValue.isEmpty ? nil : cityValue
        )

        // Add locally immediately (optimistic update)
        runners.append(runner)

        // Clear inputs
        newRunnerName = ""
        newRunnerPhone = ""
        newRunnerCity = ""

        successMessage = "Runner added successfully"

        // Save to SharedFileStore for persistence (works in demo mode)
        SharedFileStore.shared.saveRunner(SharedFileStore.StoredRunner(
            id: runner.id,
            name: runner.name,
            phoneNumber: runner.phoneNumber,
            city: runner.city
        ))

        // Notify other view models that runners changed
        NotificationCenter.default.post(name: .runnersDidChange, object: nil)

        // Try to persist to CloudKit (may fail in demo mode, which is OK)
        do {
            _ = try await cloudKitService.saveRunner(runner)
        } catch {
            print("CloudKit save failed (demo mode?): \(error)")
        }
    }

    @MainActor
    public func deleteRunner(_ runner: Runner) async {
        error = nil

        // Remove locally immediately (optimistic update)
        runners.removeAll { $0.id == runner.id }
        successMessage = "Runner deleted"

        // Remove from SharedFileStore for persistence
        SharedFileStore.shared.removeRunner(withID: runner.id)

        // Notify other view models that runners changed
        NotificationCenter.default.post(name: .runnersDidChange, object: nil)

        // Try to delete from CloudKit (may fail in demo mode, which is OK)
        do {
            try await cloudKitService.deleteRunner(runner)
        } catch {
            print("CloudKit delete failed (demo mode?): \(error)")
        }
    }

    @MainActor
    public func updateRunner(_ runner: Runner) async {
        isLoading = true
        error = nil

        do {
            let savedRunner = try await cloudKitService.saveRunner(runner)
            if let index = runners.firstIndex(where: { $0.id == runner.id }) {
                runners[index] = savedRunner
            }
            successMessage = "Runner updated"
        } catch {
            self.error = error
        }

        isLoading = false
    }

    // MARK: - Department Management

    @MainActor
    public func addDepartment() async {
        guard !newDepartmentName.isEmpty else {
            error = SettingsError.emptyName
            return
        }

        error = nil

        let department = Department(
            name: newDepartmentName.trimmingCharacters(in: .whitespaces),
            sortOrder: departments.count
        )

        // Add locally immediately (optimistic update)
        departments.append(department)

        // Clear input
        newDepartmentName = ""

        successMessage = "Department added successfully"

        // Try to persist to CloudKit (may fail in demo mode, which is OK)
        do {
            _ = try await cloudKitService.saveDepartment(department)
        } catch {
            print("CloudKit save failed (demo mode?): \(error)")
        }
    }

    @MainActor
    public func deleteDepartment(_ department: Department) async {
        error = nil

        // Remove locally immediately (optimistic update)
        departments.removeAll { $0.id == department.id }
        successMessage = "Department deleted"

        // Try to delete from CloudKit (may fail in demo mode, which is OK)
        do {
            try await cloudKitService.deleteDepartment(department)
        } catch {
            print("CloudKit delete failed (demo mode?): \(error)")
        }
    }

    // MARK: - Tour Schedule

    @MainActor
    public func importSchedule(from csvData: [[String: String]]) async {
        isLoading = true
        error = nil

        do {
            var entries: [TourScheduleEntry] = []

            for row in csvData {
                guard let dateString = row["Date"] ?? row["date"],
                      let city = row["City"] ?? row["city"] ?? row["Location"] ?? row["location"],
                      let venue = row["Venue"] ?? row["venue"] ?? row["Place"] ?? row["place"] else {
                    continue
                }

                if let entry = TourScheduleEntry.fromCSV(
                    dateString: dateString,
                    city: city,
                    venue: venue
                ) {
                    entries.append(entry)
                }
            }

            guard !entries.isEmpty else {
                throw SettingsError.noValidEntries
            }

            let savedEntries = try await cloudKitService.saveTourEntries(entries)
            tourSchedule.append(contentsOf: savedEntries)

            // Sort by date
            tourSchedule.sort { $0.tourDate < $1.tourDate }

            // Update today's entry
            todayEntry = TourScheduleEntry.entryForToday(from: tourSchedule)

            successMessage = "\(savedEntries.count) schedule entries imported"

        } catch {
            self.error = error
        }

        isLoading = false
    }

    @MainActor
    public func clearSchedule() async {
        isLoading = true
        error = nil

        // Note: In production, you'd want to batch delete
        // For now, we'll just clear the local state
        tourSchedule.removeAll()
        todayEntry = nil
        successMessage = "Schedule cleared"

        isLoading = false
    }

    // MARK: - Message Handling

    public func clearMessages() {
        error = nil
        successMessage = nil
    }
}

// MARK: - Settings Errors

public enum SettingsError: LocalizedError {
    case emptyName
    case noValidEntries
    case invalidCSV

    public var errorDescription: String? {
        switch self {
        case .emptyName:
            return "Name cannot be empty"
        case .noValidEntries:
            return "No valid entries found in the CSV"
        case .invalidCSV:
            return "Invalid CSV format"
        }
    }
}
