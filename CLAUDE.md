# X402 Solana Gateway - Claude Development Guide

## Project Overview

This is a **payment gateway middleware service** implementing the X402 payment protocol to monetize API endpoints using blockchain micropayments. The gateway acts as a reverse proxy that enforces payment verification before forwarding requests to upstream services.

**Purpose**: Enable pay-per-use API access with seamless Solana (and multi-blockchain) payment integration.

**Technology Stack**:
- **Framework**: Hono.js v4.8.3 (lightweight web framework)
- **Runtime**: Node.js + TypeScript
- **Payment Protocol**: @coinbase/x402 v0.7.0 + x402-hono v0.7.0
- **Validation**: Zod v3.25.76
- **Configuration**: YAML + dotenv
- **Deployment**: Docker (Alpine-based, multi-stage build)

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      X402 Gateway Service                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐  │
│  │   Request    │───►│   Payment    │───►│     Proxy       │  │
│  │   Handler    │    │  Middleware  │    │   Forwarder     │  │
│  └──────────────┘    └──────────────┘    └─────────────────┘  │
│         │                   │                      │           │
│         ▼                   ▼                      ▼           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Configuration System                       │  │
│  │  - YAML Parser                                          │  │
│  │  - Zod Validators                                       │  │
│  │  - Environment Overrides                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Facilitator    │
                    │  (External API)  │
                    └──────────────────┘
```

### Request Flow

1. **Incoming Request** → CORS Middleware → Route Matching
2. **Route Types**:
   - Static assets (`/favicon.ico`, `/logo.png`)
   - Health checks (`/health`, `/x402/health`, `/x402/catalog`)
   - **Passthrough paths** (no payment) → Direct proxy to upstream
   - **Protected endpoints** → Payment verification → Proxy to upstream
3. **Response Processing** → Add payment info to JSON responses → Return to client

## Project Structure

```
x402-solana-gateway/
├── src/
│   ├── server/
│   │   ├── app-simplified.ts      # Main application (1018 lines)
│   │   │                          # - Route registration
│   │   │                          # - X402 middleware setup
│   │   │                          # - Request/response handling
│   │   │                          # - Error handling
│   │   └── simplified.ts          # Entry point (executor wrapper)
│   │
│   └── config/
│       ├── gateway.ts             # Configuration loader
│       │                          # - YAML parsing
│       │                          # - Environment variable overrides
│       │                          # - Validation orchestration
│       │
│       └── schema.ts              # Zod validation schemas (479 lines)
│                                  # - PaymentProfile schema
│                                  # - ProtectedEndpoint schema
│                                  # - RouterConfig schema
│                                  # - GatewayConfig schema
│
├── config/
│   ├── gateway.yaml               # Main configuration file
│   │                              # - Payment profiles (x402_payment)
│   │                              # - Router configurations (x402_routers)
│   │
│   └── gateway-bazaar-example.yaml  # Example configuration
│
├── public/                        # Static assets
│   ├── favicon.ico
│   └── logo.png
│
├── dist/                          # Compiled TypeScript output
├── Dockerfile                     # Production container (Alpine-based)
├── docker-compose.yml             # Container orchestration
├── package.json                   # Dependencies & scripts
└── .env.example                   # Environment template
```

## Key Files Deep Dive

### 1. `src/server/app-simplified.ts` (Main Application - 1018 lines)

**Sections**:

- **Lines 1-45**: Initialization
  - Load environment variables
  - Create Hono app with CORS
  - Serve static files

- **Lines 53-320**: Health & Info Endpoints
  - `GET /` - Root health check
  - `GET /health` - Service health
  - `GET /x402/health` - Configuration status with payment profiles
  - `GET /x402/catalog` - Complete API catalog with pricing

- **Lines 326-423**: X402 Middleware Factory
  - `createX402Middleware()` function
  - Configures payment verification
  - Supports both standard and CDP facilitators
  - Returns Hono middleware

- **Lines 539-755**: Request Handlers
  - `handleProtectedRequest()` - Process paid requests
  - `proxyRequest()` - Forward passthrough requests
  - Response processing (JSON/text)
  - Request/response logging

- **Lines 764-858**: Dynamic Route Registration
  - Load YAML config via `loadGatewayConfig()`
  - Register passthrough routes (wildcard pattern matching)
  - Register protected endpoints with X402 middleware
  - Validate endpoint configurations

- **Lines 887-924**: Error Handling
  - 404 handler with route hints
  - Global error handler with stack traces

### 2. `src/config/gateway.ts` (Configuration Loader)

**Key Functions**:

- `loadGatewayConfig()`: Orchestrates the entire config loading process
  - Reads YAML file from `GATEWAY_CONFIG_PATH` env var
  - Parses YAML using `yaml` library
  - Validates against Zod schemas
  - Returns typed `GatewayConfig` object

- Environment override support for sensitive values

### 3. `src/config/schema.ts` (Validation Schemas - 479 lines)

**Schemas**:

1. **PaymentProfile**: Validates payment configuration
   - Required: `name`, `chain`, `facilitator_url`, `address`, `asset`, `token_name`
   - Optional: `use_cdp_facilitator` (boolean)
   - Validates address formats (Ethereum 0x / Solana Base58)
   - Validates URLs

2. **ProtectedEndpoint**: Validates endpoint configuration
   - Required: `name`, `method`, `path`, `payment`, `price`
   - HTTP methods: GET, POST, PUT, DELETE, PATCH
   - Path must start with `/`
   - Price must be numeric string

3. **RouterConfig**: Validates router settings
   - Required: `name`, `path`, `proxy_pass`
   - Optional: `headers`, `passthrough`, `x402_config`
   - Validates unique names
   - Cross-validates payment references

4. **GatewayConfig**: Root configuration schema
   - Required: `x402_payment`, `x402_routers`
   - Ensures payment profiles referenced by endpoints exist

### 4. `config/gateway.yaml` (Configuration Template)

**Structure**:

```yaml
# Payment Profiles
x402_payment:
  - name: solana-devnet
    chain: solana-devnet
    facilitator_url: "https://facilitator.payai.network"
    address: "YourWalletAddress"
    asset: "TokenContractAddress"
    token_name: "USDC"
    use_cdp_facilitator: false  # Optional

