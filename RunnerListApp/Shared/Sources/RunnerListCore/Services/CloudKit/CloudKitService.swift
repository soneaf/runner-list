import Foundation
import CloudKit

// MARK: - CloudKit Service

/// Main service for CloudKit operations
public final class CloudKitService: ObservableObject, @unchecked Sendable {

    // MARK: - Singleton

    public static let shared = CloudKitService()

    // MARK: - Published State

    @Published public private(set) var isAuthenticated: Bool = false
    @Published public private(set) var accountStatus: CKAccountStatus = .couldNotDetermine
    @Published public private(set) var lastError: Error?
    @Published public private(set) var isCloudKitAvailable: Bool = false

    // MARK: - Configuration

    public static let containerIdentifier = "iCloud.com.runnerlist.app"

    // MARK: - Properties

    private var _container: CKContainer?
    private var _publicDatabase: CKDatabase?
    private var _privateDatabase: CKDatabase?

    public var container: CKContainer? { _container }
    public var publicDatabase: CKDatabase? { _publicDatabase }
    public var privateDatabase: CKDatabase? { _privateDatabase }

    // MARK: - Initialization

    private init() {
        // Don't initialize CloudKit - entitlements aren't configured
        // App will run in demo/offline mode with mock data
        self._container = nil
        self._publicDatabase = nil
        self._privateDatabase = nil
        self.isCloudKitAvailable = false
        self.lastError = CloudKitError.notAuthenticated
    }

    /// Call this to attempt CloudKit initialization after entitlements are configured
    public func initializeCloudKit(containerIdentifier: String) {
        let container = CKContainer(identifier: containerIdentifier)
        self._container = container
        self._publicDatabase = container.publicCloudDatabase
        self._privateDatabase = container.privateCloudDatabase
        self.isCloudKitAvailable = true
        self.lastError = nil
    }

    // MARK: - Authentication

    public func checkAccountStatus() async {
        guard let container = _container else {
            accountStatus = .couldNotDetermine
            isAuthenticated = false
            lastError = CloudKitError.notAuthenticated
            return
        }

        do {
            let status = try await container.accountStatus()
            accountStatus = status
            isAuthenticated = (status == .available)

            if status != .available {
                lastError = CloudKitError.notAuthenticated
            }
        } catch {
            accountStatus = .couldNotDetermine
            isAuthenticated = false
            lastError = error
        }
    }

    // MARK: - Generic CRUD Operations

    /// Fetch a single record by ID
    public func fetchRecord(
        withID recordID: CKRecord.ID,
        from database: CKDatabase? = nil
    ) async throws -> CKRecord {
        guard let db = database ?? publicDatabase else {
            throw CloudKitError.notAuthenticated
        }
        do {
            return try await db.record(for: recordID)
        } catch {
            throw CloudKitError.fetchFailed(error)
        }
    }

    /// Fetch records matching a query
    public func fetchRecords(
        matching query: CKQuery,
        from database: CKDatabase? = nil,
        resultsLimit: Int = CKQueryOperation.maximumResults
    ) async throws -> [CKRecord] {
        guard let db = database ?? publicDatabase else {
            throw CloudKitError.notAuthenticated
        }
        var allRecords: [CKRecord] = []
        var cursor: CKQueryOperation.Cursor?

        repeat {
            let (matchResults, queryCursor) = try await db.records(
                matching: query,
                desiredKeys: nil,
                resultsLimit: resultsLimit
            )

            for (_, result) in matchResults {
                if case .success(let record) = result {
                    allRecords.append(record)
                }
            }

            cursor = queryCursor
        } while cursor != nil

        return allRecords
    }

    /// Fetch records with a predicate
    public func fetchRecords(
        ofType recordType: String,
        predicate: NSPredicate = NSPredicate(value: true),
        sortDescriptors: [NSSortDescriptor]? = nil,
        from database: CKDatabase? = nil
    ) async throws -> [CKRecord] {
        let query = CKQuery(recordType: recordType, predicate: predicate)
        query.sortDescriptors = sortDescriptors
        return try await fetchRecords(matching: query, from: database)
    }

