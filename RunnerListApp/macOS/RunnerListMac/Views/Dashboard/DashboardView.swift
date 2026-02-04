import SwiftUI
import AppKit

// MARK: - macOS App Colors (matching shared dark theme)

enum MacAppColors {
    /// Main page/window background - pure black
    static let backgroundPrimary = Color.black

    /// Card and field background - dark gray #2c2c2e
    static let backgroundSecondary = Color(red: 0.173, green: 0.173, blue: 0.180)

    /// Darker variant for nested elements
    static let backgroundTertiary = Color(red: 0.12, green: 0.12, blue: 0.14)

    /// Even darker for PDF/print backgrounds
    static let backgroundPDF = Color(red: 0.06, green: 0.07, blue: 0.10)
}

// MARK: - Pill Button Style

struct PillButtonStyle: ButtonStyle {
    let backgroundColor: Color
    let foregroundColor: Color

    init(backgroundColor: Color = MacAppColors.backgroundSecondary, foregroundColor: Color = .white) {
        self.backgroundColor = backgroundColor
        self.foregroundColor = foregroundColor
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.medium))
            .foregroundColor(foregroundColor)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(configuration.isPressed ? backgroundColor.opacity(0.8) : backgroundColor)
            .clipShape(Capsule())
    }
}

struct PillButtonProminentStyle: ButtonStyle {
    let tintColor: Color

    init(tintColor: Color = .purple) {
        self.tintColor = tintColor
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundColor(.white)
            .padding(.horizontal, 18)
            .padding(.vertical, 10)
            .background(configuration.isPressed ? tintColor.opacity(0.8) : tintColor)
            .clipShape(Capsule())
    }
}

// MARK: - Runner Status Button
// Red = list ready (waiting to be sent), Yellow = out shopping, Green = available

struct RunnerStatusButton: View {
    let runner: Runner
    let status: RunnerShoppingStatus
    let itemCount: Int
    let onTap: () -> Void

    private var backgroundColor: Color {
        switch status {
        case .available:
            return Color.green.opacity(0.25)  // Green - available
        case .listReady:
            return Color.red.opacity(0.35)    // Red - list ready to send
        case .shopping:
            return Color.yellow.opacity(0.25) // Yellow - out shopping
        }
    }

    private var iconColor: Color {
        switch status {
        case .available:
            return .green
        case .listReady:
            return .red
        case .shopping:
            return .yellow
        }
    }

