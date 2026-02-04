import Foundation
import CloudKit

// MARK: - Request Item Model

/// Status for individual items (separate from request status)
public enum ItemStatus: String, Codable, CaseIterable, Sendable {
    case pending = "pending"
    case assigned = "assigned"
    case purchased = "purchased"
    case delivered = "delivered"

    public var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .assigned: return "Assigned"
        case .purchased: return "Purchased"
        case .delivered: return "Delivered"
        }
    }

    public var nextStatus: ItemStatus? {
        switch self {
        case .pending: return .assigned
        case .assigned: return .purchased
        case .purchased: return .delivered
        case .delivered: return nil
        }
    }

    public var previousStatus: ItemStatus? {
        switch self {
        case .pending: return nil
        case .assigned: return .pending
        case .purchased: return .assigned
        case .delivered: return .purchased
        }
    }
}

public struct RequestItem: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var requestID: String
    public var itemName: String
    public var itemDescription: String?
    public var itemLink: URL?
    public var storeName: String?
    public var imageAssetID: String?
    public var localImagePath: URL?
    public var imageData: Data?  // Stored image data for display
    public var isASAP: Bool

    // Item-level status and assignment (each item can have different runner)
    public var status: ItemStatus
    public var assignedRunnerID: String?
    public var assignedAt: Date?

    // Purchase tracking
    public var isPurchased: Bool
    public var purchasedAt: Date?
    public var actualCost: Double?
    public var purchaseNotes: String?

    // Delivery tracking
    public var deliveredAt: Date?

    public var sortOrder: Int
    public let createdAt: Date
    public var modifiedAt: Date

    // Local-only tracking
    public var syncState: SyncState = .synced

    public init(
        id: String = UUID().uuidString,
        requestID: String,
        itemName: String,
        itemDescription: String? = nil,
        itemLink: URL? = nil,
        storeName: String? = nil,
        imageAssetID: String? = nil,
        localImagePath: URL? = nil,
        imageData: Data? = nil,
        isASAP: Bool = false,
        status: ItemStatus = .pending,
        assignedRunnerID: String? = nil,
        assignedAt: Date? = nil,
        isPurchased: Bool = false,
        purchasedAt: Date? = nil,
        actualCost: Double? = nil,
        purchaseNotes: String? = nil,
        deliveredAt: Date? = nil,
        sortOrder: Int = 0,
        createdAt: Date = Date(),
        modifiedAt: Date = Date(),
        syncState: SyncState = .synced
    ) {
        self.id = id
        self.requestID = requestID
        self.itemName = itemName
        self.itemDescription = itemDescription
        self.itemLink = itemLink
        self.storeName = storeName
        self.imageAssetID = imageAssetID
        self.localImagePath = localImagePath
        self.imageData = imageData
        self.isASAP = isASAP
        self.status = status
        self.assignedRunnerID = assignedRunnerID
        self.assignedAt = assignedAt
        self.isPurchased = isPurchased
        self.purchasedAt = purchasedAt
        self.actualCost = actualCost
        self.purchaseNotes = purchaseNotes
        self.deliveredAt = deliveredAt
        self.sortOrder = sortOrder
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.syncState = syncState
    }

    // MARK: - Display Helpers

    public var displayDescription: String {
        var parts: [String] = []
        if let desc = itemDescription, !desc.isEmpty {
            parts.append(desc)
        }
        if let link = itemLink {
            parts.append("Link: \(link.absoluteString)")
        }
        return parts.joined(separator: "\n")
    }

    public var formattedCost: String? {
        guard let cost = actualCost else { return nil }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = .current
        return formatter.string(from: NSNumber(value: cost))
    }

    // MARK: - Hashable

    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    public static func == (lhs: RequestItem, rhs: RequestItem) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - CloudKit Record Conversion

extension RequestItem {
    public static let recordType = "RequestItem"

    public init(from record: CKRecord) throws {
        guard let requestID = record["requestID"] as? String,
              let itemName = record["itemName"] as? String,
              let isASAP = record["isASAP"] as? Bool,
              let sortOrder = record["sortOrder"] as? Int,
              let createdAt = record.creationDate,
              let modifiedAt = record.modificationDate else {
            throw CloudKitError.invalidRecord
        }

        self.id = record.recordID.recordName
        self.requestID = requestID
        self.itemName = itemName
        self.itemDescription = record["itemDescription"] as? String
        if let linkString = record["itemLink"] as? String {
            self.itemLink = URL(string: linkString)
        }
        self.storeName = record["storeName"] as? String
        self.imageAssetID = record["imageAssetID"] as? String
        self.isASAP = isASAP

        // Status - default to pending if not set
        if let statusRaw = record["status"] as? String,
           let status = ItemStatus(rawValue: statusRaw) {
            self.status = status
        } else {
            self.status = .pending
        }

        self.assignedRunnerID = record["assignedRunnerID"] as? String
        self.assignedAt = record["assignedAt"] as? Date
        self.isPurchased = record["isPurchased"] as? Bool ?? false
        self.purchasedAt = record["purchasedAt"] as? Date
        self.actualCost = record["actualCost"] as? Double
        self.purchaseNotes = record["purchaseNotes"] as? String
        self.deliveredAt = record["deliveredAt"] as? Date
        self.sortOrder = sortOrder
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.syncState = .synced
    }

    public func toRecord(existingRecord: CKRecord? = nil) -> CKRecord {
        let recordID = CKRecord.ID(recordName: id)
        let record = existingRecord ?? CKRecord(recordType: Self.recordType, recordID: recordID)

        record["requestID"] = requestID
        record["itemName"] = itemName
        record["itemDescription"] = itemDescription
        record["itemLink"] = itemLink?.absoluteString
        record["storeName"] = storeName
        record["imageAssetID"] = imageAssetID
        record["isASAP"] = isASAP
        record["status"] = status.rawValue
        record["assignedRunnerID"] = assignedRunnerID
        record["assignedAt"] = assignedAt
        record["isPurchased"] = isPurchased
        record["purchasedAt"] = purchasedAt
        record["actualCost"] = actualCost
        record["purchaseNotes"] = purchaseNotes
        record["deliveredAt"] = deliveredAt
        record["sortOrder"] = sortOrder

        return record
    }
}
