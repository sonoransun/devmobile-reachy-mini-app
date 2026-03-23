import SwiftUI

struct VPNConfigurationView: View {
    let serverUrl: String
    @State private var vpnProfiles: [VPNProfile] = []
    @State private var showingAddProfile = false
    @State private var isLoading = false

    var body: some View {
        NavigationView {
            VStack {
                if isLoading {
                    VStack {
                        Spacer()
                        ProgressView("Loading VPN profiles...")
                        Spacer()
                    }
                } else if vpnProfiles.isEmpty {
                    VStack {
                        Spacer()
                        EmptyStateView(
                            icon: "shield",
                            title: "No VPN Profiles",
                            description: "Add a VPN profile to secure your connection to the robot."
                        )
                        Spacer()
                    }
                } else {
                    List {
                        ForEach(vpnProfiles) { profile in
                            VPNProfileDetailRow(profile: profile, serverUrl: serverUrl)
                        }
                        .onDelete(perform: deleteProfiles)
                    }
                }
            }
            .navigationTitle("VPN Profiles")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Add") {
                        showingAddProfile = true
                    }
                }
            }
            .sheet(isPresented: $showingAddProfile) {
                AddVPNProfileView(serverUrl: serverUrl) { newProfile in
                    vpnProfiles.append(newProfile)
                }
            }
        }
        .onAppear {
            loadVPNProfiles()
        }
    }

    private func loadVPNProfiles() {
        isLoading = true

        // Simulate API call
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            // Mock data - in real implementation, this would call the mobile-api
            vpnProfiles = [
                VPNProfile(id: "1", name: "Office VPN", type: "OpenVPN", status: .connected),
                VPNProfile(id: "2", name: "Home Network", type: "WireGuard", status: .disconnected),
                VPNProfile(id: "3", name: "Remote Access", type: "IPsec", status: .disconnected),
                VPNProfile(id: "4", name: "Cloud VPN", type: "Commercial", status: .disconnected)
            ]

            isLoading = false
        }
    }

    private func deleteProfiles(at offsets: IndexSet) {
        vpnProfiles.remove(atOffsets: offsets)
        // In real implementation, this would call the mobile-api to delete the profile
    }
}

struct VPNProfileDetailRow: View {
    let profile: VPNProfile
    let serverUrl: String
    @State private var isToggling = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(profile.name)
                        .font(.headline)

                    Text(profile.type)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    VPNStatusIndicator(status: profile.status)

                    Button(profile.status == .connected ? "Disconnect" : "Connect") {
                        toggleConnection()
                    }
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(profile.status == .connected ? Color.red : Color.blue)
                    .cornerRadius(6)
                    .disabled(isToggling)
                }
            }

            if isToggling {
                HStack {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text(profile.status == .connected ? "Disconnecting..." : "Connecting...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                }
            }
        }
        .padding(.vertical, 8)
    }

    private func toggleConnection() {
        isToggling = true

        // Simulate VPN connection toggle
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            isToggling = false
            // In real implementation, this would call the mobile-api VPN endpoints
        }
    }
}

struct AddVPNProfileView: View {
    let serverUrl: String
    let onAddProfile: (VPNProfile) -> Void

    @State private var profileName = ""
    @State private var selectedType = "OpenVPN"
    @State private var serverAddress = ""
    @State private var username = ""
    @State private var password = ""
    @Environment(\.dismiss) private var dismiss

    private let vpnTypes = ["OpenVPN", "WireGuard", "IPsec", "Commercial"]

    var body: some View {
        NavigationView {
            Form {
                Section("Profile Information") {
                    TextField("Profile Name", text: $profileName)

                    Picker("VPN Type", selection: $selectedType) {
                        ForEach(vpnTypes, id: \.self) { type in
                            Text(type).tag(type)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                }

                Section("Connection Details") {
                    TextField("Server Address", text: $serverAddress)
                        .keyboardType(.URL)
                        .autocapitalization(.none)

                    TextField("Username", text: $username)
                        .autocapitalization(.none)

                    SecureField("Password", text: $password)
                }

                Section("Configuration") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Additional Settings")
                            .font(.subheadline)
                            .fontWeight(.medium)

                        Text("Advanced configuration options will be available after creating the profile.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Add VPN Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        saveProfile()
                    }
                    .disabled(profileName.isEmpty || serverAddress.isEmpty)
                }
            }
        }
    }

    private func saveProfile() {
        let newProfile = VPNProfile(
            id: UUID().uuidString,
            name: profileName,
            type: selectedType,
            status: .disconnected
        )

        onAddProfile(newProfile)
        dismiss()

        // In real implementation, this would call the mobile-api to create the profile
    }
}

#Preview {
    VPNConfigurationView(serverUrl: "https://example.com")
}