# Router Configurations
x402_routers:
  - name: my-api
    path: '/api'
    proxy_pass: 'https://upstream-service.com'

    # Optional: Custom headers forwarded to upstream
    headers:
      Authorization: "Bearer token"
      X-Custom: "value"

    # Optional: Paths that bypass payment (wildcards supported)
    passthrough:
      - "/health"
      - "/docs*"
      - "/public/**"

    # Optional: Payment-protected endpoints
    x402_config:
      - name: query
        method: POST
        path: '/query'
        payment: solana-devnet  # References x402_payment.name
        price: '0.01'
```

## Environment Variables

### Required

- `GATEWAY_CONFIG_PATH`: Path to `gateway.yaml` (default: `./config/gateway.yaml`)

### Optional

- `NODE_ENV`: Environment mode (`development` | `production`)
- `PORT`: Server port (default: `3000`)
- `LOG_LEVEL`: Logging level (`debug` | `info` | `warn` | `error`)
- `DEBUG_REQUEST_RESPONSE`: Log full requests/responses (`true` | `false`)
- `PUBLIC_BASE_URL`: Public base URL for catalog endpoint
- `CDP_API_KEY_ID`: Coinbase CDP API key ID (for CDP facilitator)
- `CDP_API_KEY_SECRET`: Coinbase CDP API secret (for CDP facilitator)

## Development Workflow

### Initial Setup

```bash
# Install dependencies
pnpm install

# Create environment file
cp .env.example .env

