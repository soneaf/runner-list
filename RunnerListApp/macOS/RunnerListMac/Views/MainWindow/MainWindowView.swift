import SwiftUI

// MARK: - Main Window View

struct MainWindowView: View {
    @EnvironmentObject var dashboardViewModel: DashboardViewModel
    @EnvironmentObject var settingsViewModel: SettingsViewModel

    @State private var selectedSidebarItem: SidebarItem = .dashboard
    @State private var showNewRequestSheet = false

    var body: some View {
        NavigationSplitView {
            SidebarView(selectedItem: $selectedSidebarItem)
        } detail: {
            detailView
        }
        .navigationTitle(selectedSidebarItem.title)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                toolbarButtons
            }
        }
        .sheet(isPresented: $showNewRequestSheet) {
            NewRequestView()
                .environmentObject(dashboardViewModel)
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            // Auto-refresh when app becomes active (e.g., after switching from another app)
            Task {
                await dashboardViewModel.loadData()
            }
        }
    }

    // MARK: - Detail View

    @ViewBuilder
    private var detailView: some View {
        switch selectedSidebarItem {
        case .dashboard:
            DashboardView()
        case .runners:
            RunnerManagementView()
                .environmentObject(settingsViewModel)
        case .departments:
            DepartmentManagementView()
                .environmentObject(settingsViewModel)
        case .schedule:
            ScheduleManagementView()
                .environmentObject(settingsViewModel)
        case .settings:
            AppSettingsView()
                .environmentObject(settingsViewModel)
        }
    }

    // MARK: - Toolbar

    @ViewBuilder
    private var toolbarButtons: some View {
        Button(action: { showNewRequestSheet = true }) {
            Label("New Request", systemImage: "plus")
        }

        Button(action: {
            Task {
                await dashboardViewModel.refresh()
            }
        }) {
            Label("Refresh", systemImage: "arrow.clockwise")
        }
        .disabled(dashboardViewModel.isLoading)
    }
}

// MARK: - Sidebar Item

enum SidebarItem: String, CaseIterable, Identifiable {
    case dashboard
    case runners
    case departments
    case schedule
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .runners: return "Runners"
        case .departments: return "Departments"
        case .schedule: return "Tour Schedule"
        case .settings: return "Settings"
        }
    }

    var icon: String {
        switch self {
        case .dashboard: return "rectangle.grid.2x2"
        case .runners: return "person.2"
        case .departments: return "building.2"
        case .schedule: return "calendar"
        case .settings: return "gear"
        }
    }
}

// MARK: - Sidebar View

struct SidebarView: View {
    @Binding var selectedItem: SidebarItem
    @EnvironmentObject var dashboardViewModel: DashboardViewModel

    var body: some View {
        List(selection: $selectedItem) {
            Section("Main") {
                ForEach([SidebarItem.dashboard], id: \.id) { item in
                    sidebarRow(for: item)
                }
            }

            Section("Management") {
                ForEach([SidebarItem.runners, .departments, .schedule], id: \.id) { item in
                    sidebarRow(for: item)
                }
            }

            Section {
                ForEach([SidebarItem.settings], id: \.id) { item in
                    sidebarRow(for: item)
                }
            }
        }
        .listStyle(.sidebar)
        .frame(minWidth: 200)
    }

    private func sidebarRow(for item: SidebarItem) -> some View {
        Label {
            HStack {
                Text(item.title)
                Spacer()
                if item == .dashboard {
                    badge
                }
            }
        } icon: {
            Image(systemName: item.icon)
        }
        .tag(item)
    }

    @ViewBuilder
    private var badge: some View {
        let pending = dashboardViewModel.pendingCount
        if pending > 0 {
            Text("\(pending)")
                .font(.caption2.weight(.bold))
                .foregroundColor(.white)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.red)
                .clipShape(Capsule())
        }
    }
}

// MARK: - Placeholder Views

struct RunnerManagementView: View {
    @EnvironmentObject var viewModel: SettingsViewModel
    @State private var showAddRunnerSheet = false

    var body: some View {
        VStack(spacing: 0) {
            // Header with Add Runner button
            HStack {
                Text("Runners")
                    .font(.title2.weight(.semibold))

                Spacer()

                Button {
                    showAddRunnerSheet = true
                } label: {
                    Label("Add Runner", systemImage: "plus")
                }
                .buttonStyle(PillButtonProminentStyle(tintColor: .blue))
            }
            .padding()

            Divider()

            // Runner list
            if viewModel.runners.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "person.2.slash")
                        .font(.system(size: 48))
                        .foregroundColor(.secondary)
                    Text("No Runners")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    Text("Click \"Add Runner\" to add your first runner.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(viewModel.runners) { runner in
                        RunnerRow(runner: runner)
                            .environmentObject(viewModel)
                    }
                }
            }
        }
        .task {
            await viewModel.loadData()
        }
        .sheet(isPresented: $showAddRunnerSheet) {
            AddRunnerView()
                .environmentObject(viewModel)
        }
    }
}

