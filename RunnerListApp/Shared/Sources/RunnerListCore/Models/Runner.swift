import Foundation
import CloudKit

// MARK: - Runner Shopping Status

/// Tracks the current shopping status of a runner for the dashboard display
public enum RunnerShoppingStatus: String, Codable, Sendable {
    /// Runner is available, no active shopping list (green button)
    case available
    /// Runner has items assigned, list is ready to be sent (red button)
    case listReady
    /// Runner is out shopping, PDF was sent (yellow button)
    case shopping
}

// MARK: - Runner Model

public struct Runner: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var phoneNumber: String
    public var city: String?
    public var email: String?
    public var isActive: Bool
    public var deviceToken: String?
    public var assignedItemCount: Int
    public var completedItemCount: Int
    public let createdAt: Date
    public var modifiedAt: Date

    // Local-only tracking
    public var syncState: SyncState = .synced

    public init(
        id: String = UUID().uuidString,
        name: String,
        phoneNumber: String,
        city: String? = nil,
        email: String? = nil,
        isActive: Bool = true,
        deviceToken: String? = nil,
        assignedItemCount: Int = 0,
        completedItemCount: Int = 0,
        createdAt: Date = Date(),
        modifiedAt: Date = Date(),
        syncState: SyncState = .synced
    ) {
        self.id = id
        self.name = name
        self.phoneNumber = phoneNumber
        self.city = city
        self.email = email
        self.isActive = isActive
        self.deviceToken = deviceToken
        self.assignedItemCount = assignedItemCount
        self.completedItemCount = completedItemCount
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.syncState = syncState
    }

    // MARK: - Display Helpers

    public var initials: String {
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            let first = parts[0].prefix(1)
            let last = parts[1].prefix(1)
            return "\(first)\(last)".uppercased()
        } else if let first = parts.first {
            return String(first.prefix(2)).uppercased()
        }
        return "??"
    }

    public var formattedPhone: String {
        // Simple formatting - could be enhanced
        let digits = phoneNumber.filter { $0.isNumber }
        if digits.count == 10 {
            let areaCode = digits.prefix(3)
            let middle = digits.dropFirst(3).prefix(3)
            let last = digits.suffix(4)
            return "(\(areaCode)) \(middle)-\(last)"
        }
        return phoneNumber
    }

    // MARK: - Hashable

    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    public static func == (lhs: Runner, rhs: Runner) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - CloudKit Record Conversion

extension Runner {
    public static let recordType = "Runner"

    public init(from record: CKRecord) throws {
        guard let name = record["name"] as? String,
              let phoneNumber = record["phoneNumber"] as? String,
              let isActive = record["isActive"] as? Bool,
              let createdAt = record.creationDate,
              let modifiedAt = record.modificationDate else {
            throw CloudKitError.invalidRecord
        }

        self.id = record.recordID.recordName
        self.name = name
        self.phoneNumber = phoneNumber
        self.city = record["city"] as? String
        self.email = record["email"] as? String
        self.isActive = isActive
        self.deviceToken = record["deviceToken"] as? String
        self.assignedItemCount = (record["assignedItemCount"] as? Int) ?? 0
        self.completedItemCount = (record["completedItemCount"] as? Int) ?? 0
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.syncState = .synced
    }

    public func toRecord(existingRecord: CKRecord? = nil) -> CKRecord {
        let recordID = CKRecord.ID(recordName: id)
        let record = existingRecord ?? CKRecord(recordType: Self.recordType, recordID: recordID)

        record["name"] = name
        record["phoneNumber"] = phoneNumber
        record["city"] = city
        record["email"] = email
        record["isActive"] = isActive
        record["deviceToken"] = deviceToken
        record["assignedItemCount"] = assignedItemCount
        record["completedItemCount"] = completedItemCount

        return record
    }
}