    private var statusIcon: String {
        switch status {
        case .available:
            return "checkmark.circle.fill"    // Ready for assignments
        case .listReady:
            return "shippingbox.fill"         // Has items, needs to go out
        case .shopping:
            return "figure.run"               // Currently shopping
        }
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 6) {
                Image(systemName: statusIcon)
                    .foregroundColor(iconColor)
                Text(runner.name)
                if itemCount > 0 {
                    Text("(\(itemCount))")
                        .foregroundColor(.white.opacity(0.7))
                }
            }
            .font(.subheadline.weight(.medium))
            .foregroundColor(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(backgroundColor)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Dashboard View

struct DashboardView: View {
    @EnvironmentObject var viewModel: DashboardViewModel
    @State private var showCostInput: String?
    @State private var costInputValue: String = ""
    @State private var selectedRunnerForPDF: Runner?
    @State private var showNewRequestSheet = false

    var body: some View {
        VStack(spacing: 0) {
            // Header with title and actions
            headerBar
                .padding(.horizontal)
                .padding(.vertical, 12)

            Divider()

            // Runner status buttons (always show all runners)
            if !viewModel.runners.isEmpty {
                runnerStatusButtons
                    .padding(.horizontal)
                    .padding(.vertical, 8)

                Divider()
            }

            // Active/Complete toggle and runner filter
            filterBar
                .padding(.horizontal)
                .padding(.vertical, 8)

            Divider()

            // Content
            if viewModel.isLoading && viewModel.items.isEmpty {
                loadingView
            } else if viewModel.filteredItems.isEmpty {
                emptyStateView
            } else {
                itemsList
            }
        }
        .background(MacAppColors.backgroundPrimary)
        .sheet(item: $selectedRunnerForPDF) { runner in
            RunnerListPDFView(
                runner: runner,
                items: viewModel.items(forRunnerID: runner.id),
                departments: viewModel.departments,
                onSend: {
                    // Mark runner as shopping (yellow) when PDF is sent
                    viewModel.markRunnerListSent(runnerID: runner.id)
                    selectedRunnerForPDF = nil  // Dismiss the sheet
                }
            )
        }
        .sheet(isPresented: $showNewRequestSheet) {
            NewRequestView()
                .environmentObject(viewModel)
        }
    }

    // MARK: - Export CSV

    private func exportCSV() {
        let savePanel = NSSavePanel()
        savePanel.allowedContentTypes = [.commaSeparatedText]
        savePanel.nameFieldStringValue = "runner_list_export_\(formattedDateForFilename()).csv"
        savePanel.title = "Export Items to CSV"

        savePanel.begin { response in
            guard response == .OK, let url = savePanel.url else { return }

            var csvContent = "Item Name,Description,Store,Requester,Mobile,Department,Status,Runner,Cost,Link\n"

            for dashboardItem in viewModel.filteredItems {
                let item = dashboardItem.item
                let dept = viewModel.department(for: dashboardItem)?.name ?? ""
                let runner = viewModel.runner(for: dashboardItem)?.name ?? ""
                let cost = item.actualCost.map { String(format: "%.2f", $0) } ?? ""
                let link = item.itemLink?.absoluteString ?? ""

                let row = [
                    escapeCSV(item.itemName),
                    escapeCSV(item.itemDescription ?? ""),
                    escapeCSV(item.storeName ?? ""),
                    escapeCSV(dashboardItem.requesterName),
                    escapeCSV(dashboardItem.requesterMobile),
                    escapeCSV(dept),
                    escapeCSV(item.status.displayName),
                    escapeCSV(runner),
                    cost,
                    escapeCSV(link)
                ].joined(separator: ",")

                csvContent += row + "\n"
            }

            do {
                try csvContent.write(to: url, atomically: true, encoding: .utf8)
            } catch {
                print("Failed to write CSV: \(error)")
            }
        }
    }

    private func escapeCSV(_ string: String) -> String {
        if string.contains(",") || string.contains("\"") || string.contains("\n") {
            return "\"\(string.replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        return string
    }

    private func formattedDateForFilename() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    // MARK: - Runner Status Buttons
    // Red = list ready to send, Yellow = out shopping, Green = available

    private var runnerStatusButtons: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(viewModel.allRunnersWithStatus, id: \.runner.id) { runnerData in
                    RunnerStatusButton(
                        runner: runnerData.runner,
                        status: runnerData.status,
                        itemCount: runnerData.itemCount,
                        onTap: {
                            // Only show PDF popup if runner has items (listReady or shopping)
                            if runnerData.status != .available {
                                selectedRunnerForPDF = runnerData.runner
                            }
                        }
                    )
                }
            }
        }
    }

    // MARK: - Header Bar

    private var headerBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Production Dashboard")
                    .font(.title.weight(.bold))
                    .foregroundColor(.white)

