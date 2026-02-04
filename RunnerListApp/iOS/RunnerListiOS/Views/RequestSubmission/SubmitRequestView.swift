import SwiftUI
import PhotosUI
import RunnerListCore

// MARK: - iOS App Colors (matching shared dark theme)

private enum iOSAppColors {
    /// Main page/window background - pure black
    static let backgroundPrimary = Color.black

    /// Card and field background - dark gray #2c2c2e
    static let backgroundSecondary = Color(red: 0.173, green: 0.173, blue: 0.180)

    /// Darker variant for nested elements
    static let backgroundTertiary = Color(red: 0.12, green: 0.12, blue: 0.14)
}

// MARK: - Item Entry Model

/// Represents a single item in the request form
struct ItemEntry: Identifiable {
    let id = UUID()
    var itemName: String = ""
    var itemDescription: String = ""
    var itemLink: String = ""  // URL to product page
    var storeName: String = ""
    var isASAP: Bool = false
    var selectedPhoto: PhotosPickerItem?
    var photoData: Data?
    var photoImage: Image?
}

// MARK: - Submit Request View

struct SubmitRequestView: View {
    @EnvironmentObject var syncEngine: CloudKitSyncEngine

    // Requester info
    @State private var requesterName: String = ""
    @State private var requesterMobile: String = ""
    @State private var selectedDepartmentID: String = ""

    // Items list
    @State private var items: [ItemEntry] = [ItemEntry()]

    // State
    @State private var isSubmitting = false
    @State private var showSuccessAlert = false
    @State private var savedOffline = false  // Track if saved locally vs CloudKit
    @State private var errorMessage: String?
    @State private var currentPage: FormPage = .yourInfo  // Track which page we're on

    // Form pages
    enum FormPage {
        case yourInfo
        case itemsNeeded
    }

    // Departments loaded from CloudKit
    @State private var departments: [Department] = Department.defaults

    @FocusState private var focusedField: FocusField?

    enum FocusField: Hashable {
        case name
        case mobile
        case itemName(UUID)
        case itemDescription(UUID)
        case itemLink(UUID)
        case itemStore(UUID)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    // Large header title
                    Text("Runner Request")
                        .font(.system(size: 34, weight: .bold))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.bottom, 8)

                    // Show different content based on current page
                    switch currentPage {
                    case .yourInfo:
                        yourInfoPage
                    case .itemsNeeded:
                        itemsNeededPage
                    }

