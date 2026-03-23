import SwiftUI

struct DiagnosticExportView: View {
    let serverUrl: String
    @State private var selectedComponents: Set<DiagnosticComponent> = []
    @State private var exportProgress: Double = 0.0
    @State private var isExporting = false
    @State private var exportCompleted = false
    @State private var errorMessage = ""
    @Environment(\.dismiss) private var dismiss

    private let availableComponents: [DiagnosticComponent] = [
        DiagnosticComponent(id: "system", name: "System Information", description: "Hardware specs, OS version, firmware"),
        DiagnosticComponent(id: "logs", name: "System Logs", description: "Application and system log files"),
        DiagnosticComponent(id: "network", name: "Network Configuration", description: "WiFi settings, IP configuration, VPN profiles"),
        DiagnosticComponent(id: "robot", name: "Robot State", description: "Joint positions, sensor readings, status"),
        DiagnosticComponent(id: "applications", name: "Applications", description: "Installed apps, configurations, status"),
        DiagnosticComponent(id: "performance", name: "Performance Metrics", description: "CPU usage, memory usage, timing data")
    ]

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                if exportCompleted {
                    // Export Success View
                    VStack(spacing: 20) {
                        Spacer()

                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 64))
                            .foregroundColor(.green)

                        VStack(spacing: 8) {
                            Text("Export Completed")
                                .font(.title2)
                                .fontWeight(.semibold)

                            Text("Diagnostic data has been successfully exported and is ready for download.")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                        }

                        VStack(spacing: 12) {
                            Button("Download") {
                                // Handle download action
                                dismiss()
                            }
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .cornerRadius(12)

                            Button("Close") {
                                dismiss()
                            }
                            .font(.subheadline)
                            .foregroundColor(.blue)
                        }
                        .padding(.horizontal, 40)

                        Spacer()
                    }
                } else if isExporting {
                    // Export Progress View
                    VStack(spacing: 20) {
                        Spacer()

                        VStack(spacing: 16) {
                            ProgressView(value: exportProgress)
                                .progressViewStyle(LinearProgressViewStyle(tint: .blue))
                                .frame(width: 200)

                            Text("\(Int(exportProgress * 100))% Complete")
                                .font(.headline)

                            Text("Collecting diagnostic data...")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }

                        Spacer()
                    }
                } else {
                    // Component Selection View
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Select Components")
                                .font(.title2)
                                .fontWeight(.semibold)

                            Text("Choose which diagnostic information to include in the export.")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        .padding(.horizontal)
                        .padding(.top)

                        ScrollView {
                            LazyVStack(spacing: 12) {
                                ForEach(availableComponents) { component in
                                    DiagnosticComponentRow(
                                        component: component,
                                        isSelected: selectedComponents.contains(component)
                                    ) {
                                        toggleComponent(component)
                                    }
                                }
                            }
                            .padding(.horizontal)
                        }

                        if !errorMessage.isEmpty {
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundColor(.red)
                                .padding(.horizontal)
                        }

                        // Action Buttons
                        VStack(spacing: 12) {
                            Button("Export Selected") {
                                startExport()
                            }
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(selectedComponents.isEmpty ? Color.gray : Color.blue)
                            .cornerRadius(12)
                            .disabled(selectedComponents.isEmpty)

                            HStack(spacing: 16) {
                                Button("Select All") {
                                    selectedComponents = Set(availableComponents)
                                }
                                .font(.subheadline)
                                .foregroundColor(.blue)

                                Button("Clear All") {
                                    selectedComponents.removeAll()
                                }
                                .font(.subheadline)
                                .foregroundColor(.blue)
                            }
                        }
                        .padding(.horizontal)
                        .padding(.bottom)
                    }
                }
            }
            .navigationTitle("Export Diagnostics")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .disabled(isExporting)
                }
            }
        }
        .onAppear {
            // Pre-select common components
            selectedComponents = Set([
                availableComponents.first { $0.id == "system" },
                availableComponents.first { $0.id == "logs" },
                availableComponents.first { $0.id == "robot" }
            ].compactMap { $0 })
        }
    }

    private func toggleComponent(_ component: DiagnosticComponent) {
        if selectedComponents.contains(component) {
            selectedComponents.remove(component)
        } else {
            selectedComponents.insert(component)
        }
        errorMessage = ""
    }

    private func startExport() {
        guard !selectedComponents.isEmpty else {
            errorMessage = "Please select at least one component to export."
            return
        }

        isExporting = true
        exportProgress = 0.0

        // Simulate export progress
        Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { timer in
            exportProgress += 0.1

            if exportProgress >= 1.0 {
                exportProgress = 1.0
                isExporting = false
                exportCompleted = true
                timer.invalidate()
            }
        }
    }
}

struct DiagnosticComponentRow: View {
    let component: DiagnosticComponent
    let isSelected: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: 16) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundColor(isSelected ? .blue : .gray)

                VStack(alignment: .leading, spacing: 4) {
                    Text(component.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)

                    Text(component.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer()
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.blue : Color.gray.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct DiagnosticComponent: Identifiable, Hashable {
    let id: String
    let name: String
    let description: String

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: DiagnosticComponent, rhs: DiagnosticComponent) -> Bool {
        lhs.id == rhs.id
    }
}

#Preview {
    DiagnosticExportView(serverUrl: "https://example.com")
}