                Text("Manage runner requests and logistics.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Action buttons
            HStack(spacing: 10) {
                Button {
                    showNewRequestSheet = true
                } label: {
                    Label("New Request", systemImage: "plus")
                }
                .buttonStyle(PillButtonStyle())

                Button {
                    exportCSV()
                } label: {
                    Label("Export CSV", systemImage: "arrow.down.doc")
                }
                .buttonStyle(PillButtonStyle())

                Button {
                    Task {
                        await viewModel.refresh()
                    }
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .buttonStyle(PillButtonProminentStyle(tintColor: .blue))
            }
        }
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        HStack(spacing: 16) {
            // Active/Complete toggle (pill style)
            HStack(spacing: 4) {
                PillToggleButton(
                    title: "Active",
                    isSelected: viewModel.showActiveOnly
                ) {
                    viewModel.setActiveOnly(true)
                }

                PillToggleButton(
                    title: "Complete",
                    isSelected: !viewModel.showActiveOnly
                ) {
                    viewModel.setActiveOnly(false)
                }
            }
            .padding(4)
            .background(MacAppColors.backgroundTertiary)
            .clipShape(Capsule())

            Spacer()

            // Search field (pill style)
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.gray)
                TextField("Search items...", text: $viewModel.searchText)
                    .textFieldStyle(.plain)
                    .foregroundColor(.white)
                    .frame(width: 150)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(MacAppColors.backgroundSecondary)
            .clipShape(Capsule())
        }
    }

    // MARK: - Items List

    private var itemsList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(viewModel.filteredItems, id: \.id) { dashboardItem in
                    ItemRowView(
                        dashboardItem: dashboardItem,
                        department: viewModel.department(for: dashboardItem),
                        runner: viewModel.runner(for: dashboardItem),
                        runners: viewModel.runners,
                        showCostInput: $showCostInput,
                        costInputValue: $costInputValue,
                        onAssign: { runnerID in
                            Task {
                                try? await viewModel.assignRunner(runnerID, to: dashboardItem.item.id)
                            }
                        },
                        onMarkPurchased: { cost in
                            Task {
                                try? await viewModel.markPurchased(dashboardItem.item.id, cost: cost)
                            }
                        },
                        onMarkDelivered: {
                            Task {
                                try? await viewModel.markDelivered(dashboardItem.item.id)
                            }
                        },
                        onUndo: {
                            Task {
                                try? await viewModel.undoItemStatus(dashboardItem.item.id)
                            }
                        },
                        onDelete: {
                            Task {
                                try? await viewModel.deleteItem(dashboardItem.item.id)
                            }
                        }
                    )
                }
            }
            .padding()
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack {
            ProgressView()
                .scaleEffect(1.5)
            Text("Loading items...")
                .foregroundColor(.secondary)
                .padding(.top)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "tray")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text(emptyStateMessage)
                .font(.headline)
                .foregroundColor(.secondary)

            if viewModel.selectedFilter != nil {
                Button("Clear Filters") {
                    viewModel.clearFilters()
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyStateMessage: String {
        if !viewModel.showActiveOnly {
            return "No completed items yet"
        } else if viewModel.selectedFilter != nil {
            return "No \(viewModel.selectedFilter!.displayName.lowercased()) items"
        } else if !viewModel.searchText.isEmpty {
            return "No items matching '\(viewModel.searchText)'"
        }
        return "No items yet"
    }
}

// MARK: - Pill Toggle Button

struct PillToggleButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Text(title)
            .font(.subheadline.weight(isSelected ? .semibold : .medium))
            .foregroundColor(isSelected ? .white : .gray)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(isSelected ? Color.blue : Color.clear)
            .clipShape(Capsule())
            .contentShape(Capsule())
            .onTapGesture {
                action()
            }
    }
}

// MARK: - Fixed Height for Item Cards

/// Fixed height for all item row cards - 115px for both item and action cards
private let itemCardFixedHeight: CGFloat = 115

// MARK: - Item Row View (Two-Card Layout with Height Sync)

struct ItemRowView: View {
    let dashboardItem: DashboardItem
    let department: Department?
    let runner: Runner?
    let runners: [Runner]

    // These bindings are no longer used but kept for API compatibility
    @Binding var showCostInput: String?
    @Binding var costInputValue: String

    let onAssign: (String) -> Void
    let onMarkPurchased: (Double?) -> Void
    let onMarkDelivered: () -> Void
    let onUndo: () -> Void
    let onDelete: () -> Void

    @State private var showDeleteConfirmation = false
    @State private var showImagePopover = false
    @State private var isItemCardHovered = false
    @State private var isActionCardHovered = false
    @State private var localCostInput: String = ""  // Each row has its own cost input
    @State private var selectedRunnerID: String = ""  // Local picker state to prevent accidental triggers
    @State private var showMessageCompose = false  // Show in-app message compose sheet
    @State private var showNoCostWarning = false  // Warning when marking purchased without cost

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Left Card: Item Info (fixed height applied in card view)
            itemInfoCard

