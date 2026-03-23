import SwiftUI

struct TransfersView: View {
    let serverUrl: String
    @State private var activeTransfers: [Transfer] = []
    @State private var completedTransfers: [Transfer] = []
    @State private var showingDiagnosticExport = false
    @State private var showingLogViewer = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Quick Actions Section
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Quick Actions")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .padding(.horizontal)

                        LazyVGrid(columns: [
                            GridItem(.flexible()),
                            GridItem(.flexible())
                        ], spacing: 16) {
                            QuickActionCard(
                                title: "Export Diagnostics",
                                icon: "doc.text",
                                color: .blue
                            ) {
                                exportDiagnostics()
                            }

                            QuickActionCard(
                                title: "View System Logs",
                                icon: "text.alignleft",
                                color: .green
                            ) {
                                showingLogViewer = true
                            }

                            QuickActionCard(
                                title: "Download Files",
                                icon: "arrow.down.doc",
                                color: .orange
                            ) {
                                // File download functionality
                            }

                            QuickActionCard(
                                title: "Upload Files",
                                icon: "arrow.up.doc",
                                color: .purple
                            ) {
                                // File upload functionality
                            }
                        }
                        .padding(.horizontal)
                    }

                    // Active Transfers Section
                    if !activeTransfers.isEmpty {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("Active Transfers")
                                .font(.title2)
                                .fontWeight(.semibold)
                                .padding(.horizontal)

                            ForEach(activeTransfers) { transfer in
                                TransferCard(transfer: transfer, isActive: true)
                            }
                        }
                    }

                    // Recent Transfers Section
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Recent Transfers")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .padding(.horizontal)

                        if completedTransfers.isEmpty {
                            EmptyStateView(
                                icon: "arrow.up.arrow.down.circle",
                                title: "No Recent Transfers",
                                description: "Your completed transfers will appear here."
                            )
                            .padding(.horizontal)
                        } else {
                            ForEach(completedTransfers) { transfer in
                                TransferCard(transfer: transfer, isActive: false)
                            }
                        }
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle("Transfers")
            .sheet(isPresented: $showingLogViewer) {
                SystemLogsView(serverUrl: serverUrl)
            }
            .sheet(isPresented: $showingDiagnosticExport) {
                DiagnosticExportView(serverUrl: serverUrl)
            }
        }
        .onAppear {
            loadTransfers()
        }
    }

    private func loadTransfers() {
        // Mock data - in real implementation, this would load from API
        completedTransfers = [
            Transfer(
                id: "1",
                name: "system_diagnostics_2024-03-23.zip",
                type: .diagnostics,
                progress: 1.0,
                status: .completed,
                startTime: Date().addingTimeInterval(-3600),
                endTime: Date().addingTimeInterval(-3500)
            ),
            Transfer(
                id: "2",
                name: "camera_feed_backup.mp4",
                type: .download,
                progress: 1.0,
                status: .completed,
                startTime: Date().addingTimeInterval(-7200),
                endTime: Date().addingTimeInterval(-7100)
            ),
            Transfer(
                id: "3",
                name: "robot_config.json",
                type: .upload,
                progress: 1.0,
                status: .failed,
                startTime: Date().addingTimeInterval(-10800),
                endTime: Date().addingTimeInterval(-10780)
            )
        ]
    }

    private func exportDiagnostics() {
        let newTransfer = Transfer(
            id: UUID().uuidString,
            name: "system_diagnostics_\(Date().formatted(.dateTime.year().month().day())).zip",
            type: .diagnostics,
            progress: 0.0,
            status: .inProgress,
            startTime: Date(),
            endTime: nil
        )

        activeTransfers.append(newTransfer)

        // Simulate progress
        simulateTransferProgress(transfer: newTransfer)
    }

    private func simulateTransferProgress(transfer: Transfer) {
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { timer in
            if let index = activeTransfers.firstIndex(where: { $0.id == transfer.id }) {
                activeTransfers[index].progress += 0.1

                if activeTransfers[index].progress >= 1.0 {
                    activeTransfers[index].progress = 1.0
                    activeTransfers[index].status = .completed
                    activeTransfers[index].endTime = Date()

                    // Move to completed transfers
                    completedTransfers.insert(activeTransfers[index], at: 0)
                    activeTransfers.remove(at: index)

                    timer.invalidate()
                }
            } else {
                timer.invalidate()
            }
        }
    }
}

struct QuickActionCard: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title)
                    .foregroundColor(color)

                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.primary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity, minHeight: 80)
            .background(color.opacity(0.1))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(color.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct TransferCard: View {
    let transfer: Transfer
    let isActive: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: transfer.type.iconName)
                    .foregroundColor(transfer.type.color)

                VStack(alignment: .leading, spacing: 2) {
                    Text(transfer.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .lineLimit(1)

                    Text(transfer.type.displayName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                TransferStatusBadge(status: transfer.status)
            }

            if isActive {
                VStack(alignment: .leading, spacing: 8) {
                    ProgressView(value: transfer.progress)
                        .progressViewStyle(LinearProgressViewStyle(tint: .blue))

                    HStack {
                        Text("\(Int(transfer.progress * 100))%")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Spacer()

                        Text("Started \(transfer.startTime.formatted(.relative(presentation: .named)))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            } else {
                HStack {
                    Text("Started \(transfer.startTime.formatted(.relative(presentation: .named)))")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Spacer()

                    if let endTime = transfer.endTime {
                        Text("Completed \(endTime.formatted(.relative(presentation: .named)))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
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

struct TransferStatusBadge: View {
    let status: TransferStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption)
            .fontWeight(.semibold)
            .foregroundColor(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(status.color)
            .cornerRadius(6)
    }
}

struct Transfer: Identifiable {
    let id: String
    let name: String
    let type: TransferType
    var progress: Double
    var status: TransferStatus
    let startTime: Date
    var endTime: Date?
}

enum TransferType {
    case upload
    case download
    case diagnostics
    case logs

    var displayName: String {
        switch self {
        case .upload: return "Upload"
        case .download: return "Download"
        case .diagnostics: return "Diagnostics Export"
        case .logs: return "System Logs"
        }
    }

    var iconName: String {
        switch self {
        case .upload: return "arrow.up.circle"
        case .download: return "arrow.down.circle"
        case .diagnostics: return "doc.text.magnifyingglass"
        case .logs: return "text.alignleft"
        }
    }

    var color: Color {
        switch self {
        case .upload: return .purple
        case .download: return .orange
        case .diagnostics: return .blue
        case .logs: return .green
        }
    }
}

enum TransferStatus {
    case inProgress
    case completed
    case failed
    case cancelled

    var displayName: String {
        switch self {
        case .inProgress: return "In Progress"
        case .completed: return "Completed"
        case .failed: return "Failed"
        case .cancelled: return "Cancelled"
        }
    }

    var color: Color {
        switch self {
        case .inProgress: return .blue
        case .completed: return .green
        case .failed: return .red
        case .cancelled: return .orange
        }
    }
}

#Preview {
    TransfersView(serverUrl: "https://example.com")
}