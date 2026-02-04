import Foundation
import CloudKit

// MARK: - Tour Schedule Entry Model

public struct TourScheduleEntry: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var tourDate: Date
    public var venueName: String
    public var venueCity: String
    public var venueState: String?
    public var loadInTime: Date?
    public var showTime: Date?
    public var notes: String?
    public var isActive: Bool
    public let createdAt: Date
    public var modifiedAt: Date

    // Local-only tracking
    public var syncState: SyncState = .synced

    public init(
        id: String = UUID().uuidString,
        tourDate: Date,
        venueName: String,
        venueCity: String,
        venueState: String? = nil,
        loadInTime: Date? = nil,
        showTime: Date? = nil,
        notes: String? = nil,
        isActive: Bool = true,
        createdAt: Date = Date(),
        modifiedAt: Date = Date(),
        syncState: SyncState = .synced
    ) {
        self.id = id
        self.tourDate = tourDate
        self.venueName = venueName
        self.venueCity = venueCity
        self.venueState = venueState
        self.loadInTime = loadInTime
        self.showTime = showTime
        self.notes = notes
        self.isActive = isActive
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.syncState = syncState
    }

    // MARK: - Display Helpers

    public var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: tourDate)
    }

    public var shortFormattedDate: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE MMM d"
        return formatter.string(from: tourDate)
    }

    public var location: String {
        if let state = venueState, !state.isEmpty {
            return "\(venueCity), \(state)"
        }
        return venueCity
    }

    public var fullLocation: String {
        "\(venueName) - \(location)"
    }

    // MARK: - Date Matching

    public func isToday() -> Bool {
        Calendar.current.isDateInToday(tourDate)
    }

    public static func entryForToday(from entries: [TourScheduleEntry]) -> TourScheduleEntry? {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        return entries.first { entry in
            calendar.isDate(entry.tourDate, inSameDayAs: today)
        }
    }

    // MARK: - Hashable

    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    public static func == (lhs: TourScheduleEntry, rhs: TourScheduleEntry) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - CloudKit Record Conversion

extension TourScheduleEntry {
    public static let recordType = "TourScheduleEntry"

    public init(from record: CKRecord) throws {
        guard let tourDate = record["tourDate"] as? Date,
              let venueName = record["venueName"] as? String,
              let venueCity = record["venueCity"] as? String,
              let isActive = record["isActive"] as? Bool,
              let createdAt = record.creationDate,
              let modifiedAt = record.modificationDate else {
            throw CloudKitError.invalidRecord
        }

        self.id = record.recordID.recordName
        self.tourDate = tourDate
        self.venueName = venueName
        self.venueCity = venueCity
        self.venueState = record["venueState"] as? String
        self.loadInTime = record["loadInTime"] as? Date
        self.showTime = record["showTime"] as? Date
        self.notes = record["notes"] as? String
        self.isActive = isActive
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.syncState = .synced
    }

    public func toRecord(existingRecord: CKRecord? = nil) -> CKRecord {
        let recordID = CKRecord.ID(recordName: id)
        let record = existingRecord ?? CKRecord(recordType: Self.recordType, recordID: recordID)

        record["tourDate"] = tourDate
        record["venueName"] = venueName
        record["venueCity"] = venueCity
        record["venueState"] = venueState
        record["loadInTime"] = loadInTime
        record["showTime"] = showTime
        record["notes"] = notes
        record["isActive"] = isActive

        return record
    }
}

// MARK: - CSV Import Helper

extension TourScheduleEntry {
    /// Creates a TourScheduleEntry from CSV row data
    public static func fromCSV(
        dateString: String,
        city: String,
        venue: String,
        dateFormat: String = "MM/dd/yyyy"
    ) -> TourScheduleEntry? {
        let formatter = DateFormatter()
        formatter.dateFormat = dateFormat

        // Try multiple common date formats
        let formats = [dateFormat, "M/d/yyyy", "yyyy-MM-dd", "MM-dd-yyyy", "EEE MMM d"]
        var parsedDate: Date?

        for format in formats {
            formatter.dateFormat = format
            if let date = formatter.date(from: dateString) {
                parsedDate = date
                break
            }
        }

        guard let date = parsedDate else { return nil }

        return TourScheduleEntry(
            tourDate: date,
            venueName: venue.trimmingCharacters(in: .whitespaces),
            venueCity: city.trimmingCharacters(in: .whitespaces)
        )
    }
}
