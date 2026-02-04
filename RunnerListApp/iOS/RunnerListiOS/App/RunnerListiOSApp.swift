import SwiftUI
import RunnerListCore

@main
struct RunnerListiOSApp: App {

    @StateObject private var syncEngine = CloudKitSyncEngine()

    var body: some Scene {
        WindowGroup {
            SubmitRequestView()
                .environmentObject(syncEngine)
                .preferredColorScheme(.dark)
                .task {
                    await syncEngine.performInitialSync()
                }
        }
    }
}

// MARK: - Preview

#Preview {
    SubmitRequestView()
        .environmentObject(CloudKitSyncEngine())
}
