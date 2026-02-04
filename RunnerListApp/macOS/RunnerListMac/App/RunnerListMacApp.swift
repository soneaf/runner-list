import SwiftUI

@main
struct RunnerListMacApp: App {

    @StateObject private var dashboardViewModel = DashboardViewModel()
    @StateObject private var settingsViewModel = SettingsViewModel()
    @StateObject private var syncEngine = CloudKitSyncEngine()

    var body: some Scene {
        WindowGroup {
            MainWindowView()
                .environmentObject(dashboardViewModel)
                .environmentObject(settingsViewModel)
                .environmentObject(syncEngine)
                .task {
                    await syncEngine.performInitialSync()
                    await dashboardViewModel.loadData()
                }
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: true))
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("New Request") {
                    // Handle new request
                }
                .keyboardShortcut("n", modifiers: .command)
            }

            CommandGroup(after: .sidebar) {
                Button("Refresh") {
                    Task {
                        await dashboardViewModel.refresh()
                    }
                }
                .keyboardShortcut("r", modifiers: .command)
            }
        }

        Settings {
            SettingsWindowView()
                .environmentObject(settingsViewModel)
        }
    }
}

// MARK: - Settings Window

struct SettingsWindowView: View {
    var body: some View {
        TabView {
            GeneralSettingsView()
                .tabItem {
                    Label("General", systemImage: "gear")
                }

            CloudKitSettingsView()
                .tabItem {
                    Label("Sync", systemImage: "arrow.triangle.2.circlepath.icloud")
                }
        }
        .frame(width: 450, height: 300)
    }
}

struct GeneralSettingsView: View {
    var body: some View {
        Form {
            Text("General settings will go here")
                .foregroundColor(.secondary)
        }
        .padding()
    }
}

struct CloudKitSettingsView: View {
    @StateObject private var syncEngine = CloudKitSyncEngine()

    var body: some View {
        Form {
            LabeledContent("Sync Status") {
                Text(syncEngine.syncStatus.displayText)
            }

            if let lastSync = syncEngine.lastSyncDate {
                LabeledContent("Last Synced") {
                    Text(lastSync, style: .relative)
                }
            }

            Button("Sync Now") {
                Task {
                    await syncEngine.refresh()
                }
            }
            .disabled(syncEngine.isSyncing)
        }
        .padding()
    }
}
