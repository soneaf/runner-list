import SwiftUI

// MARK: - New Request View

struct NewRequestView: View {
    @EnvironmentObject var viewModel: DashboardViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var requesterName: String = ""
    @State private var requesterMobile: String = ""
    @State private var selectedDepartmentID: String = ""
    @State private var items: [NewItemEntry] = [NewItemEntry()]

    @State private var isSubmitting: Bool = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            // Header
            header

            Divider()

            // Form
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Requester Info
                    requesterSection

                    Divider()

                    // Items
                    itemsSection
                }
                .padding(24)
            }

            Divider()

            // Footer
            footer
        }
        .frame(width: 600, height: 700)
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("New Request")
                    .font(.title2.weight(.bold))
                Text("Submit a new request for the logistics team")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button {
                dismiss()
            } label: {
                Text("Cancel")
            }
            .buttonStyle(PillButtonStyle())
            .keyboardShortcut(.cancelAction)
        }
        .padding()
    }

    // MARK: - Requester Section

    private var requesterSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Requester Information")
                .font(.headline)

            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Name")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    TextField("Full Name", text: $requesterName)
                        .textFieldStyle(.plain)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(MacAppColors.backgroundSecondary)
                        .clipShape(Capsule())
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Mobile")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    TextField("(555) 123-4567", text: $requesterMobile)
                        .textFieldStyle(.plain)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(MacAppColors.backgroundSecondary)
                        .clipShape(Capsule())
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("Department")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Picker("Department", selection: $selectedDepartmentID) {
                    Text("Select Department").tag("")
                    ForEach(viewModel.departments) { dept in
                        Text(dept.name).tag(dept.id)
                    }
                }
                .pickerStyle(.menu)
            }
        }
    }

    // MARK: - Items Section

    private var itemsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Items")
                    .font(.headline)

                Spacer()

                Button(action: addItem) {
                    Label("Add Item", systemImage: "plus")
                }
                .buttonStyle(PillButtonStyle())
            }

            ForEach($items) { $item in
                ItemEntryView(item: $item, canDelete: items.count > 1) {
                    removeItem(item)
                }
            }
        }
    }

    // MARK: - Footer

    private var footer: some View {
        HStack {
            if let error = errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundColor(.red)
            }

            Spacer()

            Button {
                submitRequest()
            } label: {
                Text("Submit Request")
            }
            .buttonStyle(PillButtonProminentStyle(tintColor: .blue))
            .disabled(!isFormValid || isSubmitting)
            .opacity((!isFormValid || isSubmitting) ? 0.5 : 1.0)
            .keyboardShortcut(.defaultAction)
        }
        .padding()
    }

    // MARK: - Validation

    private var isFormValid: Bool {
        !requesterName.isEmpty &&
        !requesterMobile.isEmpty &&
        !selectedDepartmentID.isEmpty &&
        items.contains { !$0.name.isEmpty }
    }

    // MARK: - Actions

    private func addItem() {
        items.append(NewItemEntry())
    }

    private func removeItem(_ item: NewItemEntry) {
        items.removeAll { $0.id == item.id }
    }

    /// Saves the request to SharedFileStore for cross-app access and persistence
    private func saveToSharedStore(request: Request, items: [RequestItem]) {
        let deptName = viewModel.departments.first { $0.id == request.departmentID }?.name ?? "Unknown"

        let sharedItems = items.map { item in
            SharedFileStore.StoredItem(
                id: item.id,
                itemName: item.itemName,
                itemDescription: item.itemDescription,
                itemLink: item.itemLink?.absoluteString,
                storeName: item.storeName,
                isASAP: item.isASAP,
                sortOrder: item.sortOrder,
                imageData: item.imageData,
                status: "pending"
            )
        }

        let sharedRequest = SharedFileStore.StoredRequest(
            id: request.id,
            requesterName: request.requesterName,
            requesterMobile: request.requesterMobile,
            departmentID: request.departmentID,
            departmentName: deptName,
            hasASAPItems: request.hasASAPItems,
            items: sharedItems,
            createdAt: request.createdAt
        )

        SharedFileStore.shared.saveRequest(sharedRequest)
    }

    private func submitRequest() {
        guard isFormValid else { return }

        isSubmitting = true
        errorMessage = nil

        Task {
            // Create the request
            let validItems = items.filter { !$0.name.isEmpty }
            let hasASAP = validItems.contains { $0.isASAP }

            let request = Request(
                requesterName: requesterName,
                requesterMobile: requesterMobile,
                departmentID: selectedDepartmentID,
                hasASAPItems: hasASAP,
                itemCount: validItems.count
            )

            // Create RequestItems
            var requestItems: [RequestItem] = []
            for (index, itemEntry) in validItems.enumerated() {
                var linkURL: URL? = nil
                if !itemEntry.link.isEmpty {
                    let trimmed = itemEntry.link.trimmingCharacters(in: .whitespaces)
                    if !trimmed.contains("://") {
                        linkURL = URL(string: "https://\(trimmed)")
                    } else {
                        linkURL = URL(string: trimmed)
                    }
                }

                let item = RequestItem(
                    requestID: request.id,
                    itemName: itemEntry.name,
                    itemDescription: itemEntry.description.isEmpty ? nil : itemEntry.description,
                    itemLink: linkURL,
                    storeName: itemEntry.store.isEmpty ? nil : itemEntry.store,
                    imageData: itemEntry.imageData,
                    isASAP: itemEntry.isASAP,
                    sortOrder: index
                )
                requestItems.append(item)
            }

            // Try CloudKit first, fall back to demo mode
            if CloudKitService.shared.isCloudKitAvailable {
                do {
                    let savedRequest = try await CloudKitService.shared.saveRequest(request)
                    for var item in requestItems {
                        item.requestID = savedRequest.id
                        _ = try await CloudKitService.shared.saveItem(item)
                    }
                } catch {
                    await MainActor.run {
                        errorMessage = error.localizedDescription
                        isSubmitting = false
                    }
                    return
                }
            } else {
                // Demo mode: Add directly to the ViewModel's items array AND SharedDataStore
                await MainActor.run {
                    for item in requestItems {
                        let dashboardItem = DashboardItem(item: item, request: request)
                        viewModel.items.append(dashboardItem)
                    }

                    // Also save to SharedDataStore for persistence across app launches
                    saveToSharedStore(request: request, items: requestItems)
                }
            }

            // Dismiss
            await MainActor.run {
                isSubmitting = false
                dismiss()
            }
        }
    }
}