# Create gateway configuration
cp config/gateway.yaml.example config/gateway.yaml

# Edit configuration files
vim .env
vim config/gateway.yaml
```

### Development Commands

```bash
# Start development server (port 3101 with hot-reload)
pnpm run dev

# Build TypeScript + copy assets to dist/
pnpm run build

# Run production build
pnpm start

# Format code with Prettier
pnpm run format

# Type check
npx tsc --noEmit
```

### Docker Development

```bash
# Build and run container
docker-compose up

# Build only
docker build -t x402-gateway .

# Run with custom port
docker run -p 8080:3000 x402-gateway
```

## Configuration Guidelines

### Adding a New Payment Profile

1. Add to `x402_payment` array in `gateway.yaml`:

```yaml
x402_payment:
  - name: base-mainnet          # Unique identifier
    chain: base                 # Network name
    facilitator_url: "https://facilitator.example.com"
    address: "0xYourEthAddress" # Receiving wallet
    asset: "0xTokenContract"    # Token contract
    token_name: "USDC"
    use_cdp_facilitator: true   # Optional: Use CDP
```

2. Validation will automatically check:
   - Name is unique
   - Chain is supported
   - URLs are valid
   - Address format matches network

### Adding a New Protected Endpoint

1. Add to router's `x402_config` array:

```yaml
x402_routers:
  - name: my-api
    x402_config:
      - name: new-endpoint        # Unique within router
        method: POST
        path: '/new-endpoint'     # Relative to router path
        payment: solana-devnet    # Must reference existing profile
        price: '0.05'             # Price in token units
```

2. Full path will be: `<router.path> + <endpoint.path>`
   - Example: `/api` + `/new-endpoint` = `/api/new-endpoint`

### Adding Passthrough Paths

```yaml
x402_routers:
  - name: my-api
    passthrough:
      - "/exact-path"      # Exact match
      - "/prefix*"         # Wildcard suffix
      - "/nested/**"       # Recursive wildcard
```

Pattern matching uses glob-style wildcards:
- `*` matches any characters except `/`
- `**` matches any characters including `/`

### Custom Headers

Forward authentication to upstream services:

```yaml
headers:
  Authorization: "Bearer ${UPSTREAM_TOKEN}"  # Env var substitution
  X-API-Key: "static-key"
  X-Custom: "value"