    /// Save a single record
    public func saveRecord(
        _ record: CKRecord,
        to database: CKDatabase? = nil
    ) async throws -> CKRecord {
        guard let db = database ?? publicDatabase else {
            throw CloudKitError.notAuthenticated
        }
        do {
            return try await db.save(record)
        } catch {
            throw CloudKitError.saveFailed(error)
        }
    }

    /// Save multiple records
    public func saveRecords(
        _ records: [CKRecord],
        to database: CKDatabase? = nil
    ) async throws -> [CKRecord] {
        guard !records.isEmpty else { return [] }

        guard let db = database ?? publicDatabase else {
            throw CloudKitError.notAuthenticated
        }
        let operation = CKModifyRecordsOperation(
            recordsToSave: records,
            recordIDsToDelete: nil
        )
        operation.savePolicy = .changedKeys
        operation.isAtomic = false

        return try await withCheckedThrowingContinuation { continuation in
            var savedRecords: [CKRecord] = []

            operation.perRecordSaveBlock = { _, result in
                if case .success(let record) = result {
                    savedRecords.append(record)
                }
            }

            operation.modifyRecordsResultBlock = { result in
                switch result {
                case .success:
                    continuation.resume(returning: savedRecords)
                case .failure(let error):
                    continuation.resume(throwing: CloudKitError.saveFailed(error))
                }
            }

            db.add(operation)
        }
    }

    /// Delete a single record
    public func deleteRecord(
        withID recordID: CKRecord.ID,
        from database: CKDatabase? = nil
    ) async throws {
        guard let db = database ?? publicDatabase else {
            throw CloudKitError.notAuthenticated
        }
        do {
            try await db.deleteRecord(withID: recordID)
        } catch {
            throw CloudKitError.deleteFailed(error)
        }
    }

    /// Delete multiple records
    public func deleteRecords(
        withIDs recordIDs: [CKRecord.ID],
        from database: CKDatabase? = nil
    ) async throws {
        guard !recordIDs.isEmpty else { return }

        guard let db = database ?? publicDatabase else {
            throw CloudKitError.notAuthenticated
        }
        let operation = CKModifyRecordsOperation(
            recordsToSave: nil,
            recordIDsToDelete: recordIDs
        )

        return try await withCheckedThrowingContinuation { continuation in
            operation.modifyRecordsResultBlock = { result in
                switch result {
                case .success:
                    continuation.resume()
                case .failure(let error):
                    continuation.resume(throwing: CloudKitError.deleteFailed(error))
                }
            }

            db.add(operation)
        }
    }
}

// MARK: - Request-Specific Operations

extension CloudKitService {

    /// Fetch all requests
    public func fetchAllRequests() async throws -> [Request] {
        let records = try await fetchRecords(
            ofType: Request.recordType,
            sortDescriptors: [NSSortDescriptor(key: "creationDate", ascending: false)]
        )
        return try records.map { try Request(from: $0) }
    }

    /// Fetch requests with a specific status
    public func fetchRequests(withStatus status: RequestStatus) async throws -> [Request] {
        let predicate = NSPredicate(format: "status == %@", status.rawValue)
        let records = try await fetchRecords(
            ofType: Request.recordType,
            predicate: predicate,
            sortDescriptors: [NSSortDescriptor(key: "creationDate", ascending: false)]
        )
        return try records.map { try Request(from: $0) }
    }

    /// Fetch requests assigned to a specific runner
    public func fetchRequests(forRunnerID runnerID: String) async throws -> [Request] {
        let predicate = NSPredicate(format: "assignedRunnerID == %@", runnerID)
        let records = try await fetchRecords(
            ofType: Request.recordType,
            predicate: predicate,
            sortDescriptors: [NSSortDescriptor(key: "creationDate", ascending: false)]
        )
        return try records.map { try Request(from: $0) }
    }

    /// Save a request
    public func saveRequest(_ request: Request) async throws -> Request {
        let record = request.toRecord()
        let savedRecord = try await saveRecord(record)
        return try Request(from: savedRecord)
    }

    /// Delete a request
    public func deleteRequest(_ request: Request) async throws {
        let recordID = CKRecord.ID(recordName: request.id)
        try await deleteRecord(withID: recordID)
    }
}

// MARK: - RequestItem-Specific Operations

extension CloudKitService {

