# X402 Solana Gateway

A production-ready payment gateway middleware that implements the X402 payment protocol to monetize API endpoints using blockchain micropayments on Solana and other supported networks.

## Overview

X402 Solana Gateway acts as a reverse proxy that sits between API consumers and upstream services, enforcing payment verification before forwarding requests. It enables pay-per-use API access with seamless blockchain payment integration.

### Key Features

- **Payment-Protected API Endpoints** - Enforce micropayments for API access using Solana blockchain
- **Flexible Routing** - Mix free passthrough endpoints with payment-protected ones
- **Multi-Blockchain Support** - Solana, Base, Avalanche, IoTeX networks
- **Dual Facilitator Support** - Standard X402 facilitator or Coinbase CDP
- **Custom Headers** - Forward authentication headers to upstream services
- **Path Rewriting** - Automatic path transformation before proxying
- **Service Catalog** - Auto-generated API documentation with pricing
- **Docker Ready** - Production-optimized containerized deployment

## Architecture

```
┌─────────────┐          ┌──────────────────┐          ┌──────────────┐
│   Client    │          │  X402 Gateway    │          │   Upstream   │
│             │          │                  │          │   Service    │
│  + Wallet   ├─────────►│  1. Verify      ├─────────►│              │
│             │  Request │     Payment      │  Proxied │   API        │
│             │◄─────────┤  2. Route        │◄─────────┤              │
└─────────────┘ Response │  3. Proxy        │ Response └──────────────┘
                         └──────────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │   Facilitator    │
                         │  (Payment Proof  │
                         │   Verification)  │
                         └──────────────────┘
```

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm (recommended) or npm
- Docker (optional, for containerized deployment)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd x402-solana-gateway

# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env

# Configure gateway settings
cp config/gateway.yaml.example config/gateway.yaml
```

### Configuration

#### 1. Environment Variables (`.env`)

```bash
# Server
NODE_ENV=development
PORT=3000

# Configuration
GATEWAY_CONFIG_PATH=./config/gateway.yaml

# Logging
DEBUG_REQUEST_RESPONSE=false
LOG_LEVEL=info

# Optional: Coinbase CDP (for mainnet)
# CDP_API_KEY_ID=organizations/your-org-id/apiKeys/your-key-id
# CDP_API_KEY_SECRET=0xYour64ByteEd25519PrivateKey

# Optional: Public base URL for catalog
# PUBLIC_BASE_URL=https://your-domain.com
```

#### 2. Gateway Configuration (`config/gateway.yaml`)

```yaml
x402_payment:
  - name: solana-devnet
    chain: solana-devnet
    facilitator_url: "https://facilitator.payai.network"
    address: "YourSolanaWalletAddress"
    asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"  # USDC on Solana devnet
    token_name: "USDC"

x402_routers:
  - name: my-api
    path: '/api'
    proxy_pass: 'https://my-upstream-service.com/api'
    headers:
      api-key: "your-upstream-api-key"
    passthrough:
      - "/health"
      - "/docs*"
    x402_config:
      - name: query
        method: POST
        path: '/query'
        payment: solana-devnet
        price: '0.01'  # 0.01 USDC per request
```

### Running

```bash
# Development mode (with hot-reload)
pnpm run dev

# Production build
pnpm run build
pnpm start

# Docker
docker-compose up
```

The gateway will start on `http://localhost:3000` (or your configured PORT).

## Usage

### Payment-Protected Endpoint

```bash
# 1. Client calls protected endpoint with payment proof
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "X-Payment-Proof: <blockchain-payment-proof>" \
  -d '{"query": "your query here"}'

# 2. Gateway verifies payment through facilitator
# 3. If valid, proxies request to upstream service
# 4. Returns response with payment info
```

### Passthrough Endpoint (No Payment)

```bash
# Direct proxy to upstream without payment verification
curl http://localhost:3000/api/health
```

### Service Catalog

```bash
# Get all available endpoints with pricing
curl http://localhost:3000/x402/catalog
```

Response:
```json
{
  "routers": [
    {
      "name": "my-api",
      "endpoints": [
        {
          "path": "/api/query",
          "method": "POST",
          "price": "0.01",
          "currency": "USDC",
          "chain": "solana-devnet"
        }
      ]
    }
  ]
}
```

## Configuration Reference

### Payment Profiles (`x402_payment`)

| Field | Description | Required |
|-------|-------------|----------|
| `name` | Unique identifier for this payment profile | Yes |
| `chain` | Blockchain network (e.g., `solana-devnet`, `base`) | Yes |
| `facilitator_url` | X402 facilitator endpoint URL | Yes |
| `address` | Your receiving wallet address | Yes |
| `asset` | Token contract address (USDC, etc.) | Yes |
| `token_name` | Display name for the token | Yes |
| `use_cdp_facilitator` | Use Coinbase CDP facilitator (default: false) | No |

### Router Configuration (`x402_routers`)

| Field | Description | Required |
|-------|-------------|----------|
| `name` | Unique router identifier | Yes |
| `path` | Base path for this router (e.g., `/api`) | Yes |
| `proxy_pass` | Upstream service URL | Yes |
| `headers` | Custom headers to forward to upstream | No |
| `passthrough` | Paths that bypass payment (supports wildcards) | No |
| `x402_config` | Array of payment-protected endpoints | No |

### Protected Endpoint (`x402_config`)

