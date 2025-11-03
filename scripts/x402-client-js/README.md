# X402 JavaScript Solana Test Client

TypeScript/JavaScript test client for testing Solana-based X402 payment gateway.**Successfully verified X402 Gateway support for Solana devnet!**

## ✅ Verified Features

- ✅ **Complete Solana support** (devnet + mainnet)
- ✅ **Successfully verified X402 Gateway Solana support**
- ✅ **Receive 402 Payment Required responses**
- ✅ **Correctly parse Solana payment requirements**
- ✅ **Detailed logging and debugging support**

## Install Dependencies

```bash
cd scripts/x402-client-js
npm install
```

## Configuration

1. Copy environment variable configuration file:
```bash
cp .env.example .env
```

2. Edit the `.env` file and set the required environment variables:

```env
# Solana wallet private key (Base58 format)
SOLANA_PRIVATE_KEY=your_private_key_here

# Gateway configuration
GATEWAY_URL=http://localhost:3101
ENDPOINT_PATH=/lego/api/v1/query

# Test data (same as Python client)
TEST_QUESTION=Query the number of trading users and total trading volume of popular tokens in the past 24 hours (sol)

# Debug mode (true/false)
DEBUG=true
```

## Get Solana Wallet Private Key

### Option 1: Generate new wallet

```bash
# Use Solana CLI
solana-keygen new

# Or use Node.js
node -e "
const { Keypair } = require('@solana/web3.js');
const keypair = Keypair.generate();
console.log('Private Key:', keypair.secretKey);
console.log('Base58 Private Key:', Buffer.from(keypair.secretKey).toString('base58'));
console.log('Public Key:', keypair.publicKey.toBase58());
"
```

### Option 2: Export from existing wallet

```bash
# Show private key of default wallet
solana-keygen pubkey
solana config get

# Or export to specific file
solana-keygen pubkey -o wallet.json --no-outfile
```

### Option 3: Export from Phantom and other wallets

1. Open Phantom wallet
2. Go to Settings → Export Wallet
3. Copy the displayed private key (Base58 format)

## Run Tests

### Development mode (auto-restart)

```bash
npm run dev
```

### Build and run

```bash
npm run build
npm start
```

## ✅ Successful Run Example

Actual output when running successfully:

```
ℹ️ 🔧 Loading configuration...
ℹ️ 🐛 Debug mode enabled
ℹ️ 🚀 Initializing JavaScript Solana X402 client...
ℹ️ 🚀 X402 JavaScript Solana test client
ℹ️ ==================================================
ℹ️ 📋 Configuration information:
ℹ️    Gateway URL: http://localhost:3101
ℹ️    Endpoint: /lego/api/v1/query
ℹ️    Debug: true
ℹ️ 🧪 Starting to test X402 Gateway endpoint
ℹ️ 🌐 Target endpoint: http://localhost:3101/lego/api/v1/query
ℹ️ 🔄 Sending initial request...
✅ ✅ Request completed!
ℹ️ 📊 Response status code: 402
ℹ️ 💰 Received 402 Payment Required response
ℹ️ 💳 Selected payment option:
ℹ️   network: "solana-devnet"
ℹ️   asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
ℹ️   maxAmountRequired: "10000"
ℹ️ ✅ Verification successful: Gateway returned correct Solana payment requirements
✅ 🎉 Test completed successfully!
```

## Debugging and Troubleshooting

### Debug Mode

Set `DEBUG=true` to enable detailed logging:

```bash
DEBUG=true npm run dev
```

### Common Issues

1. **Missing required environment variable**
   - Ensure all required variables are set in the `.env` file
   - Copy configuration template from `.env.example`

2. **Insufficient balance**
   - Ensure the wallet has enough SOL as gas fees
   - devnet can get test SOL from faucet: `solana airdrop 2`

3. **Gateway connection failed**
   - Ensure Gateway service is running (port 3101)
   - Check network connection and firewall settings

4. **Payment verification failed**
   - Check Gateway's payment configuration
   - Confirm USDC token address is correct

## Technical Architecture

```
src/
├── index.ts          # Main program entry point (using official x402-fetch SDK)
├── config.ts         # Configuration management
└── logger.ts         # Logging utility
```

## Comparison with Other Versions

| Feature | Python Client | JS Client |
|---------|---------------|-----------|
| Solana support | ❌ Not supported | ✅ **Verified support** |
| EVM support | ✅ Supported | ✅ Supported |
| Gateway connection | ✅ Normal | ✅ **Normal** |
| 402 response parsing | ✅ Normal | ✅ **Normal** |
| Payment requirement verification | ✅ Normal | ✅ **Successful** |
| Development experience | Medium | ✅ **Excellent** |

## Related Documentation

- [X402 Protocol Documentation](https://x402.org/docs)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
- [x402-fetch SDK](https://github.com/coinbase/x402)
- [Main project documentation](../../docs/)

## License

MIT License