            // Right Card: Action Panel (fixed height applied in card view)
            actionCard
        }
        .alert("Delete Item?", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                onDelete()
            }
        } message: {
            Text("This action cannot be undone.")
        }
        .alert("No Cost Entered", isPresented: $showNoCostWarning) {
            Button("Go Back", role: .cancel) {}
            Button("Mark Without Cost") {
                onMarkPurchased(nil)
                localCostInput = ""
            }
        } message: {
            Text("You haven't entered a cost for this item. Do you want to mark it as purchased without a cost?")
        }
    }

    // MARK: - Left Card: Item Info

    private var itemInfoCard: some View {
        ZStack(alignment: .topTrailing) {
            HStack(alignment: .top, spacing: 12) {
                // Image thumbnail (if available)
                if let imageData = dashboardItem.item.imageData,
                   let nsImage = NSImage(data: imageData) {
                    Button {
                        showImagePopover = true
                    } label: {
                        Image(nsImage: nsImage)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 70, height: 70)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                    .popover(isPresented: $showImagePopover, arrowEdge: .leading) {
                        Image(nsImage: nsImage)
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: 400, maxHeight: 400)
                            .cornerRadius(8)
                            .padding()
                    }
                }

                // Item details
                VStack(alignment: .leading, spacing: 4) {
                    // Item name + ASAP badge
                    HStack(spacing: 6) {
                        Text(dashboardItem.item.itemName)
                            .font(.headline)
                            .foregroundColor(dashboardItem.item.isASAP ? .red : .primary)
                            .lineLimit(1)

                        if dashboardItem.item.isASAP {
                            Text("ASAP")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 2)
                                .background(Color.red)
                                .clipShape(Capsule())
                        }
                    }

                    // Description
                    if let description = dashboardItem.item.itemDescription, !description.isEmpty {
                        Text(description)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }

                    // Store
                    if let store = dashboardItem.item.storeName, !store.isEmpty {
                        HStack(spacing: 4) {
                            Image(systemName: "storefront.fill")
                                .font(.system(size: 10))
                            Text(store)
                                .font(.caption)
                        }
                        .foregroundColor(.green)
                    }

                    // Link (only show if URL is valid)
                    if let link = dashboardItem.item.itemLink,
                       let host = link.host, !host.isEmpty {
                        Link(destination: link) {
                            HStack(spacing: 4) {
                                Image(systemName: "link")
                                    .font(.system(size: 10))
                                Text("View Item")
                                    .font(.caption)
                            }
                            .foregroundColor(.blue)
                        }
                        .onHover { hovering in
                            if hovering { NSCursor.pointingHand.push() } else { NSCursor.pop() }
                        }
                    }

                    // Requester info (bottom)
                    HStack(spacing: 4) {
                        Image(systemName: "person.fill")
                            .font(.system(size: 9))
                        Text(dashboardItem.requesterName)
                            .font(.caption)
                        Text("·")
                        Text(dashboardItem.requesterMobile)
                            .font(.caption)
                        if let dept = department {
                            Text("·")
                            Text(dept.name)
                                .font(.caption)
                        }
                    }
                    .foregroundColor(.secondary)
                    .padding(.top, 2)
                }

                Spacer(minLength: 0)
            }
            .padding(12)

            // Delete button (top-right, hover only)
            if isItemCardHovered {
                Button {
                    showDeleteConfirmation = true
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .padding(8)
                .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .frame(height: itemCardFixedHeight)
        .background(MacAppColors.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(dashboardItem.item.isASAP ? Color.red.opacity(0.5) : Color.clear, lineWidth: 1.5)
        )
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isItemCardHovered = hovering
            }
        }
    }

    // MARK: - Right Card: Action Panel

    private var actionCard: some View {
        ZStack(alignment: .topTrailing) {
            // Main content centered vertically
            VStack(spacing: 0) {
                Spacer(minLength: 0)
                actionContent
                Spacer(minLength: 0)
            }
            .padding(12)

            // Undo button (top-right corner, hover only) - only if not pending
            if isActionCardHovered && dashboardItem.item.status != .pending {
                Button {
                    onUndo()
                } label: {
                    Image(systemName: "arrow.uturn.backward.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .padding(6)
                .transition(.opacity)
            }
        }
        .frame(width: 180, height: itemCardFixedHeight)
        .background(MacAppColors.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isActionCardHovered = hovering
            }
        }
    }

    // MARK: - Action Content (Single State Logic)

    @ViewBuilder
    private var actionContent: some View {
        switch dashboardItem.item.status {
        // State 1: New (Pending) - "Assign to Me" / Assign Runner
        case .pending:
            VStack(spacing: 8) {
                Text("Assign Runner")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Picker("", selection: $selectedRunnerID) {
                    Text("Select...").tag("")
                    Divider()
                    ForEach(runners) { runner in
                        Text(runner.name).tag(runner.id)
                    }
                }
                .pickerStyle(.menu)
                .frame(maxWidth: .infinity)
                .onChange(of: selectedRunnerID) { oldValue, newValue in
                    // Only trigger assignment when user explicitly selects a runner
                    // and the selection changed from empty to a valid runner
                    if !newValue.isEmpty && oldValue != newValue {
                        onAssign(newValue)
                        // Reset to empty so user can reassign if needed (though item will move to assigned state)
                        selectedRunnerID = ""
                    }
                }
            }

        // State 2: Assigned - Price Input + Mark Purchased
        case .assigned:
            VStack(spacing: 10) {
                if let runner = runner {
                    HStack(spacing: 4) {
                        Image(systemName: "figure.run")
                            .font(.system(size: 10))
                        Text(runner.name)
                            .font(.caption.weight(.medium))
                    }
                    .foregroundColor(.orange)
                }

                // Price input field - uses local state, not shared binding
                TextField("$0.00", text: $localCostInput)
                    .textFieldStyle(.plain)
                    .font(.system(size: 16, weight: .medium))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(MacAppColors.backgroundTertiary)
                    .cornerRadius(8)

                Button {
                    let costString = localCostInput.replacingOccurrences(of: "$", with: "").replacingOccurrences(of: ",", with: "")
                    let cost = Double(costString)

                    // Show warning if no cost entered
                    if cost == nil || costString.trimmingCharacters(in: .whitespaces).isEmpty {
                        showNoCostWarning = true
                    } else {
                        onMarkPurchased(cost)
                        localCostInput = ""
                    }
                } label: {
                    Text("Mark Purchased")
                        .font(.subheadline.weight(.medium))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.regular)
            }

        // State 3: Purchased - Show Price + Text Crew (completes the item)
        case .purchased:
            VStack(spacing: 10) {
                // Display cost prominently in green
                if let cost = dashboardItem.item.actualCost {
                    Text(formattedCost(cost))
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(.green)
                }

                Button {
                    showMessageCompose = true
                } label: {
                    Label("Text Crew", systemImage: "message.fill")
                        .font(.subheadline.weight(.medium))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.blue)
                .controlSize(.regular)
                .sheet(isPresented: $showMessageCompose) {
                    MessageComposeView(
                        recipientName: dashboardItem.requesterName,
                        recipientPhone: dashboardItem.requesterMobile,
                        itemName: dashboardItem.item.itemName,
                        onSend: {
                            showMessageCompose = false
                            onMarkDelivered()
                        },
                        onCancel: {
                            showMessageCompose = false
                        }
                    )
                }
            }

        // State 4: Delivered/Notified - Completed
        case .delivered:
            VStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 36))
                    .foregroundColor(.green)

                Text("Completed")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.green)

                if let cost = dashboardItem.item.actualCost {
                    Text(formattedCost(cost))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }

    private func formattedCost(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        return formatter.string(from: NSNumber(value: amount)) ?? "$\(amount)"
    }
}