| Field | Description | Required |
|-------|-------------|----------|
| `name` | Unique endpoint identifier | Yes |
| `method` | HTTP method (GET, POST, PUT, DELETE, PATCH) | Yes |
| `path` | Endpoint path (relative to router path) | Yes |
| `payment` | Reference to payment profile name | Yes |
| `price` | Price in token units (e.g., "0.01" for 0.01 USDC) | Yes |

## Supported Blockchains

| Network | Mainnet | Testnet |
|---------|---------|---------|
| Solana | `solana` | `solana-devnet` |
| Base (Coinbase) | `base` | `base-sepolia` |
| Avalanche | `avalanche` | `avalanche-fuji` |
| IoTeX | `iotex` | `iotex-testnet` |

## API Endpoints

### Gateway Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Root health check |
| `/health` | GET | Service health status |
| `/x402/health` | GET | X402 configuration status |
| `/x402/catalog` | GET | Complete API catalog with pricing |
| `/favicon.ico` | GET | Static favicon |
| `/logo.png` | GET | Static logo |

### Dynamic Endpoints

All endpoints defined in `x402_routers` are dynamically registered at startup.

## Development

### Project Structure

```
x402-solana-gateway/
├── src/
│   ├── server/
│   │   ├── app-simplified.ts      # Main application logic
│   │   └── simplified.ts          # Entry point
│   └── config/
│       ├── gateway.ts             # Configuration loader
│       └── schema.ts              # Zod validation schemas
├── config/
│   ├── gateway.yaml               # Main configuration
│   └── gateway-bazaar-example.yaml
├── public/                         # Static assets
├── dist/                           # Compiled output
├── Dockerfile                      # Production container
├── docker-compose.yml
└── package.json
```

### Scripts

```bash
pnpm run dev          # Start development server (port 3101)
pnpm run build        # Compile TypeScript + copy assets
pnpm start            # Run production build
pnpm run format       # Format code with Prettier
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3000` | Server port |
| `GATEWAY_CONFIG_PATH` | `./config/gateway.yaml` | Config file path |
| `LOG_LEVEL` | `info` | Logging level |
| `DEBUG_REQUEST_RESPONSE` | `false` | Log full requests/responses |
| `CDP_API_KEY_ID` | - | Coinbase CDP API key ID |
| `CDP_API_KEY_SECRET` | - | Coinbase CDP API secret |
| `PUBLIC_BASE_URL` | - | Public base URL for catalog |

## Docker Deployment

### Build and Run

```bash
# Using docker-compose
docker-compose up -d

# Or manually
docker build -t x402-solana-gateway .
docker run -p 3000:3000 \
  -v $(pwd)/config:/app/config \
  -e GATEWAY_CONFIG_PATH=/app/config/gateway.yaml \
  x402-solana-gateway
```

### Production Considerations

- Mount configuration directory as volume
- Pass environment variables via `-e` or `.env` file
- Use health check endpoints for monitoring
- Configure reverse proxy (nginx/Caddy) for HTTPS
- Set `NODE_ENV=production`

## Advanced Configuration

### Using Coinbase CDP Facilitator

For mainnet deployments with higher security requirements:

1. Create Coinbase CDP account and get API credentials
2. Set environment variables:
```bash
CDP_API_KEY_ID=organizations/abc-123/apiKeys/def-456
CDP_API_KEY_SECRET=0xYour64ByteEd25519PrivateKey
```

3. Enable in payment profile:
```yaml
x402_payment:
  - name: base-mainnet
    chain: base
    use_cdp_facilitator: true  # Enable CDP
    # ... other settings
```

### Custom Headers

Forward authentication headers to upstream services:

```yaml
x402_routers:
  - name: protected-api
    headers:
      Authorization: "Bearer ${UPSTREAM_API_TOKEN}"
      X-Custom-Header: "value"
```

### Wildcard Passthrough Paths

Use glob patterns for flexible passthrough rules:

```yaml
passthrough:
  - "/public/*"      # All paths under /public
  - "/docs/**"       # All paths under /docs (recursive)
  - "/*.html"        # All HTML files
```

## Troubleshooting

### Common Issues

**Payment verification fails**

- Check facilitator URL is accessible
- Verify wallet address is correct
- Ensure token contract address matches network
- Check payment proof format

**Upstream proxy errors**

- Verify `proxy_pass` URL is correct
- Check custom headers are valid
- Ensure upstream service is accessible
- Review path rewriting configuration

**Configuration validation errors**

- Run with `LOG_LEVEL=debug` for detailed errors
- Verify YAML syntax is correct
- Check all referenced payment profiles exist
- Ensure addresses match network format

### Debugging

```bash
# Enable detailed logging
export LOG_LEVEL=debug
export DEBUG_REQUEST_RESPONSE=true
pnpm run dev
```

## Security Considerations

- **Never commit** `.env` files or private keys to version control
- Use environment variables for sensitive configuration
- Rotate API keys regularly
- Use HTTPS in production (configure reverse proxy)
- Validate all upstream responses
- Monitor payment verification failures
- Implement rate limiting for public endpoints

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and formatting
5. Submit a pull request

## License

[Add your license here]

## Support

For issues and questions:
- GitHub Issues: [repository-url]/issues
- Documentation: [docs-url]

## Related Projects

- [x402-hono](https://github.com/coinbase/x402-hono) - X402 middleware for Hono
- [@coinbase/x402](https://github.com/coinbase/x402) - X402 protocol implementation
- [Hono](https://hono.dev) - Web framework

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

---

Built with Hono and X402 Protocol | Powered by Solana
