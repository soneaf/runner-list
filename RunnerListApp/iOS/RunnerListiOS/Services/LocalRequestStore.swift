import Foundation
import RunnerListCore

// MARK: - Local Request Store

/// Stores submitted requests locally when CloudKit is unavailable
/// Also saves to SharedFileStore for cross-app access (macOS dashboard)
final class LocalRequestStore {

    // MARK: - Singleton

    static let shared = LocalRequestStore()

    // MARK: - Storage Keys

    private let pendingRequestsKey = "pendingLocalRequests"

    // MARK: - Stored Request Model

    struct StoredRequest: Codable, Identifiable {
        let id: String
        let requesterName: String
        let requesterMobile: String
        let departmentID: String
        let departmentName: String
        let hasASAPItems: Bool
        let items: [StoredItem]
        let createdAt: Date

        init(
            requesterName: String,
            requesterMobile: String,
            departmentID: String,
            departmentName: String,
            hasASAPItems: Bool,
            items: [StoredItem]
        ) {
            self.id = UUID().uuidString
            self.requesterName = requesterName
            self.requesterMobile = requesterMobile
            self.departmentID = departmentID
            self.departmentName = departmentName
            self.hasASAPItems = hasASAPItems
            self.items = items
            self.createdAt = Date()
        }
    }

    struct StoredItem: Codable, Identifiable {
        let id: String
        let itemName: String
        let itemDescription: String?
        let itemLink: String?
        let storeName: String?
        let isASAP: Bool
        let sortOrder: Int
        let imageData: Data?

        init(
            itemName: String,
            itemDescription: String?,
            itemLink: String?,
            storeName: String?,
            isASAP: Bool,
            sortOrder: Int,
            imageData: Data? = nil
        ) {
            self.id = UUID().uuidString
            self.itemName = itemName
            self.itemDescription = itemDescription
            self.itemLink = itemLink
            self.storeName = storeName
            self.isASAP = isASAP
            self.sortOrder = sortOrder
            self.imageData = imageData
        }

        // Custom decoder to handle old data without imageData field
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(String.self, forKey: .id)
            itemName = try container.decode(String.self, forKey: .itemName)
            itemDescription = try container.decodeIfPresent(String.self, forKey: .itemDescription)
            itemLink = try container.decodeIfPresent(String.self, forKey: .itemLink)
            storeName = try container.decodeIfPresent(String.self, forKey: .storeName)
            isASAP = try container.decode(Bool.self, forKey: .isASAP)
            sortOrder = try container.decode(Int.self, forKey: .sortOrder)
            // Default to nil if imageData doesn't exist in old data
            imageData = try container.decodeIfPresent(Data.self, forKey: .imageData)
        }
    }

    // MARK: - Initialization

    private init() {}

    // MARK: - Save Request

    /// Saves a request locally for later sync AND to shared storage for macOS access
    func saveRequest(_ request: StoredRequest) {
        // Save to shared storage for macOS dashboard access (primary storage - with images)
        saveToSharedStore(request)

        // Note: We skip saving to UserDefaults since SharedFileStore is our primary storage
        // UserDefaults has a 4MB limit which images can easily exceed
        print("Request saved to shared store. ID: \(request.id)")
    }

    /// Saves to the SharedFileStore for cross-app access
    private func saveToSharedStore(_ request: StoredRequest) {
        // Convert to SharedFileStore format
        let sharedItems = request.items.map { item in
            SharedFileStore.StoredItem(
                id: item.id,
                itemName: item.itemName,
                itemDescription: item.itemDescription,
                itemLink: item.itemLink,
                storeName: item.storeName,
                isASAP: item.isASAP,
                sortOrder: item.sortOrder,
                imageData: item.imageData,  // Include photo data
                status: "pending"
            )
        }

        let sharedRequest = SharedFileStore.StoredRequest(
            id: request.id,
            requesterName: request.requesterName,
            requesterMobile: request.requesterMobile,
            departmentID: request.departmentID,
            departmentName: request.departmentName,
            hasASAPItems: request.hasASAPItems,
            items: sharedItems,
            createdAt: request.createdAt
        )

        SharedFileStore.shared.saveRequest(sharedRequest)
    }

    // MARK: - Load Requests

    /// Loads all pending requests that haven't been synced
    func loadPendingRequests() -> [StoredRequest] {
        guard let data = UserDefaults.standard.data(forKey: pendingRequestsKey) else {
            return []
        }

        do {
            return try JSONDecoder().decode([StoredRequest].self, from: data)
        } catch {
            print("Failed to decode pending requests: \(error)")
            return []
        }
    }

    /// Returns the count of pending requests
    var pendingCount: Int {
        loadPendingRequests().count
    }

    // MARK: - Clear Requests

    /// Removes a request after it's been synced
    func removeRequest(withID id: String) {
        var pending = loadPendingRequests()
        pending.removeAll { $0.id == id }
        savePendingRequests(pending)

        // Also remove from shared store
        SharedFileStore.shared.removeRequest(withID: id)
    }

    /// Clears all pending requests (use after successful sync)
    func clearAllPendingRequests() {
        UserDefaults.standard.removeObject(forKey: pendingRequestsKey)
        SharedFileStore.shared.clearAllRequests()
    }

    // MARK: - Private Helpers

    private func savePendingRequests(_ requests: [StoredRequest]) {
        do {
            let data = try JSONEncoder().encode(requests)
            UserDefaults.standard.set(data, forKey: pendingRequestsKey)
        } catch {
            print("Failed to encode pending requests: \(error)")
        }
    }
}
