import Foundation
import CloudKit

// MARK: - Department Model

public struct Department: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var sortOrder: Int
    public var isActive: Bool
    public var contactEmail: String?
    public var defaultNotes: String?
    public let createdAt: Date
    public var modifiedAt: Date

    // Local-only tracking
    public var syncState: SyncState = .synced

    public init(
        id: String = UUID().uuidString,
        name: String,
        sortOrder: Int = 0,
        isActive: Bool = true,
        contactEmail: String? = nil,
        defaultNotes: String? = nil,
        createdAt: Date = Date(),
        modifiedAt: Date = Date(),
        syncState: SyncState = .synced
    ) {
        self.id = id
        self.name = name
        self.sortOrder = sortOrder
        self.isActive = isActive
        self.contactEmail = contactEmail
        self.defaultNotes = defaultNotes
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.syncState = syncState
    }

    // MARK: - Hashable

    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    public static func == (lhs: Department, rhs: Department) -> Bool {
        lhs.id == rhs.id
    }

    // MARK: - Default Departments

    public static let defaults: [Department] = [
        Department(name: "Audio", sortOrder: 0),
        Department(name: "Lighting", sortOrder: 1),
        Department(name: "Video", sortOrder: 2),
        Department(name: "Production", sortOrder: 3),
        Department(name: "Catering", sortOrder: 4),
        Department(name: "Wardrobe", sortOrder: 5)
    ]
}

// MARK: - CloudKit Record Conversion

extension Department {
    public static let recordType = "Department"

    public init(from record: CKRecord) throws {
        guard let name = record["name"] as? String,
              let sortOrder = record["sortOrder"] as? Int,
              let isActive = record["isActive"] as? Bool,
              let createdAt = record.creationDate,
              let modifiedAt = record.modificationDate else {
            throw CloudKitError.invalidRecord
        }

        self.id = record.recordID.recordName
        self.name = name
        self.sortOrder = sortOrder
        self.isActive = isActive
        self.contactEmail = record["contactEmail"] as? String
        self.defaultNotes = record["defaultNotes"] as? String
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.syncState = .synced
    }

    public func toRecord(existingRecord: CKRecord? = nil) -> CKRecord {
        let recordID = CKRecord.ID(recordName: id)
        let record = existingRecord ?? CKRecord(recordType: Self.recordType, recordID: recordID)

        record["name"] = name
        record["sortOrder"] = sortOrder
        record["isActive"] = isActive
        record["contactEmail"] = contactEmail
        record["defaultNotes"] = defaultNotes

        return record
    }
}