```

Headers are merged with incoming request headers and forwarded to upstream.

## Supported Blockchain Networks

| Chain Value | Network | Testnet/Mainnet | Address Format |
|------------|---------|-----------------|----------------|
| `solana` | Solana | Mainnet | Base58 |
| `solana-devnet` | Solana | Devnet | Base58 |
| `base` | Base (Coinbase) | Mainnet | 0x... |
| `base-sepolia` | Base | Sepolia Testnet | 0x... |
| `avalanche` | Avalanche | Mainnet | 0x... |
| `avalanche-fuji` | Avalanche | Fuji Testnet | 0x... |
| `iotex` | IoTeX | Mainnet | 0x... |
| `iotex-testnet` | IoTeX | Testnet | 0x... |

## API Endpoints

### Built-in Endpoints

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|----------------|
| `/` | GET | Root health check | None |
| `/health` | GET | Service health status | None |
| `/x402/health` | GET | X402 config status | None |
| `/x402/catalog` | GET | API catalog with pricing | None |
| `/favicon.ico` | GET | Static favicon | None |
| `/logo.png` | GET | Static logo | None |

### Dynamic Endpoints

All endpoints defined in `x402_routers` configuration are dynamically registered at startup.

**Passthrough endpoints**: No payment required, direct proxy to upstream
**Protected endpoints**: Payment verification required via X402 middleware

## Payment Verification Flow

1. **Client Request**:
   - Includes `X-Payment-Proof` header with blockchain payment proof
   - Contains payment metadata (amount, recipient, token)

2. **Gateway Processing**:
   - X402 middleware extracts payment proof
   - Validates proof format
   - Sends to facilitator for verification

3. **Facilitator Verification**:
   - Checks blockchain transaction
   - Validates signature
   - Confirms amount matches endpoint price
   - Returns verification result

4. **Gateway Response**:
   - If valid: Proxy request to upstream service
   - If invalid: Return `402 Payment Required` error
   - Add payment info to JSON responses

## Debugging and Troubleshooting

### Enable Debug Logging

```bash
# .env file
LOG_LEVEL=debug
DEBUG_REQUEST_RESPONSE=true
```

This will log:
- Full request details (method, path, headers, body)
- Payment verification steps
- Proxy forwarding details
- Full response data
- Error stack traces

### Common Issues

**"Payment profile not found"**

- Check `payment` field in endpoint config references existing `x402_payment.name`
- Verify YAML indentation is correct

**"Address format invalid"**

- Solana addresses must be Base58 format
- Ethereum/Base/Avalanche/IoTeX addresses must be `0x...` format

**"Facilitator connection failed"**

- Verify `facilitator_url` is accessible
- Check network connectivity
- Ensure facilitator service is running

**"Upstream proxy error"**

- Verify `proxy_pass` URL is correct
- Check upstream service is accessible
- Review custom headers configuration
- Check path rewriting (router path is stripped before forwarding)

**"YAML parsing error"**

- Validate YAML syntax (use online validator)
- Check proper indentation (use spaces, not tabs)
- Ensure all strings with special chars are quoted

### Testing Endpoints

```bash
# Test health check
curl http://localhost:3000/health

# Test catalog
curl http://localhost:3000/x402/catalog

# Test passthrough endpoint
curl http://localhost:3000/api/health

# Test protected endpoint (requires payment proof)
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "X-Payment-Proof: <proof-data>" \
  -d '{"query": "test"}'
```

## Code Organization Principles

### Separation of Concerns

- **Configuration** (`src/config/`): Pure configuration loading and validation
- **Server** (`src/server/`): HTTP server and request handling
- **Validation** (`src/config/schema.ts`): Centralized Zod schemas
- **Static Assets** (`public/`): Static files served directly

### Type Safety

- All configuration objects are fully typed via Zod schemas
- TypeScript strict mode enabled
- Runtime validation matches compile-time types

### Error Handling

- Configuration errors fail fast at startup
- Request errors return appropriate HTTP status codes
- Global error handler catches unhandled exceptions
- Stack traces logged in development mode

## Git Workflow

### Current Branch

```
develop
```

### Recent Commits

- `b20d683` - feat(gateway): add custom headers support and fix path forwarding
- `9e78b1c` - feat(x402-client-js): add JavaScript/TypeScript client for X402 Solana payments

### Committing Changes

When making commits:

1. **Test thoroughly**:
   ```bash
   pnpm run build    # Ensure no TypeScript errors
   pnpm start        # Test production build
   ```

2. **Format code**:
   ```bash
   pnpm run format
   ```

3. **Commit with descriptive messages**:
   ```bash
   git add .
   git commit -m "feat(scope): concise description"
   ```

Use conventional commit prefixes:
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `chore:` - Build/tooling changes

## Production Deployment

### Pre-Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production `gateway.yaml` with mainnet settings
- [ ] Set secure environment variables (CDP keys if using)
- [ ] Test configuration validation
- [ ] Build and test Docker image
- [ ] Configure HTTPS reverse proxy (nginx/Caddy)
- [ ] Set up health check monitoring
- [ ] Configure log aggregation

### Docker Production Deployment

```bash
# Build production image
docker build -t x402-gateway:latest .

# Run with volume-mounted config
docker run -d \
  --name x402-gateway \
  -p 3000:3000 \
  -v /path/to/config:/app/config \
  -e NODE_ENV=production \
  -e GATEWAY_CONFIG_PATH=/app/config/gateway.yaml \
  -e CDP_API_KEY_ID="${CDP_API_KEY_ID}" \
  -e CDP_API_KEY_SECRET="${CDP_API_KEY_SECRET}" \
  --restart unless-stopped \
  x402-gateway:latest
