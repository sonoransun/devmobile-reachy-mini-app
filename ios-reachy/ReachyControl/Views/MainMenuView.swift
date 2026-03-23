import SwiftUI

struct MainMenuView: View {
    let serverUrl: String
    let onDisconnect: () -> Void

    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            CardsView(serverUrl: serverUrl)
                .tabItem {
                    Image(systemName: "rectangle.stack")
                    Text("Cards")
                }
                .tag(0)

            TransfersView(serverUrl: serverUrl)
                .tabItem {
                    Image(systemName: "arrow.up.arrow.down")
                    Text("Transfers")
                }
                .tag(1)

            SettingsView(serverUrl: serverUrl, onDisconnect: onDisconnect)
                .tabItem {
                    Image(systemName: "gear")
                    Text("Settings")
                }
                .tag(2)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack {
                    Text("Reachy Control")
                        .font(.headline)
                    Text("Connected")
                        .font(.caption)
                        .foregroundColor(.green)
                }
            }
        }
    }
}

#Preview {
    MainMenuView(serverUrl: "https://example.com", onDisconnect: {})
}