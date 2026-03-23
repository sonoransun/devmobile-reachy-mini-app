import SwiftUI

struct ConnectionView: View {
    @State private var urlText = ""
    @State private var isConnecting = false
    @State private var errorMessage = ""

    let onConnect: (String) -> Void

    var body: some View {
        VStack(spacing: 30) {
            Spacer()

            // App Title and Logo Area
            VStack(spacing: 16) {
                Image(systemName: "antenna.radiowaves.left.and.right")
                    .font(.system(size: 60))
                    .foregroundColor(.blue)

                Text("Reachy Control")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text("Connect to your Reachy robot")
                    .font(.title3)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Connection Form
            VStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Server URL")
                        .font(.headline)
                        .foregroundColor(.primary)

                    TextField("Enter HTTP or HTTPS URL", text: $urlText)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .keyboardType(.URL)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                        .onChange(of: urlText) { _, _ in
                            errorMessage = ""
                        }

                    Text("Example: https://192.168.1.100:8000 or https://vpn.reachy.com")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                if !errorMessage.isEmpty {
                    Text(errorMessage)
                        .foregroundColor(.red)
                        .font(.caption)
                        .multilineTextAlignment(.center)
                }

                Button(action: connectToServer) {
                    HStack {
                        if isConnecting {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.8)
                        }

                        Text(isConnecting ? "Connecting..." : "Connect")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(isValidUrl(urlText) && !isConnecting ? Color.blue : Color.gray)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
                .disabled(!isValidUrl(urlText) || isConnecting)
            }
            .padding(.horizontal, 40)

            Spacer()

            // Help Text
            VStack(spacing: 8) {
                Text("Need help?")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Text("Make sure your device is connected to the same network as your Reachy robot, or use a VPN endpoint URL.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }

            Spacer()
        }
        .navigationBarHidden(true)
        .onSubmit {
            if isValidUrl(urlText) && !isConnecting {
                connectToServer()
            }
        }
    }

    private func isValidUrl(_ url: String) -> Bool {
        return url.hasPrefix("http://") || url.hasPrefix("https://")
    }

    private func connectToServer() {
        guard isValidUrl(urlText) else {
            errorMessage = "Please enter a valid HTTP or HTTPS URL"
            return
        }

        isConnecting = true
        errorMessage = ""

        // Simulate connection attempt
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            // In a real app, this would make an actual network request
            // For now, we'll simulate a successful connection
            let cleanUrl = urlText.trimmingCharacters(in: .whitespacesAndNewlines)

            // Basic URL validation
            if let url = URL(string: cleanUrl), url.host != nil {
                onConnect(cleanUrl)
            } else {
                errorMessage = "Invalid URL format. Please check your input."
            }

            isConnecting = false
        }
    }
}

#Preview {
    ConnectionView(onConnect: { _ in })
}