                    // Error message
                    if let error = errorMessage {
                        errorView(error)
                    }
                }
                .padding()
            }
            .background(iOSAppColors.backgroundPrimary)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") {
                        focusedField = nil
                    }
                }
            }
            .alert("Request Submitted!", isPresented: $showSuccessAlert) {
                Button("OK") {
                    // Use a longer delay to ensure alert fully dismisses before resetting
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        resetForm()
                    }
                }
            } message: {
                if savedOffline {
                    Text("Your request has been saved and will be sent to the production coordinator. You'll receive a text when your items are ready.")
                } else {
                    Text("Your request has been sent to the production coordinator. You'll receive a text when your items are ready.")
                }
            }
            .task {
                await loadDepartments()
            }
        }
    }

    // MARK: - Page 1: Your Information

    private var yourInfoPage: some View {
        VStack(spacing: 16) {
            // Requester info card
            requesterInfoCard

            // Add Item button to proceed to next page
            addItemNavigationButton
        }
    }

    // MARK: - Page 2: Items Needed

    private var itemsNeededPage: some View {
        VStack(spacing: 16) {
            // Back button
            backButton

            // Items section card
            itemsSectionCard
        }
    }

    // MARK: - Back Button

    private var backButton: some View {
        Button {
            withAnimation {
                currentPage = .yourInfo
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "chevron.left")
                Text("Back to Your Info")
            }
            .font(.subheadline)
            .foregroundStyle(.blue)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Add Item Navigation Button

    private var addItemNavigationButton: some View {
        Button {
            withAnimation {
                currentPage = .itemsNeeded
            }
        } label: {
            HStack {
                Image(systemName: "plus.circle.fill")
                Text("Add Item")
            }
            .font(.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(isYourInfoValid ? Color.blue : Color.gray.opacity(0.5))
            .cornerRadius(25)
        }
        .disabled(!isYourInfoValid)
    }

    // Validation for page 1
    private var isYourInfoValid: Bool {
        !requesterName.trimmingCharacters(in: .whitespaces).isEmpty &&
        !requesterMobile.trimmingCharacters(in: .whitespaces).isEmpty &&
        !selectedDepartmentID.isEmpty
    }

    // MARK: - Requester Info Card

    private var requesterInfoCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Your Information", systemImage: "person.fill")
                .font(.headline)
                .foregroundStyle(.primary)

            VStack(spacing: 12) {
                // Name field
                VStack(alignment: .leading, spacing: 4) {
                    Text("Name")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    TextField("Your name", text: $requesterName)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(iOSAppColors.backgroundSecondary)
                        .cornerRadius(25)
                        .focused($focusedField, equals: .name)
                        .textContentType(.name)
                        .autocorrectionDisabled()
                }

                // Mobile field
                VStack(alignment: .leading, spacing: 4) {
                    Text("Mobile Number")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    TextField("(555) 123-4567", text: $requesterMobile)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(iOSAppColors.backgroundSecondary)
                        .cornerRadius(25)
                        .focused($focusedField, equals: .mobile)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                }

                // Department picker
                VStack(alignment: .leading, spacing: 4) {
                    Text("Department")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Menu {
                        ForEach(departments) { dept in
                            Button(dept.name) {
                                selectedDepartmentID = dept.id
                            }
                        }
                    } label: {
                        HStack {
                            Text(selectedDepartmentName)
                                .foregroundStyle(selectedDepartmentID.isEmpty ? .secondary : .primary)
                            Spacer()
                            Image(systemName: "chevron.down")
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(iOSAppColors.backgroundSecondary)
                        .cornerRadius(25)
                    }
                }
            }
        }
        .padding()
        .background(iOSAppColors.backgroundTertiary)
        .cornerRadius(12)
    }

    private var selectedDepartmentName: String {
        if let dept = departments.first(where: { $0.id == selectedDepartmentID }) {
            return dept.name
        }
        return "Select department..."
    }

    // MARK: - Items Section Card

    private var itemsSectionCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Items Needed", systemImage: "shippingbox")
                .font(.headline)
                .foregroundStyle(.primary)

            // Individual item entries - use $items binding for safe mutation
            ForEach($items) { $item in
                itemEntryView(item: $item, itemID: item.id)
            }

            // Add Another Item button
            addItemButton

            // Submit Request button
            submitButton
        }
        .padding()
        .background(iOSAppColors.backgroundTertiary)
        .cornerRadius(12)
    }

    private func itemEntryView(item: Binding<ItemEntry>, itemID: UUID) -> some View {
        // Compute display number safely - if item not found, show 1
        let displayNumber = (items.firstIndex(where: { $0.id == itemID }) ?? 0) + 1

        return VStack(alignment: .leading, spacing: 12) {
            // Item header with delete button
            HStack {
                Text("Item \(displayNumber)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)

                Spacer()

                if items.count > 1 {
                    Button(role: .destructive) {
                        withAnimation {
                            if let idx = items.firstIndex(where: { $0.id == itemID }) {
                                items.remove(at: idx)
                            }
                        }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            // Item name
            VStack(alignment: .leading, spacing: 4) {
                Text("Item Name")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                TextField("What do you need?", text: item.itemName)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(iOSAppColors.backgroundSecondary)
                    .cornerRadius(25)
                    .focused($focusedField, equals: .itemName(itemID))
            }

            // Details / Description
            VStack(alignment: .leading, spacing: 4) {
                Text("Details / Description")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                TextField("Size, color, quantity, etc.", text: item.itemDescription, axis: .vertical)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(iOSAppColors.backgroundSecondary)
                    .cornerRadius(20)
                    .focused($focusedField, equals: .itemDescription(itemID))
                    .lineLimit(2...4)
            }

            // Product Link (URL)
            VStack(alignment: .leading, spacing: 4) {
                Text("Product Link (optional)")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                TextField("https://www.bestbuy.com/...", text: item.itemLink)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(iOSAppColors.backgroundSecondary)
                    .cornerRadius(25)
                    .focused($focusedField, equals: .itemLink(itemID))
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }

            // Suggested store
            VStack(alignment: .leading, spacing: 4) {
                Text("Suggested Store (optional)")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                TextField("Target, Walmart, etc.", text: item.storeName)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(iOSAppColors.backgroundSecondary)
                    .cornerRadius(25)
                    .focused($focusedField, equals: .itemStore(itemID))
            }

            // Photo picker
            HStack(spacing: 12) {
                PhotosPicker(selection: item.selectedPhoto, matching: .images) {
                    Label(item.wrappedValue.photoData != nil ? "Change Photo" : "Attach Photo", systemImage: "camera")
                        .font(.subheadline)
                        .foregroundStyle(.blue)
                }
                .onChange(of: item.wrappedValue.selectedPhoto) { _, newValue in
                    Task {
                        await loadPhoto(for: itemID, from: newValue)
                    }
                }

                if let photoImage = item.wrappedValue.photoImage {
                    photoImage
                        .resizable()
                        .scaledToFill()
                        .frame(width: 50, height: 50)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            Button {
                                item.wrappedValue.selectedPhoto = nil
                                item.wrappedValue.photoData = nil
                                item.wrappedValue.photoImage = nil
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(.white, .red)
                            }
                            .offset(x: 8, y: -8),
                            alignment: .topTrailing
                        )
                }

                Spacer()
            }

            // ASAP toggle
            Toggle(isOn: item.isASAP) {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                    Text("ASAP - Urgent")
                        .font(.subheadline)
                }
            }
            .tint(.red)

            // Divider between items (except for last item)
            // Safely check if this is not the last item
            if let currentIndex = items.firstIndex(where: { $0.id == itemID }),
               currentIndex < items.count - 1 {
                Divider()
                    .padding(.top, 8)
            }
        }
    }

    // MARK: - Add Item Button

    private var addItemButton: some View {
        Button {
            withAnimation {
                items.append(ItemEntry())
            }
        } label: {
            HStack {
                Image(systemName: "plus.circle.fill")
                Text("Add Another Item")
            }
            .font(.subheadline.weight(.medium))
            .foregroundStyle(.blue)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(iOSAppColors.backgroundSecondary)
            .cornerRadius(25)
        }
        .padding(.top, 8)
    }

    // MARK: - Submit Button

    private var submitButton: some View {
        Button(action: submitRequest) {
            if isSubmitting {
                HStack(spacing: 8) {
                    ProgressView()
                        .tint(.white)
                    Text("Submitting...")
                }
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.blue.opacity(0.7))
                .foregroundStyle(.white)
                .cornerRadius(25)
            } else {
                Text("Submit Request")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(isFormValid ? Color.blue : Color.gray.opacity(0.5))
                    .foregroundStyle(.white)
                    .cornerRadius(25)
            }
        }
        .disabled(!isFormValid || isSubmitting)
        .padding(.top, 8)
    }

    // MARK: - Error View

    private func errorView(_ message: String) -> some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
            Text(message)
                .foregroundStyle(.red)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(Color.red.opacity(0.1))
        .cornerRadius(12)
    }

    // MARK: - Validation

    private var isFormValid: Bool {
        !requesterName.trimmingCharacters(in: .whitespaces).isEmpty &&
        !requesterMobile.trimmingCharacters(in: .whitespaces).isEmpty &&
        !selectedDepartmentID.isEmpty &&
        items.allSatisfy { !$0.itemName.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    // MARK: - Data Loading

    @MainActor
    private func loadDepartments() async {
        do {
            departments = try await CloudKitService.shared.fetchAllDepartments()
        } catch {
            // Use defaults if CloudKit fails
            departments = Department.defaults
        }
    }

    @MainActor
    private func loadPhoto(for itemID: UUID, from pickerItem: PhotosPickerItem?) async {
        // Find the index by ID (safer than using a captured index that could become stale)
        guard let index = items.firstIndex(where: { $0.id == itemID }) else { return }

        guard let pickerItem else {
            items[index].photoData = nil
            items[index].photoImage = nil
            return
        }

        do {
            if let data = try await pickerItem.loadTransferable(type: Data.self),
               let uiImage = UIImage(data: data) {
                // Re-find index after async operation in case array changed
                guard let currentIndex = items.firstIndex(where: { $0.id == itemID }) else { return }
                // Compress the image to reduce size (max 800px, 60% JPEG quality)
                let compressedData = compressImage(uiImage, maxDimension: 800, quality: 0.6)
                items[currentIndex].photoData = compressedData
                items[currentIndex].photoImage = Image(uiImage: uiImage)
            }
        } catch {
            print("Failed to load photo: \(error)")
        }
    }

    /// Compresses an image to reduce file size
    private func compressImage(_ image: UIImage, maxDimension: CGFloat, quality: CGFloat) -> Data? {
        let size = image.size
        let scale = min(maxDimension / max(size.width, size.height), 1.0)
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)

        UIGraphicsBeginImageContextWithOptions(newSize, false, 1.0)
        image.draw(in: CGRect(origin: .zero, size: newSize))
        let resizedImage = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()

        return resizedImage?.jpegData(compressionQuality: quality)
    }

    // MARK: - Submit Action

    private func submitRequest() {
        guard isFormValid else { return }

        focusedField = nil
        isSubmitting = true
        errorMessage = nil
        savedOffline = false

        let hasASAPItems = items.contains { $0.isASAP }

        Task {
            // First, try to submit via CloudKit
            let cloudKitSuccess = await submitToCloudKit(hasASAPItems: hasASAPItems)

            if cloudKitSuccess {
                await MainActor.run {
                    isSubmitting = false
                    savedOffline = false
                    showSuccessAlert = true
                }
            } else {
                // CloudKit unavailable - save locally instead
                await saveLocally(hasASAPItems: hasASAPItems)

                await MainActor.run {
                    isSubmitting = false
                    savedOffline = true
                    showSuccessAlert = true
                }
            }
        }
    }

    /// Attempts to submit the request via CloudKit
    /// Returns true if successful, false if CloudKit is unavailable
    private func submitToCloudKit(hasASAPItems: Bool) async -> Bool {
        // Check if CloudKit is available
        guard CloudKitService.shared.isCloudKitAvailable else {
            return false
        }

        do {
            // Create the request
            let request = Request(
                requesterName: requesterName.trimmingCharacters(in: .whitespaces),
                requesterMobile: requesterMobile.trimmingCharacters(in: .whitespaces),
                departmentID: selectedDepartmentID,
                hasASAPItems: hasASAPItems,
                itemCount: items.count
            )

            // Save the request
            let savedRequest = try await CloudKitService.shared.saveRequest(request)

            // Save each item
            for (index, itemEntry) in items.enumerated() {
                let linkURL = parseItemLink(itemEntry.itemLink)

                let item = RequestItem(
                    requestID: savedRequest.id,
                    itemName: itemEntry.itemName.trimmingCharacters(in: .whitespaces),
                    itemDescription: itemEntry.itemDescription.isEmpty ? nil : itemEntry.itemDescription.trimmingCharacters(in: .whitespaces),
                    itemLink: linkURL,
                    storeName: itemEntry.storeName.isEmpty ? nil : itemEntry.storeName.trimmingCharacters(in: .whitespaces),
                    imageData: itemEntry.photoData,
                    isASAP: itemEntry.isASAP,
                    sortOrder: index
                )
                _ = try await CloudKitService.shared.saveItem(item)
            }

            return true

        } catch {
            print("CloudKit submission failed: \(error)")
            return false
        }
    }

    /// Saves the request locally when CloudKit is unavailable
    private func saveLocally(hasASAPItems: Bool) async {
        // Get department name for display
        let deptName = departments.first { $0.id == selectedDepartmentID }?.name ?? "Unknown"

        // Convert items to stored format (including photo data)
        let storedItems = items.enumerated().map { index, itemEntry in
            LocalRequestStore.StoredItem(
                itemName: itemEntry.itemName.trimmingCharacters(in: .whitespaces),
                itemDescription: itemEntry.itemDescription.isEmpty ? nil : itemEntry.itemDescription.trimmingCharacters(in: .whitespaces),
                itemLink: itemEntry.itemLink.isEmpty ? nil : itemEntry.itemLink.trimmingCharacters(in: .whitespaces),
                storeName: itemEntry.storeName.isEmpty ? nil : itemEntry.storeName.trimmingCharacters(in: .whitespaces),
                isASAP: itemEntry.isASAP,
                sortOrder: index,
                imageData: itemEntry.photoData  // Include the photo!
            )
        }

        let storedRequest = LocalRequestStore.StoredRequest(
            requesterName: requesterName.trimmingCharacters(in: .whitespaces),
            requesterMobile: requesterMobile.trimmingCharacters(in: .whitespaces),
            departmentID: selectedDepartmentID,
            departmentName: deptName,
            hasASAPItems: hasASAPItems,
            items: storedItems
        )

        LocalRequestStore.shared.saveRequest(storedRequest)
    }

    /// Parses a user-entered link into a URL
    private func parseItemLink(_ link: String) -> URL? {
        let trimmed = link.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        // Add https:// if no scheme provided
        if !trimmed.contains("://") {
            return URL(string: "https://\(trimmed)")
        }
        return URL(string: trimmed)
    }

    // MARK: - Reset Form

    private func resetForm() {
        // Reset items FIRST (before changing page) to avoid ForEach issues
        items = [ItemEntry()]

        // Reset all form fields
        requesterName = ""
        requesterMobile = ""
        selectedDepartmentID = ""
        errorMessage = nil
        savedOffline = false
        isSubmitting = false
        focusedField = nil

        // Go back to first page LAST with animation to ensure UI updates
        withAnimation {
            currentPage = .yourInfo
        }
    }
}

// MARK: - Preview

#Preview {
    SubmitRequestView()
        .environmentObject(CloudKitSyncEngine())
}
