# Wormhole Data Provider Plugin

A plugin for collecting and normalizing cross-chain bridge metrics from Wormhole. This plugin is part of the NEAR Intents data collection system for building a comprehensive dashboard comparing quotes and liquidity depth across bridge providers.

## Features

- **Volume Metrics**: Collects trading volume for 24h, 7d, and 30d time windows
- **Rate Quotes**: Fetches exchange rates and fees for cross-chain routes with proper decimal normalization
- **Liquidity Depth**: Measures maximum input amounts at 0.5% and 1.0% slippage thresholds
- **Asset Listing**: Retrieves list of supported assets across all Wormhole-enabled chains

## Resilience Features

- **Retry Logic**: Automatic retries with exponential backoff (configurable up to 10 retries)
- **Rate Limiting**: Per-provider rate limiting to respect Wormhole API limits (configurable requests per second)
- **Error Handling**: Comprehensive error handling with fallback data when API is unavailable
- **Timeout Protection**: Configurable request timeouts to prevent hanging requests

## Installation

```bash
# Install dependencies
bun install

# Or with npm
npm install
```

## Configuration

### Environment Variables

The plugin uses environment variables for configuration:

```bash
# Required
WORMHOLE_API_KEY=your_wormhole_api_key

# Optional
WORMHOLE_BASE_URL=https://api.wormhole.com  # Default: https://api.wormhole.com
WORMHOLE_TIMEOUT=10000                      # Default: 10000ms
WORMHOLE_REQUESTS_PER_SECOND=10             # Default: 10
WORMHOLE_MAX_RETRIES=3                      # Default: 3
```

### Plugin Configuration

When initializing the plugin, you can configure it programmatically:

```typescript
import WormholePlugin from "@every-plugin/wormhole";

const config = {
  variables: {
    baseUrl: process.env.WORMHOLE_BASE_URL || "https://api.wormhole.com",
    timeout: parseInt(process.env.WORMHOLE_TIMEOUT || "10000"),
    requestsPerSecond: parseInt(process.env.WORMHOLE_REQUESTS_PER_SECOND || "10"),
    maxRetries: parseInt(process.env.WORMHOLE_MAX_RETRIES || "3"),
  },
  secrets: {
    apiKey: process.env.WORMHOLE_API_KEY || "",
  },
};
```

## Usage

### Basic Usage

```typescript
import { createLocalPluginRuntime } from "every-plugin/testing";
import WormholePlugin from "@every-plugin/wormhole";

const runtime = createLocalPluginRuntime(
  { registry: {} },
  { "@every-plugin/wormhole": WormholePlugin }
);

const { client } = await runtime.usePlugin("@every-plugin/wormhole", {
  variables: {
    baseUrl: "https://api.wormhole.com",
    timeout: 10000,
    requestsPerSecond: 10,
    maxRetries: 3,
  },
  secrets: {
    apiKey: "your-api-key",
  },
});

// Get snapshot of all metrics
const snapshot = await client.getSnapshot({
  routes: [
    {
      source: {
        chainId: "1",
        assetId: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        symbol: "USDC",
        decimals: 6,
      },
      destination: {
        chainId: "137",
        assetId: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        symbol: "USDC",
        decimals: 6,
      },
    },
  ],
  notionals: ["1000000", "10000000"], // Amounts in smallest units
  includeWindows: ["24h", "7d", "30d"],
});

console.log("Volumes:", snapshot.volumes);
console.log("Rates:", snapshot.rates);
console.log("Liquidity:", snapshot.liquidity);
console.log("Assets:", snapshot.listedAssets.assets);
```

### Health Check

```typescript
const health = await client.ping();
console.log(health); // { status: "ok", timestamp: "2024-01-01T00:00:00.000Z" }
```

## Running Locally

### Development

```bash
# Start development server
bun dev

# Or with npm
npm run dev
```

### Testing

```bash
# Run all tests
bun test

# Run unit tests only
bun test src/__tests__/unit

# Run integration tests only
bun test src/__tests__/integration

# Watch mode
bun test:watch

# Coverage
bun coverage
```

### Building

```bash
# Build for production
bun build

# Type check
bun type-check
```

## How Data is Derived

### Volume Metrics

Volume data is fetched from Wormhole's volume API endpoint (`/v1/volume`). The plugin supports three time windows:
- **24h**: Last 24 hours of volume
- **7d**: Last 7 days of volume
- **30d**: Last 30 days of volume

If the API is unavailable, the plugin uses conservative fallback estimates based on typical Wormhole volume patterns.

### Rate Quotes