// MARK: - Item Status Badge (Compact)

struct ItemStatusBadge: View {
    let status: ItemStatus

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: statusIcon)
                .font(.system(size: 9))
            Text(status.displayName)
                .font(.system(size: 11, weight: .semibold))
        }
        .foregroundColor(statusColor)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(statusColor.opacity(0.15))
        .clipShape(Capsule())
    }

    private var statusIcon: String {
        switch status {
        case .pending: return "clock"
        case .assigned: return "person.badge.clock"
        case .purchased: return "bag.fill"
        case .delivered: return "checkmark.circle.fill"
        }
    }

    private var statusColor: Color {
        switch status {
        case .pending: return .yellow
        case .assigned: return .orange
        case .purchased: return .blue
        case .delivered: return .green
        }
    }
}

// MARK: - Runner List PDF View

struct RunnerListPDFView: View {
    let runner: Runner
    let items: [DashboardItem]
    let departments: [Department]
    let onSend: () -> Void  // Called when PDF is sent, changes runner to shopping status

    @Environment(\.dismiss) private var dismiss
    @State private var isSending = false
    @State private var generatedPDFURL: URL?
    @State private var showCopiedFeedback = false

    var body: some View {
        VStack(spacing: 0) {
            // Header with title and action buttons
            HStack(spacing: 12) {
                // Cancel button
                Button("Cancel") {
                    dismiss()
                }
                .buttonStyle(.plain)
                .foregroundColor(.secondary)

                Spacer()

                // Action buttons in header
                if let pdfURL = generatedPDFURL {
                    // Show feedback after clicking Send
                    if showCopiedFeedback {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                            Text("PDF copied! Paste in Messages (⌘V)")
                                .font(.caption)
                                .foregroundColor(.green)
                        }
                        .transition(.opacity)
                    }

                    // Send via Messages button
                    Button {
                        sendViaMessages(pdfURL: pdfURL)
                    } label: {
                        Label("Send via Messages", systemImage: "message.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.blue)
                } else {
                    ProgressView()
                        .scaleEffect(0.7)
                }
            }
            .padding()
            .background(MacAppColors.backgroundPrimary)
            .animation(.easeInOut(duration: 0.2), value: showCopiedFeedback)

            Divider()

            // Preview content - show actual PDF layout
            ScrollView {
                PDFContentView(runner: runner, items: items, departments: departments)
                    .scaleEffect(0.95)  // Slightly smaller to fit in window
            }
            .background(MacAppColors.backgroundPDF)
        }
        .frame(width: 420, height: 880)  // Match PDF aspect ratio
        .onAppear {
            // Generate PDF for sharing on appear
            generateTempPDF()
        }
        .onDisappear {
            // Clean up temp file
            if let url = generatedPDFURL {
                try? FileManager.default.removeItem(at: url)
            }
        }
    }

    /// Opens Messages app with the runner's phone number and copies PDF to clipboard for easy pasting
    private func sendViaMessages(pdfURL: URL) {
        // First, copy the PDF to clipboard so user can paste it
        copyPDFToClipboard(pdfURL: pdfURL)

        // Format phone number - remove non-digits for the URL
        let phoneDigits = runner.phoneNumber.filter { $0.isNumber }

        // Open Messages with the phone number
        // Using imessage:// scheme which works better for iMessage
        if let messagesURL = URL(string: "imessage://+1\(phoneDigits)") {
            NSWorkspace.shared.open(messagesURL)
        } else if let smsURL = URL(string: "sms://+1\(phoneDigits)") {
            // Fallback to sms:// scheme
            NSWorkspace.shared.open(smsURL)
        }

        // Mark runner as shopping and close the sheet
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            onSend()
        }
    }

