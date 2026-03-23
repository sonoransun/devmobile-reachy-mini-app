# Reachy Control iOS Application

A native iOS application for controlling and monitoring Reachy Mini robots, built with SwiftUI and designed to work with the comprehensive REST API backend.

## Overview

This iOS application provides a clean, intuitive interface for connecting to Reachy robot systems via HTTP/HTTPS URLs, including VPN endpoints. The app features three main functional areas:

- **Cards** - Robot control and status monitoring
- **Transfers** - Data operations and file management
- **Settings** - Configuration management and VPN setup

## Features

### Connection Management
- HTTP/HTTPS URL input with validation
- Support for VPN endpoint URLs and local network addresses
- Connection testing with visual feedback
- Automatic reconnection handling

### Robot Control (Cards)
- Real-time robot status display
- Available applications management
- App launch/stop controls
- Quick movement commands (nod, shake, look around)
- Integration with WebSocket for live updates

### Data Operations (Transfers)
- File transfer capabilities
- Diagnostic data export
- System logs viewing and management
- Progress tracking for long-running operations
- Download/upload functionality

### Configuration (Settings)
- VPN profile management (OpenVPN, WireGuard, IPsec, Commercial)
- Network configuration and WiFi management
- Audio/video settings
- Application preferences
- System information display

## Architecture

### Technology Stack
- **UI Framework**: SwiftUI with iOS 16+ deployment target
- **Architecture**: MVVM pattern with clean separation of concerns
- **Navigation**: SwiftUI Navigation Stack for type-safe navigation
- **State Management**: SwiftUI @State and @StateObject for reactive UI updates
- **Networking**: URLSession for REST API communication (ready for integration)

### Project Structure
```
ReachyControl/
├── ReachyControlApp.swift          # App entry point
├── ContentView.swift               # Main navigation controller
├── Views/
│   ├── ConnectionView.swift        # URL input and connection screen
│   ├── MainMenuView.swift          # Tab-based main menu
│   ├── CardsView.swift             # Robot control interface
│   ├── TransfersView.swift         # Data operations screen
│   ├── SettingsView.swift          # Configuration management
│   ├── SystemLogsView.swift        # Log viewing interface
│   ├── VPNConfigurationView.swift  # VPN management
│   ├── NetworkSettingsView.swift   # Network configuration
│   └── DiagnosticExportView.swift  # Diagnostic data export
├── Assets.xcassets/                # App icons and images
└── Info.plist                     # App configuration and permissions
```

## Integration Points

### Mobile API Compatibility
The iOS application is designed to integrate seamlessly with the existing mobile-api backend:

- **Authentication**: JWT token management with device registration (`mobile-ios`)
- **Robot Control**: REST endpoints for robot status and movement commands
- **Applications**: App management via `/api/v1/apps/*` endpoints
- **VPN Management**: Full integration with `/api/v1/vpn/*` endpoints
- **Data Transfer**: File operations and diagnostic exports
- **Real-time Updates**: WebSocket connections for live robot state

### Network Security
- App Transport Security (ATS) configured for local development
- Support for HTTPS endpoints and certificate validation
- Local network access permissions for robot discovery
- VPN-compatible networking for remote access

## Development Setup

### Prerequisites
- Xcode 15.0 or later
- iOS 16.0+ deployment target
- Apple Developer account (for device testing)

### Building the Project
1. Open `ReachyControl.xcodeproj` in Xcode
2. Select your development team in project settings
3. Choose a target device or simulator
4. Build and run the project

### Configuration
Update the following files as needed:
- `Info.plist` - App permissions and bundle configuration
- Project settings - Bundle identifier and signing certificates

## Current Implementation Status

### Completed Features
✅ Project structure and Xcode configuration
✅ SwiftUI navigation and tab-based interface
✅ Connection screen with URL validation
✅ Robot control cards with mock data
✅ Transfer operations interface
✅ Settings and configuration screens
✅ VPN profile management UI
✅ System logs viewer
✅ Diagnostic export functionality

### Ready for Integration
🔄 REST API service layer implementation
🔄 WebSocket integration for real-time updates
🔄 JWT authentication flow
🔄 Actual VPN profile management
🔄 File transfer implementation
🔄 Network discovery features

### Future Enhancements
- Push notifications for system alerts
- Offline mode with local data caching
- Biometric authentication for sensitive operations
- Background task management for continuous monitoring
- Advanced robot visualization and control interfaces

## Design Principles

### User Experience
- **Mobile-First**: Optimized for touch interaction and mobile usage patterns
- **Intuitive Navigation**: Clear tab-based structure with logical information hierarchy
- **Visual Feedback**: Progress indicators, status badges, and connection states
- **Error Handling**: Graceful error states with actionable user guidance

### iOS Integration
- **System Design**: Follows Apple Human Interface Guidelines
- **Native Feel**: Uses system fonts, colors, and interaction patterns
- **Accessibility**: Compatible with VoiceOver and other accessibility features
- **Performance**: Efficient state management and memory usage

This iOS application complements the Android version and provides a native iOS experience for Reachy robot control while leveraging the existing comprehensive mobile-api infrastructure.