// MARK: - Runner Row

struct RunnerRow: View {
    let runner: Runner
    @EnvironmentObject var viewModel: SettingsViewModel
    @State private var showDeleteConfirmation = false

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            Circle()
                .fill(Color.blue.opacity(0.2))
                .frame(width: 44, height: 44)
                .overlay(
                    Text(runner.initials)
                        .font(.subheadline.weight(.bold))
                        .foregroundColor(.blue)
                )

            // Info
            VStack(alignment: .leading, spacing: 2) {
                Text(runner.name)
                    .font(.headline)

                HStack(spacing: 8) {
                    if !runner.phoneNumber.isEmpty {
                        Label(runner.formattedPhone, systemImage: "phone")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    if let city = runner.city, !city.isEmpty {
                        Label(city, systemImage: "mappin")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Spacer()

            // Delete button
            Button {
                showDeleteConfirmation = true
            } label: {
                Image(systemName: "trash")
                    .foregroundColor(.red)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 6)
        .alert("Delete Runner?", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task {
                    await viewModel.deleteRunner(runner)
                }
            }
        } message: {
            Text("Are you sure you want to delete \(runner.name)? This action cannot be undone.")
        }
    }
}

// MARK: - Add Runner View (Sheet)

struct AddRunnerView: View {
    @EnvironmentObject var viewModel: SettingsViewModel
    @Environment(\.dismiss) private var dismiss

    @FocusState private var focusedField: Field?

    enum Field: Hashable {
        case name
        case phone
        case city
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Button {
                    clearAndDismiss()
                } label: {
                    Text("Cancel")
                }
                .buttonStyle(PillButtonStyle())
                .keyboardShortcut(.cancelAction)

                Spacer()

                Text("Add Runner")
                    .font(.headline)

                Spacer()

                Button {
                    addRunner()
                } label: {
                    Text("Add")
                }
                .buttonStyle(PillButtonProminentStyle(tintColor: .blue))
                .keyboardShortcut(.defaultAction)
                .disabled(viewModel.newRunnerName.trimmingCharacters(in: .whitespaces).isEmpty)
                .opacity(viewModel.newRunnerName.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1.0)
            }
            .padding()
            .background(MacAppColors.backgroundPrimary)

            Divider()

            // Form content
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Icon and title
                    HStack {
                        Spacer()
                        VStack(spacing: 12) {
                            Image(systemName: "person.badge.plus")
                                .font(.system(size: 56))
                                .foregroundStyle(.blue)

                            Text("New Runner")
                                .font(.title.weight(.semibold))

                            Text("Enter the runner's information below.")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                    }
                    .padding(.top, 20)

                    // Form fields
                    VStack(spacing: 20) {
                        // Name field
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Name")
                                .font(.headline)
                            TextField("Runner's full name", text: $viewModel.newRunnerName)
                                .textFieldStyle(.plain)
                                .font(.body)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 12)
                                .background(MacAppColors.backgroundSecondary)
                                .clipShape(Capsule())
                                .focused($focusedField, equals: .name)
                        }

                        // Phone field
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Phone Number")
                                .font(.headline)
                            TextField("(555) 123-4567", text: $viewModel.newRunnerPhone)
                                .textFieldStyle(.plain)
                                .font(.body)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 12)
                                .background(MacAppColors.backgroundSecondary)
                                .clipShape(Capsule())
                                .focused($focusedField, equals: .phone)
                        }

                        // City field
                        VStack(alignment: .leading, spacing: 8) {
                            Text("City")
                                .font(.headline)
                            TextField("Current city or location", text: $viewModel.newRunnerCity)
                                .textFieldStyle(.plain)
                                .font(.body)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 12)
                                .background(MacAppColors.backgroundSecondary)
                                .clipShape(Capsule())
                                .focused($focusedField, equals: .city)

                            Text("Optional - helps identify which city this runner is based in")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.horizontal, 40)
                    .padding(.top, 20)

                    Spacer(minLength: 40)
                }
            }
        }
        .frame(width: 500, height: 580)
        .onAppear {
            focusedField = .name
        }
    }

    private func addRunner() {
        Task {
            await viewModel.addRunner()
            dismiss()
        }
    }

    private func clearAndDismiss() {
        viewModel.newRunnerName = ""
        viewModel.newRunnerPhone = ""
        viewModel.newRunnerCity = ""
        dismiss()
    }
}

struct DepartmentManagementView: View {
    @EnvironmentObject var viewModel: SettingsViewModel
    @State private var showAddDepartmentSheet = false