    /// Copies the PDF file to the system clipboard
    private func copyPDFToClipboard(pdfURL: URL) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()

        // Write the file URL to pasteboard - this allows pasting the PDF as a file
        pasteboard.writeObjects([pdfURL as NSURL])

        // Show feedback
        showCopiedFeedback = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            showCopiedFeedback = false
        }
    }

    private func generateTempPDF() {
        let tempDir = FileManager.default.temporaryDirectory
        let fileName = "\(runner.name.replacingOccurrences(of: " ", with: "_"))_Shopping_List_\(formattedDate()).pdf"
        let tempURL = tempDir.appendingPathComponent(fileName)

        createPDF(at: tempURL)
        generatedPDFURL = tempURL
    }

    private func createPDF(at url: URL) {
        // Create PDF content view - mobile phone aspect ratio
        let pdfView = PDFContentView(runner: runner, items: items, departments: departments)
            .frame(width: 390, height: 844)
            .background(MacAppColors.backgroundPDF)

        // Mobile dimensions (iPhone aspect ratio)
        let pdfWidth: CGFloat = 390
        let pdfHeight: CGFloat = 844

        // Render using ImageRenderer
        let renderer = ImageRenderer(content: pdfView)
        renderer.scale = 2.0

        // Render directly to PDF
        renderer.render { size, renderFunction in
            var mediaBox = CGRect(origin: .zero, size: CGSize(width: pdfWidth, height: pdfHeight))

            guard let consumer = CGDataConsumer(url: url as CFURL),
                  let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
                return
            }

            context.beginPDFPage(nil)

            // The key fix: don't flip - render as-is for PDF
            // Scale to fit the media box
            let scaleX = pdfWidth / size.width
            let scaleY = pdfHeight / size.height
            context.scaleBy(x: scaleX, y: scaleY)

            renderFunction(context)

            context.endPDFPage()
            context.closePDF()
        }
    }

    private func formattedDate() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}

// MARK: - PDF Content View (for rendering - Mobile format)

struct PDFContentView: View {
    let runner: Runner
    let items: [DashboardItem]
    let departments: [Department]
    let venue: String?  // Optional venue/location

    // Mobile phone aspect ratio
    private let pdfWidth: CGFloat = 390
    private let pdfHeight: CGFloat = 844

    // Dark theme colors
    private let bgColor = MacAppColors.backgroundPDF
    private let cardBorderColor = Color(red: 0.2, green: 0.22, blue: 0.28)

