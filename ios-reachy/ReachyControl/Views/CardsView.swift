import SwiftUI

struct CardsView: View {
    let serverUrl: String
    @State private var robotStatus = "Disconnected"
    @State private var availableApps: [RobotApp] = []
    @State private var isLoading = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Robot Status Card
                    RobotStatusCard(status: robotStatus, serverUrl: serverUrl)

                    // Available Applications
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Available Applications")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .padding(.horizontal)

                        if isLoading {
                            ProgressView("Loading applications...")
                                .frame(maxWidth: .infinity, minHeight: 100)
                        } else if availableApps.isEmpty {
                            EmptyStateView(
                                icon: "app.badge",
                                title: "No Applications Found",
                                description: "No robot applications are currently available."
                            )
                        } else {
                            LazyVGrid(columns: [
                                GridItem(.flexible()),
                                GridItem(.flexible())
                            ], spacing: 16) {
                                ForEach(availableApps) { app in
                                    AppCard(app: app, serverUrl: serverUrl)
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // Robot Movement Controls
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Movement Controls")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .padding(.horizontal)

                        MovementControlsCard(serverUrl: serverUrl)
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle("Robot Control")
            .refreshable {
                await loadAvailableApps()
            }
        }
        .onAppear {
            Task {
                await loadAvailableApps()
            }
        }
    }

    private func loadAvailableApps() async {
        isLoading = true
        // Simulate loading apps from the API
        await Task.sleep(1_000_000_000) // 1 second delay

        // Mock data - in real implementation, this would call the mobile-api
        availableApps = [
            RobotApp(id: "1", name: "Hello World", description: "Basic greeting application", isRunning: false),
            RobotApp(id: "2", name: "Camera Stream", description: "Live camera feed", isRunning: true),
            RobotApp(id: "3", name: "Voice Assistant", description: "Voice command interface", isRunning: false),
            RobotApp(id: "4", name: "Dance Routine", description: "Choreographed movements", isRunning: false)
        ]

        robotStatus = "Connected"
        isLoading = false
    }
}

struct RobotStatusCard: View {
    let status: String
    let serverUrl: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "antenna.radiowaves.left.and.right")
                    .foregroundColor(.blue)
                Text("Robot Status")
                    .font(.headline)
                Spacer()
                StatusIndicator(status: status)
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Server:")
                        .foregroundColor(.secondary)
                    Text(serverUrl)
                        .font(.system(.caption, design: .monospaced))
                }

                HStack {
                    Text("Status:")
                        .foregroundColor(.secondary)
                    Text(status)
                        .fontWeight(.semibold)
                        .foregroundColor(status == "Connected" ? .green : .orange)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
        .padding(.horizontal)
    }
}

struct AppCard: View {
    let app: RobotApp
    let serverUrl: String
    @State private var isToggling = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: app.isRunning ? "play.fill" : "play")
                    .foregroundColor(app.isRunning ? .green : .gray)
                Spacer()
                if isToggling {
                    ProgressView()
                        .scaleEffect(0.8)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(app.name)
                    .font(.headline)
                    .lineLimit(1)

                Text(app.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            Button(action: toggleApp) {
                Text(app.isRunning ? "Stop" : "Start")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(app.isRunning ? Color.red : Color.blue)
                    .cornerRadius(8)
            }
            .disabled(isToggling)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
    }

    private func toggleApp() {
        isToggling = true
        // Simulate API call
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            isToggling = false
        }
    }
}

struct MovementControlsCard: View {
    let serverUrl: String

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Quick Movements")
                .font(.subheadline)
                .fontWeight(.semibold)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                MovementButton(title: "Nod", icon: "arrow.up.and.down")
                MovementButton(title: "Shake", icon: "arrow.left.and.right")
                MovementButton(title: "Look Up", icon: "arrow.up")
                MovementButton(title: "Look Down", icon: "arrow.down")
                MovementButton(title: "Turn Left", icon: "arrow.left")
                MovementButton(title: "Turn Right", icon: "arrow.right")
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
        .padding(.horizontal)
    }
}

struct MovementButton: View {
    let title: String
    let icon: String
    @State private var isPressed = false

    var body: some View {
        Button(action: executeMovement) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.title2)
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .foregroundColor(isPressed ? .white : .blue)
            .frame(maxWidth: .infinity, minHeight: 60)
            .background(isPressed ? Color.blue : Color.blue.opacity(0.1))
            .cornerRadius(8)
        }
        .scaleEffect(isPressed ? 0.95 : 1.0)
        .animation(.easeInOut(duration: 0.1), value: isPressed)
    }

    private func executeMovement() {
        isPressed = true
        // Simulate movement command
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            isPressed = false
        }
    }
}

struct StatusIndicator: View {
    let status: String

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(status == "Connected" ? Color.green : Color.orange)
                .frame(width: 8, height: 8)
            Text(status)
                .font(.caption)
                .fontWeight(.medium)
        }
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(.gray)

            VStack(spacing: 8) {
                Text(title)
                    .font(.headline)
                    .foregroundColor(.primary)

                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, minHeight: 120)
    }
}

struct RobotApp: Identifiable {
    let id: String
    let name: String
    let description: String
    let isRunning: Bool
}

#Preview {
    CardsView(serverUrl: "https://example.com")
}