Rate quotes are fetched from Wormhole's quote API endpoint (`/v1/quote`). The plugin:
1. Sends quote requests for each route/notional combination
2. Normalizes decimal differences between source and destination assets
3. Calculates `effectiveRate` as `(amountOut / 10^destDecimals) / (amountIn / 10^sourceDecimals)`
4. Extracts fee information from the API response or estimates fees at 0.05% if not provided

Example decimal normalization:
- Source: 1,000,000 (smallest units) with 6 decimals = 1.0 USDC
- Destination: 995,000 (smallest units) with 6 decimals = 0.995 USDC
- Effective Rate: 0.995 / 1.0 = 0.995 (0.5% fee)

### Liquidity Depth

Liquidity depth is calculated using a binary search approach:
1. Tests progressively larger amounts via the quote API
2. Calculates actual slippage for each amount
3. Finds the maximum input amount that doesn't exceed the target slippage threshold
4. Returns results for both 50 bps (0.5%) and 100 bps (1.0%) thresholds

The plugin includes fallback estimates if the API is unavailable:
- $2M at 0.5% slippage threshold
- $1M at 1.0% slippage threshold

### Asset Listing

Supported assets are fetched from Wormhole's assets API endpoint (`/v1/assets`). The plugin normalizes the response to include:
- `chainId`: Chain identifier (string)
- `assetId`: Asset address or identifier
- `symbol`: Asset symbol (e.g., "USDC")
- `decimals`: Number of decimals

If the API is unavailable, the plugin returns a fallback list of common Wormhole-supported assets across major chains.

## API Endpoints

The plugin uses the following Wormhole API endpoints:

- `GET /v1/volume` - Fetch volume metrics
- `POST /v1/quote` - Get rate quotes for routes
- `GET /v1/assets` - List supported assets
- `GET /v1/health` - Health check

All requests include:
- Authorization header (Bearer token) if API key is provided
- Content-Type: application/json
- Timeout protection

## Error Handling

The plugin implements comprehensive error handling:

1. **Rate Limiting (429)**: Automatically retries after the duration specified in `Retry-After` header
2. **Authentication Errors (401/403)**: Fails immediately without retry
3. **Server Errors (5xx)**: Retries with exponential backoff
4. **Network Errors**: Retries with exponential backoff
5. **Timeout Errors**: Retries with exponential backoff

When API calls fail after all retries, the plugin falls back to conservative estimates to ensure the plugin remains functional.

## Rate Limiting

The plugin respects Wormhole API rate limits through:

1. **Configurable Requests Per Second**: Limits concurrent requests (default: 10 req/s)
2. **Minimum Interval**: Ensures minimum time between requests
3. **Automatic Retry-After Handling**: Respects rate limit headers from API responses

Configure rate limiting via the `requestsPerSecond` variable.

## Retry Logic

Retries use exponential backoff:
- Initial delay: 1 second
- Maximum delay: 10 seconds
- Backoff multiplier: 2x per attempt

Configure retry behavior via the `maxRetries` variable (default: 3).

## Contract Compliance

This plugin implements the data provider contract specification exactly:

- **Field Names**: All field names match the contract exactly
- **Data Shapes**: All data structures conform to the contract schemas
- **Decimal Normalization**: `effectiveRate` is normalized for decimals while keeping raw strings for smallest units
- **Liquidity Thresholds**: Includes both 50 bps (≤0.5%) and 100 bps (≤1.0%) thresholds

## Testing

The plugin includes comprehensive tests:

- **Unit Tests**: Test service methods in isolation with mocked API responses
- **Integration Tests**: Test full plugin lifecycle with real API calls (when API is available) or fallback behavior

All tests should pass before submitting:

```bash
bun test
```

## Troubleshooting

### API Key Issues

If you receive authentication errors:
1. Verify your API key is correct
2. Check that the API key has the necessary permissions
3. Ensure the API key is not expired

### Rate Limiting Issues

If you encounter rate limiting:
1. Reduce `requestsPerSecond` configuration
2. Increase retry delays
3. Contact Wormhole support to request higher rate limits

### Timeout Issues

If requests timeout:
1. Increase `timeout` configuration (max: 60000ms)
2. Check network connectivity
3. Verify Wormhole API status

## Contributing

When contributing to this plugin:

1. **One Provider Per Plugin**: This plugin is for Wormhole only. Do not add other providers.
2. **Contract Compliance**: Do not change field names or shapes without discussion.
3. **Documentation**: Update this README when adding new features.
4. **Tests**: Ensure all tests pass before submitting changes.

## License

Part of the NEAR Intents data collection system.

## Support

For feedback and technical questions, join the Builder Chat:
- Telegram: https://t.me/+Xfx2Mx6pbRYxMzA5
