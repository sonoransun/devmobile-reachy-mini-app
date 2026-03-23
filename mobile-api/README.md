# Reachy Mini Mobile API Service

A comprehensive REST API service that exposes all desktop application features for mobile access via VPN. Designed for React Native cross-platform apps and Progressive Web Apps with enterprise-grade security and VPN optimization.

## Features

- **Complete Feature Parity**: All robot control, app management, system administration, and media streaming capabilities
- **Mobile-Optimized**: Request batching, data compression, adaptive streaming, bandwidth optimization
- **VPN-Resilient**: High latency tolerance, circuit breakers, exponential backoff, connection quality adaptation
- **Enterprise Security**: JWT authentication, device registration, audit logging, rate limiting
- **Cross-Platform**: React Native and PWA support with platform-specific optimizations

## API Overview

### Base URL
```
Production: https://api.reachy-mini.com/api/v1
Development: http://localhost:3001/api/v1
```

### Authentication
```http
Authorization: Bearer <jwt_token>
X-Device-ID: <unique_device_id>
X-App-Version: <mobile_app_version>
X-Platform: mobile-ios|mobile-android|pwa
```

### Core Endpoints

#### Robot Control
- `POST /robot/move/target` - Continuous movement control
- `POST /robot/move/expression` - Play emotions and expressions
- `POST /robot/move/choreography` - Execute choreographies and dances
- `WS /robot/state/stream` - Real-time robot state (adaptive 20Hz→10Hz→5Hz)

#### Application Management
- `GET /apps/available` - Browse Hugging Face applications
- `POST /apps/install` - Install applications (async job)
- `POST /apps/{id}/start` - Start application
- `DELETE /apps/{id}` - Uninstall application

#### System Management
- `GET /system/info` - System information and health
- `GET /system/logs` - Paginated system logs
- `POST /system/diagnostics/export` - Export diagnostic bundle

#### Audio/Video
- `GET /audio/volume` - Volume control
- `GET /audio/microphone` - Microphone and DoA settings
- `GET /media/webrtc/offer` - WebRTC camera streaming

#### Network & Settings
- `GET /network/wifi/status` - WiFi connection status
- `POST /network/wifi/connect` - Connect to WiFi network
- `GET /settings` - Application settings and preferences

## Mobile Optimizations

### Data Compression
- **Robot State**: Protocol Buffers (60% smaller than JSON)
- **Static Data**: JSON with aggressive caching
- **Responses**: Gzip compression for all text responses

### Network Resilience
- **Adaptive Timeouts**: 10s direct, 15s VPN, 30s poor conditions
- **Circuit Breaker**: 5 failures = 60s timeout, gradual recovery
- **Exponential Backoff**: 1s → 2s → 4s → 8s → 30s max
- **Request Batching**: Multiple operations in single HTTP request

### Real-time Streaming
- **WebSocket Primary**: Adaptive frequency based on network conditions
- **Server-Sent Events**: Fallback for notifications
- **HTTP Polling**: Emergency fallback at 2s intervals

## Development

### Prerequisites
- Node.js 18+
- Python 3.9+ (for robot daemon communication)
- Redis (for session management and caching)
- PostgreSQL (for audit logs and device management)

### Installation
```bash
npm install
npm run dev        # Start development server
npm run test       # Run test suite
npm run build      # Production build
```

### Environment Variables
```env
NODE_ENV=development|production
API_PORT=3001
JWT_SECRET=your-jwt-secret
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://localhost:5432/reachy_mobile_api
ROBOT_DAEMON_URL=http://localhost:8000
```

## Architecture

### Core Components
1. **API Gateway** - Request routing, authentication, rate limiting
2. **Authentication Service** - JWT tokens, device registration, session management
3. **Robot Proxy** - Interfaces with existing Python daemon (port 8000)
4. **WebSocket Manager** - Real-time streaming with adaptive quality
5. **Batch Processor** - Request batching and optimization
6. **Circuit Breaker** - Network resilience and error recovery

### Data Flow
```
Mobile App → API Gateway → Authentication → Rate Limiting → Router
    ↓
Circuit Breaker → Robot Proxy → Python Daemon (port 8000)
    ↓
Response Compression → Caching → Mobile App
```

### WebSocket Architecture
```
Mobile App ↔ WebSocket Manager ↔ Robot State Stream (20Hz)
    ↓
Quality Adaptation (20Hz→10Hz→5Hz based on network)
    ↓
Protocol Buffer Encoding → Mobile App
```

## Security

### Authentication Flow
1. **Device Registration**: Generate device-specific credentials
2. **Login**: Exchange credentials for JWT access/refresh token pair
3. **Request Authentication**: Bearer token validation on every request
4. **Token Refresh**: Automatic refresh before expiration

### Security Features
- **JWT Tokens**: 1h access, 30d refresh tokens
- **Device Binding**: Tokens tied to specific device IDs
- **Rate Limiting**: Per-device and per-endpoint limits
- **Audit Logging**: All API calls logged with correlation IDs
- **Input Validation**: Comprehensive request validation and sanitization

## Monitoring & Observability

### Metrics (Prometheus)
- API response times and error rates
- WebSocket connection counts and quality
- Robot command success/failure rates
- Network quality and adaptation events

### Logging (Structured JSON)
- API access logs with correlation IDs
- Error logs with stack traces and context
- Performance metrics and slow queries
- Security events and authentication failures

### Health Checks
- `/health` - Basic API health
- `/health/detailed` - Component health status
- `/health/robot` - Robot daemon connectivity

## Documentation

- **OpenAPI Specification**: `/docs/openapi.yaml`
- **Interactive API Docs**: `/docs` (Swagger UI)
- **Mobile Integration Guides**: `/docs/mobile/`
- **WebSocket Protocol**: `/docs/websocket.md`

## Testing

### Test Coverage
- Unit tests for all API endpoints
- Integration tests for robot communication
- Load tests for concurrent mobile connections
- Network resilience tests (latency, packet loss)
- Security tests (authentication, authorization)

### Test Commands
```bash
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:load          # Load testing with Artillery
npm run test:security      # Security and penetration tests
```

## Deployment

### Docker
```bash
docker build -t reachy-mobile-api .
docker run -p 3001:3001 reachy-mobile-api
```

### Production Considerations
- **Load Balancing**: Multiple API instances behind load balancer
- **SSL/TLS**: HTTPS with certificate management
- **Database**: Connection pooling and read replicas
- **Caching**: Redis for session and response caching
- **Monitoring**: Prometheus + Grafana dashboards

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

Apache 2.0 - see LICENSE file for details