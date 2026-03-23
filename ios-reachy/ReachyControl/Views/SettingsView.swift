import SwiftUI

struct SettingsView: View {
    let serverUrl: String
    let onDisconnect: () -> Void

    @State private var vpnProfiles: [VPNProfile] = []
    @State private var networkSettings = NetworkSettings()
    @State private var showingVPNDetails = false
    @State private var showingNetworkDetails = false
    @State private var showingDisconnectAlert = false

    var body: some View {
        NavigationView {
            List {
                // Connection Info Section
                Section("Connection") {
                    HStack {
                        Image(systemName: "link")
                            .foregroundColor(.blue)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Server URL")
                                .font(.subheadline)
                            Text(serverUrl)
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                        Spacer()
                        Button("Disconnect") {
                            showingDisconnectAlert = true
                        }
                        .foregroundColor(.red)
                    }
                }

                // VPN Configuration Section
                Section("VPN Configuration") {
                    NavigationLink(destination: VPNConfigurationView(serverUrl: serverUrl)) {
                        HStack {
                            Image(systemName: "shield")
                                .foregroundColor(.green)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("VPN Profiles")
                                    .font(.subheadline)
                                Text("\(vpnProfiles.count) profiles configured")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }

                    ForEach(vpnProfiles.prefix(3)) { profile in
                        VPNProfileRow(profile: profile)
                    }

                    if vpnProfiles.count > 3 {
                        Text("+ \(vpnProfiles.count - 3) more profiles")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                // Network Settings Section
                Section("Network Settings") {
                    NavigationLink(destination: NetworkSettingsView(serverUrl: serverUrl)) {
                        HStack {
                            Image(systemName: "wifi")
                                .foregroundColor(.blue)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("WiFi Configuration")
                                    .font(.subheadline)
                                Text(networkSettings.wifiNetwork ?? "Not connected")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }

                    HStack {
                        Image(systemName: "network")
                            .foregroundColor(.orange)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Network Mode")
                                .font(.subheadline)
                            Text(networkSettings.connectionType)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                // Audio/Video Settings Section
                Section("Audio & Video") {
                    NavigationLink(destination: AudioVideoSettingsView(serverUrl: serverUrl)) {
                        HStack {
                            Image(systemName: "speaker.wave.2")
                                .foregroundColor(.purple)
                            Text("Audio Settings")
                        }
                    }

                    NavigationLink(destination: AudioVideoSettingsView(serverUrl: serverUrl)) {
                        HStack {
                            Image(systemName: "video")
                                .foregroundColor(.red)
                            Text("Video Settings")
                        }
                    }
                }

                // Application Settings Section
                Section("Application") {
                    NavigationLink(destination: AppSettingsView()) {
                        HStack {
                            Image(systemName: "gear")
                                .foregroundColor(.gray)
                            Text("App Preferences")
                        }
                    }

                    NavigationLink(destination: SystemInfoView(serverUrl: serverUrl)) {
                        HStack {
                            Image(systemName: "info.circle")
                                .foregroundColor(.blue)
                            Text("System Information")
                        }
                    }
                }

                // Diagnostic Tools Section
                Section("Diagnostic Tools") {
                    Button(action: {
                        // Export diagnostic data
                    }) {
                        HStack {
                            Image(systemName: "doc.text.magnifyingglass")
                                .foregroundColor(.orange)
                            Text("Export Diagnostics")
                            Spacer()
                            Image(systemName: "square.and.arrow.up")
                                .foregroundColor(.secondary)
                        }
                    }

                    NavigationLink(destination: SystemLogsView(serverUrl: serverUrl)) {
                        HStack {
                            Image(systemName: "text.alignleft")
                                .foregroundColor(.green)
                            Text("View System Logs")
                        }
                    }
                }

                // About Section
                Section("About") {
                    HStack {
                        Image(systemName: "info")
                            .foregroundColor(.blue)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Reachy Control")
                                .font(.subheadline)
                            Text("Version 1.0.0")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Settings")
        }
        .alert("Disconnect from Robot", isPresented: $showingDisconnectAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Disconnect", role: .destructive) {
                onDisconnect()
            }
        } message: {
            Text("Are you sure you want to disconnect from the robot?")
        }
        .onAppear {
            loadSettings()
        }
    }

    private func loadSettings() {
        // Mock data - in real implementation, this would load from API
        vpnProfiles = [
            VPNProfile(id: "1", name: "Office VPN", type: "OpenVPN", status: .connected),
            VPNProfile(id: "2", name: "Home Network", type: "WireGuard", status: .disconnected),
            VPNProfile(id: "3", name: "Remote Access", type: "IPsec", status: .disconnected),
            VPNProfile(id: "4", name: "Cloud VPN", type: "Commercial", status: .disconnected)
        ]

        networkSettings = NetworkSettings(
            wifiNetwork: "RobotNetwork-5G",
            connectionType: "WiFi Direct",
            ipAddress: "192.168.1.100"
        )
    }
}

struct VPNProfileRow: View {
    let profile: VPNProfile

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(profile.name)
                    .font(.subheadline)
                Text(profile.type)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            VPNStatusIndicator(status: profile.status)
        }
        .contentShape(Rectangle())
    }
}

struct VPNStatusIndicator: View {
    let status: VPNConnectionStatus

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(status.color)
                .frame(width: 8, height: 8)
            Text(status.displayName)
                .font(.caption)
                .fontWeight(.medium)
        }
    }
}

struct VPNProfile: Identifiable {
    let id: String
    let name: String
    let type: String
    let status: VPNConnectionStatus
}

struct NetworkSettings {
    var wifiNetwork: String? = nil
    var connectionType: String = "Unknown"
    var ipAddress: String? = nil
}

enum VPNConnectionStatus {
    case connected
    case disconnected
    case connecting

    var displayName: String {
        switch self {
        case .connected: return "Connected"
        case .disconnected: return "Disconnected"
        case .connecting: return "Connecting"
        }
    }

    var color: Color {
        switch self {
        case .connected: return .green
        case .disconnected: return .gray
        case .connecting: return .orange
        }
    }
}

#Preview {
    SettingsView(serverUrl: "https://example.com", onDisconnect: {})
}