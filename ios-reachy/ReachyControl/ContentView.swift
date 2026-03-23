import SwiftUI

struct ContentView: View {
    @State private var isConnected = false
    @State private var serverUrl = ""

    var body: some View {
        NavigationStack {
            if isConnected {
                MainMenuView(serverUrl: serverUrl, onDisconnect: {
                    isConnected = false
                    serverUrl = ""
                })
            } else {
                ConnectionView(onConnect: { url in
                    serverUrl = url
                    isConnected = true
                })
            }
        }
    }
}

#Preview {
    ContentView()
}