// MARK: - New Item Entry

struct NewItemEntry: Identifiable {
    let id = UUID()
    var name: String = ""
    var description: String = ""
    var link: String = ""
    var store: String = ""
    var isASAP: Bool = false
    var imageData: Data? = nil
}

// MARK: - Item Entry View

struct ItemEntryView: View {
    @Binding var item: NewItemEntry
    let canDelete: Bool
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Item")
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.secondary)

                Spacer()

                // ASAP toggle as pill button
                Button {
                    item.isASAP.toggle()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.triangle.fill")
                        Text("ASAP")
                    }
                    .font(.caption.weight(.bold))
                    .foregroundColor(item.isASAP ? .white : .red)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(item.isASAP ? Color.red : Color.red.opacity(0.15))
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)

                if canDelete {
                    Button(role: .destructive, action: onDelete) {
                        Image(systemName: "trash")
                            .foregroundColor(.red)
                    }
                    .buttonStyle(.plain)
                }
            }

            TextField("Item Name (required)", text: $item.name)
                .textFieldStyle(.plain)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(MacAppColors.backgroundSecondary)
                .clipShape(Capsule())

            TextField("Description / Details", text: $item.description)
                .textFieldStyle(.plain)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(MacAppColors.backgroundSecondary)
                .clipShape(Capsule())

            HStack(spacing: 12) {
                TextField("Link (optional)", text: $item.link)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(MacAppColors.backgroundSecondary)
                    .clipShape(Capsule())

                TextField("Suggested Store", text: $item.store)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(MacAppColors.backgroundSecondary)
                    .clipShape(Capsule())
                    .frame(width: 160)
            }

            // Photo picker
            HStack(spacing: 12) {
                Button {
                    selectPhoto()
                } label: {
                    Label(item.imageData != nil ? "Change Photo" : "Add Photo", systemImage: "photo")
                }
                .buttonStyle(PillButtonStyle(backgroundColor: Color.blue.opacity(0.15), foregroundColor: .blue))

                if item.imageData != nil {
                    Button {
                        item.imageData = nil
                    } label: {
                        Label("Remove", systemImage: "xmark")
                    }
                    .buttonStyle(PillButtonStyle(backgroundColor: Color.red.opacity(0.15), foregroundColor: .red))

                    // Show thumbnail
                    if let data = item.imageData, let nsImage = NSImage(data: data) {
                        Image(nsImage: nsImage)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 40, height: 40)
                            .clipShape(Capsule())
                    }
                }

                Spacer()
            }
        }
        .padding(16)
        .background(MacAppColors.backgroundTertiary)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(item.isASAP ? Color.red.opacity(0.5) : Color.gray.opacity(0.2), lineWidth: 1)
        )
    }

    private func selectPhoto() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.image]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false

        if panel.runModal() == .OK, let url = panel.url {
            if let imageData = try? Data(contentsOf: url) {
                // Compress if needed
                if let nsImage = NSImage(data: imageData) {
                    item.imageData = compressImage(nsImage, maxDimension: 1200)
                }
            }
        }
    }

    private func compressImage(_ image: NSImage, maxDimension: CGFloat) -> Data? {
        let size = image.size
        let scale = min(maxDimension / size.width, maxDimension / size.height, 1.0)
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)

        let newImage = NSImage(size: newSize)
        newImage.lockFocus()
        image.draw(in: NSRect(origin: .zero, size: newSize),
                   from: NSRect(origin: .zero, size: size),
                   operation: .copy,
                   fraction: 1.0)
        newImage.unlockFocus()

        guard let tiffData = newImage.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiffData) else {
            return nil
        }

        return bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.8])
    }
}

// MARK: - Preview

#Preview {
    NewRequestView()
        .environmentObject(DashboardViewModel())
}