    init(runner: Runner, items: [DashboardItem], departments: [Department], venue: String? = nil) {
        self.runner = runner
        self.items = items
        self.departments = departments
        self.venue = venue
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(alignment: .top) {
                // Left side: Title and runner name
                VStack(alignment: .leading, spacing: 2) {
                    Text("Runner List - \(String(format: "%02d", items.count))")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.white)

                    Text(runner.name)
                        .font(.system(size: 14))
                        .foregroundColor(Color.white.opacity(0.6))
                }

                Spacer()

                // Right side: Date and venue
                VStack(alignment: .trailing, spacing: 2) {
                    Text(shortDate())
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.white)

                    if let venue = venue, !venue.isEmpty {
                        Text(venue)
                            .font(.system(size: 14))
                            .foregroundColor(Color.white.opacity(0.6))
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 24)
            .padding(.bottom, 16)

            // Items list (no ScrollView for PDF rendering)
            VStack(spacing: 12) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    DarkPDFItemCard(
                        index: index + 1,
                        item: item,
                        borderColor: cardBorderColor
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)

            Spacer(minLength: 0)

            // Fun fact quote at bottom
            VStack(spacing: 16) {
                // Quote card
                Text("\"\(randomFunFact())\"")
                    .font(.system(size: 13, weight: .medium).italic())
                    .foregroundColor(Color.white.opacity(0.8))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 16)
                    .frame(maxWidth: .infinity)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                            .foregroundColor(cardBorderColor)
                    )
                    .padding(.horizontal, 16)

                // Generated timestamp
                Text("Generated: \(formattedTimestamp())")
                    .font(.system(size: 11))
                    .foregroundColor(Color.white.opacity(0.3))
                    .padding(.bottom, 16)
            }
        }
        .frame(width: pdfWidth, height: pdfHeight)
        .background(bgColor)
    }

    private func shortDate() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: Date())
    }

    private func formattedTimestamp() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, h:mm:ss a"
        return formatter.string(from: Date())
    }

    private func randomFunFact() -> String {
        // Placeholder fun facts - can be replaced with a proper list later
        let facts = [
            "Ink: Bruno Mars has a tattoo of his mother's name, \"Bernadette,\" on his shoulder to honor her memory.",
            "The first concert ever held at Madison Square Garden was a boxing match in 1879.",
            "The longest concert ever performed lasted 453 hours.",
            "Queen's \"Bohemian Rhapsody\" took three weeks to record.",
            "The term \"roadie\" originated in the 1960s rock music scene."
        ]
        return facts.randomElement() ?? facts[0]
    }
}

// MARK: - Dark Theme PDF Item Card

struct DarkPDFItemCard: View {
    let index: Int
    let item: DashboardItem
    let borderColor: Color

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Left content
            VStack(alignment: .leading, spacing: 6) {
                // Item number and name
                Text("\(index). \(item.item.itemName)")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(item.item.isASAP ? .red : .white)

                // Description
                if let description = item.item.itemDescription, !description.isEmpty {
                    Text(description)
                        .font(.system(size: 13))
                        .foregroundColor(Color.white.opacity(0.7))
                }

                // Link - show as clickable hyperlink text (only if URL is valid)
                if let link = item.item.itemLink,
                   let host = link.host, !host.isEmpty {
                    Link(destination: link) {
                        HStack(spacing: 4) {
                            Image(systemName: "link")
                                .font(.system(size: 10))
                            Text("Click for product page")
                                .font(.system(size: 11))
                        }
                        .foregroundColor(Color(red: 0.3, green: 0.5, blue: 1.0))
                    }
                }

                // Store
                if let store = item.item.storeName {
                    Text("Suggested Store: \(store)")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color(red: 0.2, green: 0.8, blue: 0.4))
                }

                // Requester info
                Text("Req by: \(item.requesterName) (\(item.requesterMobile))")
                    .font(.system(size: 12))
                    .foregroundColor(Color.white.opacity(0.5))
            }

            Spacer()

            // Right side: Product image (only if available)
            if let imageData = item.item.imageData,
               let nsImage = NSImage(data: imageData) {
                Image(nsImage: nsImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 70, height: 70)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
        .padding(16)
        .background(Color(red: 0.08, green: 0.09, blue: 0.12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                .foregroundColor(borderColor)
        )
        .cornerRadius(12)
    }
}

// MARK: - Message Compose View (In-App SMS Compose)

