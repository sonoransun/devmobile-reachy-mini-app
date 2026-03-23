import SwiftUI

struct NetworkSettingsView: View {
    let serverUrl: String
    @State private var networkInfo = NetworkInfo()
    @State private var wifiNetworks: [WiFiNetwork] = []
    @State private var isScanning = false

    var body: some View {
        List {
            Section("Current Connection") {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Image(systemName: "wifi")
                            .foregroundColor(.blue)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("WiFi Network")
                                .font(.subheadline)
                            Text(networkInfo.wifiNetwork ?? "Not connected")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        if networkInfo.wifiNetwork != nil {
                            VStack {
                                Text("\(networkInfo.signalStrength)")
                                    .font(.caption)
                                    .fontWeight(.medium)
                                Text("dBm")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }

                    Divider()

                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("IP Address")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(networkInfo.ipAddress ?? "Unknown")
                                .font(.subheadline)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 2) {
                            Text("Connection Type")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(networkInfo.connectionType)
                                .font(.subheadline)
                        }
                    }
                }
            }

            Section(header: HStack {
                Text("Available Networks")
                Spacer()
                Button(isScanning ? "Scanning..." : "Scan") {
                    scanForNetworks()
                }
                .font(.caption)
                .disabled(isScanning)
            }) {
                if isScanning {
                    HStack {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("Scanning for networks...")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 8)
                } else if wifiNetworks.isEmpty {
                    Text("No networks found")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .padding(.vertical, 8)
                } else {
                    ForEach(wifiNetworks) { network in
                        WiFiNetworkRow(network: network)
                    }
                }
            }

            Section("Network Configuration") {
                NavigationLink(destination: Text("Advanced Network Settings")) {
                    HStack {
                        Image(systemName: "gear")
                        Text("Advanced Settings")
                    }
                }

                NavigationLink(destination: Text("DNS Configuration")) {
                    HStack {
                        Image(systemName: "server.rack")
                        Text("DNS Configuration")
                    }
                }

                NavigationLink(destination: Text("Proxy Settings")) {
                    HStack {
                        Image(systemName: "arrow.triangle.branch")
                        Text("Proxy Settings")
                    }
                }
            }
        }
        .navigationTitle("Network Settings")
        .onAppear {
            loadNetworkInfo()
        }
    }

    private func loadNetworkInfo() {
        // Mock network information
        networkInfo = NetworkInfo(
            wifiNetwork: "RobotNetwork-5G",
            ipAddress: "192.168.1.100",
            connectionType: "WiFi Direct",
            signalStrength: -45
        )
    }

    private func scanForNetworks() {
        isScanning = true

        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            // Mock WiFi networks
            wifiNetworks = [
                WiFiNetwork(id: "1", name: "RobotNetwork-5G", signalStrength: -30, isSecured: true, isConnected: true),
                WiFiNetwork(id: "2", name: "HomeNetwork", signalStrength: -55, isSecured: true, isConnected: false),
                WiFiNetwork(id: "3", name: "PublicWiFi", signalStrength: -70, isSecured: false, isConnected: false),
                WiFiNetwork(id: "4", name: "NeighborWiFi", signalStrength: -80, isSecured: true, isConnected: false)
            ]

            isScanning = false
        }
    }
}

struct WiFiNetworkRow: View {
    let network: WiFiNetwork

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(network.name)
                    .font(.subheadline)
                    .fontWeight(.medium)

                HStack(spacing: 12) {
                    HStack(spacing: 4) {
                        Image(systemName: network.isSecured ? "lock.fill" : "lock.open")
                            .font(.caption2)
                            .foregroundColor(network.isSecured ? .green : .orange)
                        Text(network.isSecured ? "Secured" : "Open")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    if network.isConnected {
                        Text("Connected")
                            .font(.caption)
                            .foregroundColor(.blue)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                WiFiSignalStrengthIcon(strength: network.signalStrength)

                Text("\(network.signalStrength) dBm")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            // Handle network selection
        }
    }
}

struct WiFiSignalStrengthIcon: View {
    let strength: Int

    private var signalLevel: Int {
        switch strength {
        case -50...: return 4
        case -60..<(-50): return 3
        case -70..<(-60): return 2
        case -80..<(-70): return 1
        default: return 0
        }
    }

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<4) { index in
                Rectangle()
                    .frame(width: 3, height: CGFloat(4 + index * 3))
                    .foregroundColor(index < signalLevel ? .blue : .gray.opacity(0.3))
            }
        }
    }
}

struct NetworkInfo {
    var wifiNetwork: String? = nil
    var ipAddress: String? = nil
    var connectionType: String = "Unknown"
    var signalStrength: Int = 0
}

struct WiFiNetwork: Identifiable {
    let id: String
    let name: String
    let signalStrength: Int
    let isSecured: Bool
    let isConnected: Bool
}

struct AudioVideoSettingsView: View {
    let serverUrl: String

    var body: some View {
        List {
            Section("Audio Settings") {
                HStack {
                    Text("Volume")
                    Spacer()
                    Text("80%")
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("Microphone")
                    Spacer()
                    Text("Enabled")
                        .foregroundColor(.green)
                }
            }

            Section("Video Settings") {
                HStack {
                    Text("Camera Quality")
                    Spacer()
                    Text("1080p")
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("Frame Rate")
                    Spacer()
                    Text("30 FPS")
                        .foregroundColor(.secondary)
                }
            }
        }
        .navigationTitle("Audio & Video")
    }
}

struct AppSettingsView: View {
    var body: some View {
        List {
            Section("Preferences") {
                HStack {
                    Text("Theme")
                    Spacer()
                    Text("System")
                        .foregroundColor(.secondary)
                }

                Toggle("Notifications", isOn: .constant(true))

                Toggle("Auto-connect", isOn: .constant(false))
            }

            Section("Data") {
                HStack {
                    Text("Cache Size")
                    Spacer()
                    Text("24 MB")
                        .foregroundColor(.secondary)
                }

                Button("Clear Cache") {
                    // Clear app cache
                }
                .foregroundColor(.red)
            }
        }
        .navigationTitle("App Settings")
    }
}

struct SystemInfoView: View {
    let serverUrl: String

    var body: some View {
        List {
            Section("Robot Information") {
                HStack {
                    Text("Model")
                    Spacer()
                    Text("Reachy Mini")
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("Firmware Version")
                    Spacer()
                    Text("2.1.0")
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("Serial Number")
                    Spacer()
                    Text("RM-2024-001")
                        .foregroundColor(.secondary)
                }
            }

            Section("System Status") {
                HStack {
                    Text("CPU Usage")
                    Spacer()
                    Text("45%")
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("Memory Usage")
                    Spacer()
                    Text("60%")
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("Storage")
                    Spacer()
                    Text("12.5 GB / 32 GB")
                        .foregroundColor(.secondary)
                }
            }
        }
        .navigationTitle("System Information")
    }
}

#Preview {
    NetworkSettingsView(serverUrl: "https://example.com")
}