```

### Security Considerations

- **Never commit**:
  - `.env` files
  - Private keys
  - API secrets
  - Production `gateway.yaml` with sensitive data

- **Use environment variables** for:
  - CDP API credentials
  - Upstream API keys
  - Sensitive configuration

- **Production hardening**:
  - Use HTTPS (configure reverse proxy)
  - Implement rate limiting
  - Enable CORS only for trusted origins
  - Monitor payment verification failures
  - Rotate API keys regularly
  - Use CDP facilitator for mainnet

## Testing Strategy

### Manual Testing

1. **Configuration Validation**:
   ```bash
   # Start server and check for config errors
   pnpm run dev
   ```

2. **Endpoint Testing**:
   ```bash
   # Test all built-in endpoints
   curl http://localhost:3000/health
   curl http://localhost:3000/x402/catalog

   # Test dynamic endpoints from catalog
   ```

3. **Payment Flow Testing**:
   - Use X402 client library to generate payment proofs
   - Test with different price points
   - Test invalid payment scenarios

### Integration Testing

- Test upstream service connectivity
- Verify custom headers are forwarded
- Test path rewriting (router prefix stripping)
- Validate response transformation (payment info injection)

## Extension Points

### Adding New Blockchain Support

1. Update `schema.ts` to accept new chain names
2. Configure payment profile with new chain
3. Ensure facilitator supports the chain
4. Test address validation for the chain format

### Custom Middleware

Add custom middleware in `app-simplified.ts`:

```typescript
// Before route registration
app.use('*', async (c, next) => {
  // Custom logic
  await next();
});
```

### Response Transformation

Modify response processing in `handleProtectedRequest()` to add custom data to responses.

## Monitoring and Observability

### Health Checks

- `GET /health` - Basic service health
- `GET /x402/health` - Configuration status with payment profiles

### Logging

Logs include:
- Request details (when `DEBUG_REQUEST_RESPONSE=true`)
- Payment verification results
- Proxy forwarding status
- Error stack traces (development mode)

### Metrics to Monitor

- Request rate per endpoint
- Payment verification success/failure rate
- Upstream service response times
- Error rates
- Payment amounts by endpoint

## Dependencies Overview

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `hono` | ^4.8.3 | Web framework |
| `@hono/node-server` | ^2.0.8 | Node.js adapter |
| `@coinbase/x402` | ^0.7.0 | X402 protocol |
| `x402-hono` | ^0.7.0 | X402 middleware |
| `zod` | ^3.25.76 | Schema validation |
| `yaml` | ^2.8.1 | YAML parsing |
| `dotenv` | ^16.6.1 | Environment variables |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.3.3 | TypeScript compiler |
| `tsx` | latest | TS execution |
| `prettier` | ^3.3.3 | Code formatting |
| `@types/node` | latest | Node.js types |

## Related Documentation

- [Hono Framework Docs](https://hono.dev)
- [X402 Protocol Specification](https://github.com/coinbase/x402)
- [Coinbase CDP Documentation](https://docs.cdp.coinbase.com/)
- [Solana Developer Docs](https://docs.solana.com/)

## Future Enhancements

Potential areas for expansion:

- [ ] Add automated tests (unit, integration)
- [ ] Implement request caching
- [ ] Add rate limiting per payment tier
- [ ] Support subscription-based pricing models
- [ ] Add WebSocket support for real-time endpoints
- [ ] Implement payment analytics dashboard
- [ ] Support multiple facilitators with failover
- [ ] Add request/response transformation plugins

---

**Last Updated**: 2025-11-04
**Maintainer**: Development Team
**Version**: 1.0.0
**Branch**: develop