    /// Fetch items for a request
    public func fetchItems(forRequestID requestID: String) async throws -> [RequestItem] {
        let predicate = NSPredicate(format: "requestID == %@", requestID)
        let records = try await fetchRecords(
            ofType: RequestItem.recordType,
            predicate: predicate,
            sortDescriptors: [NSSortDescriptor(key: "sortOrder", ascending: true)]
        )
        return try records.map { try RequestItem(from: $0) }
    }

    /// Save a request item
    public func saveItem(_ item: RequestItem) async throws -> RequestItem {
        let record = item.toRecord()
        let savedRecord = try await saveRecord(record)
        return try RequestItem(from: savedRecord)
    }

    /// Delete a request item
    public func deleteItem(_ item: RequestItem) async throws {
        let recordID = CKRecord.ID(recordName: item.id)
        try await deleteRecord(withID: recordID)
    }
}

// MARK: - Runner-Specific Operations

extension CloudKitService {

    /// Fetch all runners
    public func fetchAllRunners() async throws -> [Runner] {
        let predicate = NSPredicate(format: "isActive == %@", NSNumber(value: true))
        let records = try await fetchRecords(
            ofType: Runner.recordType,
            predicate: predicate,
            sortDescriptors: [NSSortDescriptor(key: "name", ascending: true)]
        )
        return try records.map { try Runner(from: $0) }
    }

    /// Save a runner
    public func saveRunner(_ runner: Runner) async throws -> Runner {
        let record = runner.toRecord()
        let savedRecord = try await saveRecord(record)
        return try Runner(from: savedRecord)
    }

    /// Delete a runner
    public func deleteRunner(_ runner: Runner) async throws {
        let recordID = CKRecord.ID(recordName: runner.id)
        try await deleteRecord(withID: recordID)
    }
}

// MARK: - Department-Specific Operations

extension CloudKitService {

    /// Fetch all departments
    public func fetchAllDepartments() async throws -> [Department] {
        let predicate = NSPredicate(format: "isActive == %@", NSNumber(value: true))
        let records = try await fetchRecords(
            ofType: Department.recordType,
            predicate: predicate,
            sortDescriptors: [NSSortDescriptor(key: "sortOrder", ascending: true)]
        )
        return try records.map { try Department(from: $0) }
    }

    /// Save a department
    public func saveDepartment(_ department: Department) async throws -> Department {
        let record = department.toRecord()
        let savedRecord = try await saveRecord(record)
        return try Department(from: savedRecord)
    }

    /// Delete a department
    public func deleteDepartment(_ department: Department) async throws {
        let recordID = CKRecord.ID(recordName: department.id)
        try await deleteRecord(withID: recordID)
    }

    /// Initialize default departments if none exist
    public func initializeDefaultDepartmentsIfNeeded() async throws {
        let existing = try await fetchAllDepartments()
        guard existing.isEmpty else { return }

        for dept in Department.defaults {
            _ = try await saveDepartment(dept)
        }
    }
}

// MARK: - TourSchedule-Specific Operations

extension CloudKitService {

    /// Fetch all tour schedule entries
    public func fetchAllTourEntries() async throws -> [TourScheduleEntry] {
        let predicate = NSPredicate(format: "isActive == %@", NSNumber(value: true))
        let records = try await fetchRecords(
            ofType: TourScheduleEntry.recordType,
            predicate: predicate,
            sortDescriptors: [NSSortDescriptor(key: "tourDate", ascending: true)]
        )
        return try records.map { try TourScheduleEntry(from: $0) }
    }

    /// Fetch today's tour entry
    public func fetchTodaysTourEntry() async throws -> TourScheduleEntry? {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: Date())
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!

        let predicate = NSPredicate(
            format: "tourDate >= %@ AND tourDate < %@ AND isActive == %@",
            startOfDay as NSDate,
            endOfDay as NSDate,
            NSNumber(value: true)
        )

        let records = try await fetchRecords(
            ofType: TourScheduleEntry.recordType,
            predicate: predicate
        )

        return try records.first.map { try TourScheduleEntry(from: $0) }
    }

    /// Save tour schedule entries in bulk
    public func saveTourEntries(_ entries: [TourScheduleEntry]) async throws -> [TourScheduleEntry] {
        let records = entries.map { $0.toRecord() }
        let savedRecords = try await saveRecords(records)
        return try savedRecords.map { try TourScheduleEntry(from: $0) }
    }
}