struct MessageComposeView: View {
    let recipientName: String
    let recipientPhone: String
    let itemName: String
    let onSend: () -> Void
    let onCancel: () -> Void

    @State private var messageText: String = ""
    @State private var isSending = false
    @State private var sendError: String?

    init(recipientName: String, recipientPhone: String, itemName: String, onSend: @escaping () -> Void, onCancel: @escaping () -> Void) {
        self.recipientName = recipientName
        self.recipientPhone = recipientPhone
        self.itemName = itemName
        self.onSend = onSend
        self.onCancel = onCancel
        // Pre-fill the message
        _messageText = State(initialValue: "Your \(itemName) is in the production office. Please come pick it up at your convenience.")
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Button("Cancel") {
                    onCancel()
                }
                .keyboardShortcut(.cancelAction)

                Spacer()

                Text("New Message")
                    .font(.headline)

                Spacer()

                Button {
                    sendMessage()
                } label: {
                    if isSending {
                        ProgressView()
                            .scaleEffect(0.8)
                    } else {
                        Text("Send")
                            .fontWeight(.semibold)
                    }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(isSending || messageText.isEmpty)
            }
            .padding()
            .background(MacAppColors.backgroundSecondary)

            Divider()

            // Recipient field
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("To:")
                        .foregroundColor(.secondary)
                        .frame(width: 40, alignment: .leading)

                    HStack(spacing: 8) {
                        Image(systemName: "person.circle.fill")
                            .foregroundColor(.blue)
                        Text(recipientName)
                            .fontWeight(.medium)
                        Text("(\(recipientPhone))")
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(MacAppColors.backgroundTertiary)
                    .cornerRadius(8)

                    Spacer()
                }
                .padding(.horizontal)
                .padding(.top, 12)

                Divider()
                    .padding(.top, 8)
            }

            // Message body
            VStack(alignment: .leading, spacing: 8) {
                Text("Message:")
                    .foregroundColor(.secondary)
                    .padding(.horizontal)
                    .padding(.top, 8)

                TextEditor(text: $messageText)
                    .font(.body)
                    .scrollContentBackground(.hidden)
                    .background(MacAppColors.backgroundTertiary)
                    .cornerRadius(8)
                    .padding(.horizontal)
                    .frame(minHeight: 120)
            }

            // Error message if any
            if let error = sendError {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.orange)
                }
                .padding(.horizontal)
                .padding(.top, 8)
            }

            Spacer()

            // Preview of how it will look
            VStack(alignment: .leading, spacing: 4) {
                Text("Preview")
                    .font(.caption)
                    .foregroundColor(.secondary)

                HStack {
                    Spacer()
                    Text(messageText)
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .padding(12)
                        .background(Color.blue)
                        .cornerRadius(16)
                        .frame(maxWidth: 280, alignment: .trailing)
                }
            }
            .padding()
            .background(MacAppColors.backgroundTertiary)
        }
        .frame(width: 420, height: 400)
        .background(MacAppColors.backgroundPrimary)
    }

    private func sendMessage() {
        isSending = true
        sendError = nil

        // Use AppleScript to send via Messages app without bringing it to foreground
        let script = """
        tell application "Messages"
            set targetService to 1st service whose service type = iMessage
            set targetBuddy to buddy "\(recipientPhone)" of targetService
            send "\(messageText.replacingOccurrences(of: "\"", with: "\\\""))" to targetBuddy
        end tell
        """

        var error: NSDictionary?
        if let appleScript = NSAppleScript(source: script) {
            appleScript.executeAndReturnError(&error)

            if let error = error {
                // If iMessage fails, try SMS URL scheme as fallback
                let encodedMessage = messageText.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
                if let url = URL(string: "sms:\(recipientPhone)&body=\(encodedMessage)") {
                    NSWorkspace.shared.open(url)
                }
                // Still mark as sent since user will complete in Messages
                onSend()
            } else {
                // Success - message sent via iMessage
                onSend()
            }
        } else {
            // Fallback to URL scheme
            let encodedMessage = messageText.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
            if let url = URL(string: "sms:\(recipientPhone)&body=\(encodedMessage)") {
                NSWorkspace.shared.open(url)
            }
            onSend()
        }

        isSending = false
    }
}

// MARK: - Preview

#Preview {
    DashboardView()
        .environmentObject(DashboardViewModel())
        .frame(width: 900, height: 600)
}