    var body: some View {
        VStack(spacing: 0) {
            // Header with Add Department button
            HStack {
                Text("Departments")
                    .font(.title2.weight(.semibold))

                Spacer()

                Button {
                    showAddDepartmentSheet = true
                } label: {
                    Label("Add Department", systemImage: "plus")
                }
                .buttonStyle(PillButtonProminentStyle(tintColor: .blue))
            }
            .padding()

            Divider()

            // Department list
            if viewModel.departments.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "folder.badge.questionmark")
                        .font(.system(size: 48))
                        .foregroundColor(.secondary)
                    Text("No Departments")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    Text("Click \"Add Department\" to add your first department.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(viewModel.departments) { dept in
                        DepartmentRow(department: dept)
                            .environmentObject(viewModel)
                    }
                }
            }
        }
        .task {
            await viewModel.loadData()
        }
        .sheet(isPresented: $showAddDepartmentSheet) {
            AddDepartmentView()
                .environmentObject(viewModel)
        }
    }
}

// MARK: - Department Row

struct DepartmentRow: View {
    let department: Department
    @EnvironmentObject var viewModel: SettingsViewModel
    @State private var showDeleteConfirmation = false

    var body: some View {
        HStack(spacing: 12) {
            // Icon
            Circle()
                .fill(Color.purple.opacity(0.2))
                .frame(width: 44, height: 44)
                .overlay(
                    Image(systemName: "folder.fill")
                        .foregroundColor(.purple)
                )

            // Info
            Text(department.name)
                .font(.headline)

            Spacer()

            // Delete button
            Button {
                showDeleteConfirmation = true
            } label: {
                Image(systemName: "trash")
                    .foregroundColor(.red)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 6)
        .alert("Delete Department?", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task {
                    await viewModel.deleteDepartment(department)
                }
            }
        } message: {
            Text("Are you sure you want to delete \(department.name)? This action cannot be undone.")
        }
    }
}

// MARK: - Add Department View (Sheet)

struct AddDepartmentView: View {
    @EnvironmentObject var viewModel: SettingsViewModel
    @Environment(\.dismiss) private var dismiss

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Button {
                    clearAndDismiss()
                } label: {
                    Text("Cancel")
                }
                .buttonStyle(PillButtonStyle())
                .keyboardShortcut(.cancelAction)

                Spacer()

                Text("Add Department")
                    .font(.headline)

                Spacer()

                Button {
                    addDepartment()
                } label: {
                    Text("Add")
                }
                .buttonStyle(PillButtonProminentStyle(tintColor: .blue))
                .keyboardShortcut(.defaultAction)
                .disabled(viewModel.newDepartmentName.trimmingCharacters(in: .whitespaces).isEmpty)
                .opacity(viewModel.newDepartmentName.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1.0)
            }
            .padding()
            .background(MacAppColors.backgroundPrimary)

            Divider()

            // Form content
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Icon and title
                    HStack {
                        Spacer()
                        VStack(spacing: 12) {
                            Image(systemName: "folder.badge.plus")
                                .font(.system(size: 56))
                                .foregroundStyle(.purple)

                            Text("New Department")
                                .font(.title.weight(.semibold))

                            Text("Enter the department name below.")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                    }
                    .padding(.top, 20)

                    // Form fields
                    VStack(spacing: 20) {
                        // Name field
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Department Name")
                                .font(.headline)
                            TextField("e.g., Audio, Lighting, Video", text: $viewModel.newDepartmentName)
                                .textFieldStyle(.plain)
                                .font(.body)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 12)
                                .background(MacAppColors.backgroundSecondary)
                                .clipShape(Capsule())
                                .focused($isFocused)
                        }
                    }
                    .padding(.horizontal, 40)
                    .padding(.top, 20)

                    Spacer(minLength: 40)
                }
            }
        }
        .frame(width: 450, height: 380)
        .onAppear {
            isFocused = true
        }
    }

    private func addDepartment() {
        Task {
            await viewModel.addDepartment()
            dismiss()
        }
    }

    private func clearAndDismiss() {
        viewModel.newDepartmentName = ""
        dismiss()
    }
}

struct ScheduleManagementView: View {
    @EnvironmentObject var viewModel: SettingsViewModel

    var body: some View {
        VStack {
            if let today = viewModel.todayEntry {
                HStack {
                    VStack(alignment: .leading) {
                        Text("Today's Show")
                            .font(.headline)
                        Text(today.fullLocation)
                            .font(.title2)
                        Text(today.formattedDate)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
                .padding()
                .background(Color.blue.opacity(0.1))
                .cornerRadius(12)
                .padding()
            }

            List {
                ForEach(viewModel.tourSchedule) { entry in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(entry.shortFormattedDate)
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(entry.venueName)
                                .font(.headline)
                            Text(entry.location)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }

                        Spacer()

                        if entry.isToday() {
                            Text("TODAY")
                                .font(.caption.weight(.bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.blue)
                                .cornerRadius(4)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .task {
            await viewModel.loadData()
        }
    }
}

struct AppSettingsView: View {
    var body: some View {
        Form {
            Section("About") {
                LabeledContent("Version", value: "1.0.0")
                LabeledContent("Build", value: "1")
            }
        }
        .formStyle(.grouped)
        .padding()
    }
}

// MARK: - Preview

#Preview {
    MainWindowView()
        .environmentObject(DashboardViewModel())
        .environmentObject(SettingsViewModel())
        .environmentObject(CloudKitSyncEngine())
}
