# Reachy Android Mobile Application

A native Android application for controlling Reachy Mini robots through the mobile API service. This application provides a modern, intuitive interface for robot control, data operations, and system configuration.

## 🏗️ Architecture

- **Architecture Pattern**: MVVM + Clean Architecture
- **UI Framework**: Jetpack Compose with Material Design 3
- **Navigation**: Navigation Compose with Single Activity
- **Dependency Injection**: Hilt
- **Networking**: Retrofit + OkHttp
- **Database**: Room (for local caching)
- **State Management**: StateFlow and Compose State

## 📱 Features

### Connection Screen
- HTTP/HTTPS URL input for server connection
- Support for VPN endpoints and local network addresses
- Connection validation and error handling
- JWT authentication integration

### Main Menu
- **Cards**: Robot control and applications management
- **Transfers**: Data operations and file management
- **Settings**: Configuration and preferences

### Core Capabilities
- Real-time robot state monitoring
- Application lifecycle management
- VPN configuration and status
- Network settings management
- Secure authentication with biometric support

## 🚀 Getting Started

### Prerequisites
- Android Studio Arctic Fox (2020.3.1) or later
- Android SDK API level 24+ (Android 7.0)
- Java 8 or later
- Gradle 7.0+

### Building the Project

1. **Clone the repository** (if not already done):
   ```bash
   cd /Users/user/cdev/exdevmobile-reachy/android-reachy
   ```

2. **Configure Android SDK path**:
   Update `local.properties` with your Android SDK location:
   ```
   sdk.dir=/path/to/your/Android/Sdk
   ```

3. **Build the project**:
   ```bash
   ./gradlew build
   ```

4. **Run on device/emulator**:
   ```bash
   ./gradlew installDebug
   ```

### Development Setup

1. **Open in Android Studio**:
   - File → Open → Select `/Users/user/cdev/exdevmobile-reachy/android-reachy`
   - Wait for Gradle sync to complete

2. **Run the app**:
   - Connect an Android device or start an emulator
   - Click the "Run" button or use `Shift + F10`

## 🔗 Integration with Mobile API

This Android application is designed to work with the existing mobile-api service located in `../mobile-api/`. The mobile API provides:

- **Authentication**: JWT token management with device registration
- **Robot Control**: Complete robot state and command APIs
- **VPN Management**: Full VPN profile and connection management
- **System Operations**: Diagnostics, logs, settings, and updates

### API Endpoints Used
- Authentication: `/api/v1/auth/*`
- Robot Control: `/api/v1/robot/*`
- Applications: `/api/v1/apps/*`
- System: `/api/v1/system/*`
- VPN: `/api/v1/vpn/*`
- Settings: `/api/v1/settings/*`

## 🏁 Current Status

### ✅ Phase 1 Complete: Foundation
- [x] Android project structure with Gradle Kotlin DSL
- [x] MVVM + Clean Architecture setup
- [x] Jetpack Compose UI with Material Design 3
- [x] Navigation system with type-safe routing
- [x] Connection screen with URL input
- [x] Main menu with three sections (Cards, Transfers, Settings)
- [x] Basic screen scaffolding for all main sections

### 🚧 Next Steps: Integration & Features
- [ ] Mobile API integration layer (repositories, use cases)
- [ ] Real authentication with JWT token management
- [ ] Cards screen: Robot status and control implementation
- [ ] Transfers screen: File operations and diagnostics
- [ ] Settings screen: Configuration management
- [ ] WebSocket integration for real-time updates
- [ ] Biometric authentication support
- [ ] Comprehensive error handling and offline support

## 📁 Project Structure

```
app/src/main/java/com/reachy/android/
├── presentation/                 # UI Layer
│   ├── screens/                 # Screen composables
│   │   ├── connection/          # URL input and authentication
│   │   ├── menu/               # Main menu navigation
│   │   ├── cards/              # Robot control cards
│   │   ├── transfers/          # Data operations
│   │   └── settings/           # Configuration
│   ├── navigation/             # Navigation setup
│   ├── theme/                  # Material Design theme
│   └── MainActivity.kt         # Single activity host
├── data/                       # Data Layer (to be implemented)
│   ├── local/                  # Room database and preferences
│   ├── remote/                 # Retrofit API interfaces
│   └── repository/             # Repository implementations
├── domain/                     # Domain Layer (to be implemented)
│   ├── model/                  # Domain models
│   ├── repository/             # Repository interfaces
│   └── usecase/                # Business logic use cases
├── di/                         # Dependency injection modules
└── ReachyApplication.kt        # Hilt application class
```

## 🔧 Configuration

### Build Types
- **Debug**: Development builds with logging and debugging enabled
- **Release**: Production builds with ProGuard obfuscation

### Key Dependencies
- Jetpack Compose: Latest stable version for declarative UI
- Hilt: For dependency injection across all layers
- Retrofit: For REST API communication with mobile-api
- Room: For local data persistence and offline support
- Navigation Compose: For type-safe navigation
- Material 3: For modern Android design language

## 🧪 Testing

### Test Structure (to be implemented)
- **Unit Tests**: ViewModels, repositories, and use cases
- **Integration Tests**: API communication and database operations
- **UI Tests**: Compose UI testing with interaction validation
- **End-to-end Tests**: Full user journey testing

### Running Tests
```bash
# Unit tests
./gradlew test

# Instrumentation tests
./gradlew connectedAndroidTest
```

## 🔐 Security

- JWT token secure storage using Android Keystore
- Certificate pinning for API communications
- Biometric authentication for sensitive operations
- ProGuard obfuscation for release builds
- Secure preferences for sensitive data

## 📝 License

This project is part of the Reachy Mini robot control system.

## 🤝 Contributing

This Android application integrates with the existing Reachy Mini ecosystem. For development:

1. Ensure the mobile-api service is running (`../mobile-api/`)
2. Follow Android development best practices
3. Maintain consistency with the existing codebase patterns
4. Add appropriate tests for new functionality

---

**Next Phase**: Complete the data layer integration with the mobile-api service to enable full robot control functionality.