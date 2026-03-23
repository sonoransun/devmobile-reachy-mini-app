import SwiftUI

struct SystemLogsView: View {
    let serverUrl: String
    @State private var logs: [LogEntry] = []
    @State private var isLoading = true
    @State private var selectedLogLevel: LogLevel = .all
    @State private var searchText = ""
    @Environment(\.dismiss) private var dismiss

    private var filteredLogs: [LogEntry] {
        let levelFiltered = selectedLogLevel == .all ? logs : logs.filter { $0.level == selectedLogLevel }

        if searchText.isEmpty {
            return levelFiltered
        } else {
            return levelFiltered.filter { log in
                log.message.localizedCaseInsensitiveContains(searchText) ||
                log.component.localizedCaseInsensitiveContains(searchText)
            }
        }
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search and Filter Controls
                VStack(spacing: 12) {
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.secondary)
                        TextField("Search logs...", text: $searchText)
                            .textFieldStyle(PlainTextFieldStyle())
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(LogLevel.allCases, id: \.self) { level in
                                LogLevelButton(
                                    level: level,
                                    isSelected: selectedLogLevel == level,
                                    count: logs.filter { level == .all || $0.level == level }.count
                                ) {
                                    selectedLogLevel = level
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                }
                .padding()
                .background(Color(.systemBackground))

                Divider()

                // Logs List
                if isLoading {
                    VStack {
                        Spacer()
                        ProgressView("Loading system logs...")
                        Spacer()
                    }
                } else if filteredLogs.isEmpty {
                    VStack {
                        Spacer()
                        EmptyStateView(
                            icon: "text.alignleft",
                            title: searchText.isEmpty ? "No logs found" : "No matching logs",
                            description: searchText.isEmpty ?
                                "No system logs are available." :
                                "Try adjusting your search terms or log level filter."
                        )
                        Spacer()
                    }
                } else {
                    List(filteredLogs) { log in
                        LogEntryRow(entry: log)
                            .listRowSeparator(.hidden)
                    }
                    .listStyle(PlainListStyle())
                }
            }
            .navigationTitle("System Logs")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Refresh") {
                        loadLogs()
                    }
                }
            }
        }
        .onAppear {
            loadLogs()
        }
    }

    private func loadLogs() {
        isLoading = true

        // Simulate API call to fetch logs
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            // Mock log data - in real implementation, this would call the mobile-api
            logs = [
                LogEntry(
                    id: "1",
                    timestamp: Date().addingTimeInterval(-300),
                    level: .info,
                    component: "Robot Controller",
                    message: "Robot successfully connected and initialized"
                ),
                LogEntry(
                    id: "2",
                    timestamp: Date().addingTimeInterval(-280),
                    level: .debug,
                    component: "Camera Stream",
                    message: "WebRTC connection established with peer"
                ),
                LogEntry(
                    id: "3",
                    timestamp: Date().addingTimeInterval(-250),
                    level: .warning,
                    component: "VPN Manager",
                    message: "Connection timeout detected, attempting reconnect"
                ),
                LogEntry(
                    id: "4",
                    timestamp: Date().addingTimeInterval(-200),
                    level: .error,
                    component: "Application Manager",
                    message: "Failed to start 'Hello World' application: permission denied"
                ),
                LogEntry(
                    id: "5",
                    timestamp: Date().addingTimeInterval(-150),
                    level: .info,
                    component: "Movement Controller",
                    message: "Executed movement command: nod sequence"
                ),
                LogEntry(
                    id: "6",
                    timestamp: Date().addingTimeInterval(-120),
                    level: .debug,
                    component: "Network Manager",
                    message: "WiFi signal strength: -45 dBm, quality: excellent"
                ),
                LogEntry(
                    id: "7",
                    timestamp: Date().addingTimeInterval(-90),
                    level: .info,
                    component: "Authentication",
                    message: "New device registered: mobile-ios-device-123"
                ),
                LogEntry(
                    id: "8",
                    timestamp: Date().addingTimeInterval(-60),
                    level: .warning,
                    component: "Battery Monitor",
                    message: "Battery level at 25%, consider charging soon"
                ),
                LogEntry(
                    id: "9",
                    timestamp: Date().addingTimeInterval(-30),
                    level: .info,
                    component: "System Monitor",
                    message: "CPU usage: 45%, Memory usage: 60%"
                ),
                LogEntry(
                    id: "10",
                    timestamp: Date().addingTimeInterval(-10),
                    level: .debug,
                    component: "Data Transfer",
                    message: "Diagnostic export completed successfully"
                )
            ]

            isLoading = false
        }
    }
}

struct LogLevelButton: View {
    let level: LogLevel
    let isSelected: Bool
    let count: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Circle()
                    .fill(level.color)
                    .frame(width: 8, height: 8)

                Text(level.displayName)
                    .font(.caption)
                    .fontWeight(.medium)

                if count > 0 {
                    Text("(\(count))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? level.color.opacity(0.2) : Color(.systemGray6))
            .foregroundColor(isSelected ? level.color : .primary)
            .cornerRadius(16)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct LogEntryRow: View {
    let entry: LogEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                HStack(spacing: 8) {
                    Circle()
                        .fill(entry.level.color)
                        .frame(width: 10, height: 10)

                    Text(entry.level.displayName.uppercased())
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(entry.level.color)

                    Text("•")
                        .foregroundColor(.secondary)

                    Text(entry.component)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.secondary)
                }

                Spacer()

                Text(entry.timestamp.formatted(.dateTime.hour().minute().second()))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Text(entry.message)
                .font(.subheadline)
                .foregroundColor(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 4)
    }
}

struct LogEntry: Identifiable {
    let id: String
    let timestamp: Date
    let level: LogLevel
    let component: String
    let message: String
}

enum LogLevel: String, CaseIterable {
    case all = "all"
    case debug = "debug"
    case info = "info"
    case warning = "warning"
    case error = "error"

    var displayName: String {
        switch self {
        case .all: return "All"
        case .debug: return "Debug"
        case .info: return "Info"
        case .warning: return "Warning"
        case .error: return "Error"
        }
    }

    var color: Color {
        switch self {
        case .all: return .blue
        case .debug: return .gray
        case .info: return .green
        case .warning: return .orange
        case .error: return .red
        }
    }
}

#Preview {
    SystemLogsView(serverUrl: "https://example.com")
}