import Foundation
import CloudKit

// MARK: - Request Status

public enum RequestStatus: String, Codable, CaseIterable, Sendable {
    case pending = "pending"
    case assigned = "assigned"
    case purchased = "purchased"
    case completed = "completed"

    public var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .assigned: return "Assigned"
        case .purchased: return "Purchased"
        case .completed: return "Completed"
        }
    }

    public var nextStatus: RequestStatus? {
        switch self {
        case .pending: return .assigned
        case .assigned: return .purchased
        case .purchased: return .completed
        case .completed: return nil
        }
    }

    public var previousStatus: RequestStatus? {
        switch self {
        case .pending: return nil
        case .assigned: return .pending
        case .purchased: return .assigned
        case .completed: return .purchased
        }
    }
}

// MARK: - Sync State

public enum SyncState: String, Codable, Sendable {
    case synced
    case pendingUpload
    case pendingDownload
    case conflicted
}

// MARK: - Request Model

public struct Request: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var requesterName: String
    public var requesterMobile: String
    public var departmentID: String
    public var status: RequestStatus
    public var assignedRunnerID: String?
    public var assignedAt: Date?
    public var completedAt: Date?
    public var totalCost: Double?
    public var notes: String?
    public var hasASAPItems: Bool
    public var itemCount: Int
    public let createdAt: Date
    public var modifiedAt: Date

    // Local-only tracking (not synced)
    public var syncState: SyncState = .synced

    public init(
        id: String = UUID().uuidString,
        requesterName: String,
        requesterMobile: String,
        departmentID: String,
        status: RequestStatus = .pending,
        assignedRunnerID: String? = nil,
        assignedAt: Date? = nil,
        completedAt: Date? = nil,
        totalCost: Double? = nil,
        notes: String? = nil,
        hasASAPItems: Bool = false,
        itemCount: Int = 0,
        createdAt: Date = Date(),
        modifiedAt: Date = Date(),
        syncState: SyncState = .synced
    ) {
        self.id = id
        self.requesterName = requesterName
        self.requesterMobile = requesterMobile
        self.departmentID = departmentID
        self.status = status
        self.assignedRunnerID = assignedRunnerID
        self.assignedAt = assignedAt
        self.completedAt = completedAt
        self.totalCost = totalCost
        self.notes = notes
        self.hasASAPItems = hasASAPItems
        self.itemCount = itemCount
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.syncState = syncState
    }

    // MARK: - Hashable (exclude syncState from comparison)

    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    public static func == (lhs: Request, rhs: Request) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - CloudKit Record Conversion

extension Request {
    public static let recordType = "Request"

    public init(from record: CKRecord) throws {
        guard let requesterName = record["requesterName"] as? String,
              let requesterMobile = record["requesterMobile"] as? String,
              let departmentID = record["departmentID"] as? String,
              let statusRaw = record["status"] as? String,
              let status = RequestStatus(rawValue: statusRaw),
              let hasASAPItems = record["hasASAPItems"] as? Bool,
              let itemCount = record["itemCount"] as? Int,
              let createdAt = record.creationDate,
              let modifiedAt = record.modificationDate else {
            throw CloudKitError.invalidRecord
        }

        self.id = record.recordID.recordName
        self.requesterName = requesterName
        self.requesterMobile = requesterMobile
        self.departmentID = departmentID
        self.status = status
        self.assignedRunnerID = record["assignedRunnerID"] as? String
        self.assignedAt = record["assignedAt"] as? Date
        self.completedAt = record["completedAt"] as? Date
        self.totalCost = record["totalCost"] as? Double
        self.notes = record["notes"] as? String
        self.hasASAPItems = hasASAPItems
        self.itemCount = itemCount
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.syncState = .synced
    }

    public func toRecord(existingRecord: CKRecord? = nil) -> CKRecord {
        let recordID = CKRecord.ID(recordName: id)
        let record = existingRecord ?? CKRecord(recordType: Self.recordType, recordID: recordID)

        record["requesterName"] = requesterName
        record["requesterMobile"] = requesterMobile
        record["departmentID"] = departmentID
        record["status"] = status.rawValue
        record["assignedRunnerID"] = assignedRunnerID
        record["assignedAt"] = assignedAt
        record["completedAt"] = completedAt
        record["totalCost"] = totalCost
        record["notes"] = notes
        record["hasASAPItems"] = hasASAPItems
        record["itemCount"] = itemCount

        return record
    }
}

// MARK: - CloudKit Error

public enum CloudKitError: Error, LocalizedError {
    case invalidRecord
    case recordNotFound
    case saveFailed(Error)
    case fetchFailed(Error)
    case deleteFailed(Error)
    case notAuthenticated
    case networkUnavailable

    public var errorDescription: String? {
        switch self {
        case .invalidRecord:
            return "Invalid record format"
        case .recordNotFound:
            return "Record not found"
        case .saveFailed(let error):
            return "Failed to save: \(error.localizedDescription)"
        case .fetchFailed(let error):
            return "Failed to fetch: \(error.localizedDescription)"
        case .deleteFailed(let error):
            return "Failed to delete: \(error.localizedDescription)"
        case .notAuthenticated:
            return "Not signed in to iCloud"
        case .networkUnavailable:
            return "Network unavailable"
        }
    }
}
