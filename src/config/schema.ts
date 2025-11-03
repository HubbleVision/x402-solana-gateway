/**
 * Gateway Configuration Schema Definition
 *
 * Uses Zod for type validation and runtime verification
 */

import { z } from 'zod';

// =============================================================================
// Basic Type Definitions
// =============================================================================

/**
 * Ethereum address format
 * Must start with 0x followed by 40 hexadecimal characters
 */
const EthereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Invalid Ethereum address format. Must be 0x followed by 40 hex characters',
  });

/**
 * Solana address format
 * Base58 encoded, typically 32-44 characters long
 */
const SolanaAddressSchema = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, {
    message: 'Invalid Solana address format. Must be Base58 encoded (32-44 characters)',
  });

/**
 * Universal blockchain address format
 * Supports both Ethereum (0x...) and Solana (Base58) addresses
 */
const BlockchainAddressSchema = z
  .string()
  .refine(
    (addr) => {
      // Check if it's Ethereum address format
      if (/^0x[a-fA-F0-9]{40}$/.test(addr)) {
        return true;
      }
      // Check if it's Solana address format
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) {
        return true;
      }
      return false;
    },
    {
      message: 'Invalid blockchain address. Must be either Ethereum (0x + 40 hex chars) or Solana (Base58, 32-44 chars)',
    }
  );

/**
 * Supported blockchain networks
 */
const NetworkSchema = z.enum([
  'base',           // Base mainnet
  'base-sepolia',   // Base testnet
  'avalanche',      // Avalanche mainnet
  'avalanche-fuji', // Avalanche testnet
  'iotex',          // IoTeX mainnet
  'iotex-testnet',  // IoTeX testnet
  'solana',         // Solana mainnet
  'solana-devnet',  // Solana devnet
], {
  errorMap: () => ({
    message: 'Invalid network. Supported: base, base-sepolia, avalanche, avalanche-fuji, iotex, iotex-testnet, solana, solana-devnet'
  }),
});

/**
 * HTTP methods
 */
const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'], {
  errorMap: () => ({
    message: 'Invalid HTTP method. Supported: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS'
  }),
});

/**
 * URL format
 */
const UrlSchema = z
  .string()
  .url({ message: 'Invalid URL format' })
  .refine((url) => url.startsWith('http://') || url.startsWith('https://'), {
    message: 'URL must start with http:// or https://',
  });

// =============================================================================
// Payment Profile Schema
// =============================================================================

/**
 * Payment profile configuration
 *
 * Defines a payment method, including network, Facilitator URL, receiving address, etc.
 */
export const PaymentProfileSchema = z.object({
  /**
   * Payment profile name (unique identifier)
   * Example: "base", "base-testnet"
   */
  name: z
    .string()
    .min(1, { message: 'Payment profile name cannot be empty' })
    .regex(/^[a-z0-9-_]+$/, {
      message: 'Payment profile name must contain only lowercase letters, numbers, hyphens and underscores'
    }),

  /**
   * Blockchain network
   */
  chain: NetworkSchema,

  /**
   * Standard X402 Facilitator URL (recommended)
   * Example: "https://x402.org/facilitator"
   */
  facilitator_url: UrlSchema.optional(),

  /**
   * Facilitator verification URL (for backward compatibility)
   * @deprecated Use facilitator_url instead
   */
  verify_url: UrlSchema.optional(),

  /**
   * Facilitator settlement URL (for backward compatibility)
   * @deprecated Use facilitator_url instead
   */
  settle_url: UrlSchema.optional(),

  /**
   * Receiving address (business wallet)
   * Supports both Ethereum and Solana addresses
   */
  address: BlockchainAddressSchema,

  /**
   * Payment asset contract address (usually USDC)
   * Supports both Ethereum contract addresses and Solana SPL Token addresses
   */
  asset: BlockchainAddressSchema,

  /**
   * Token name (for display)
   */
  token_name: z
    .string()
    .min(1, { message: 'Token name cannot be empty' })
    .max(20, { message: 'Token name must be at most 20 characters' }),
}).refine(
  (data) => {
    // Validate that at least facilitator_url or (verify_url + settle_url) is provided
    return data.facilitator_url || (data.verify_url && data.settle_url);
  },
  {
    message: 'Either facilitator_url or both verify_url and settle_url must be provided',
  }
);

export type PaymentProfile = z.infer<typeof PaymentProfileSchema>;

// =============================================================================
// Protected Endpoint Schema
// =============================================================================

/**
 * Protected endpoint configuration
 *
 * Defines an API endpoint that requires payment verification
 */
export const ProtectedEndpointSchema = z.object({
  /**
   * Endpoint name (unique identifier)
   */
  name: z
    .string()
    .min(1, { message: 'Endpoint name cannot be empty' })
    .regex(/^[a-z0-9-_]+$/, {
      message: 'Endpoint name must contain only lowercase letters, numbers, hyphens and underscores'
    }),

  /**
   * HTTP method
   */
  method: HttpMethodSchema,

  /**
   * Endpoint path (relative to router path)
   * Example: "/api/v1/query"
   */
  path: z
    .string()
    .min(1, { message: 'Endpoint path cannot be empty' })
    .regex(/^\//, { message: 'Endpoint path must start with /' }),

  /**
   * Payment profile name (references name in x402_payment)
   */
  payment: z.string().min(1, { message: 'Payment profile reference cannot be empty' }),

  /**
   * Price (USDC token units, e.g., "0.01" = 0.01 USDC)
   * Internally converted to micro units for calculation
   */
  price: z
    .string()
    .regex(/^\d*\.?\d+$/, { message: 'Price must be a valid decimal number string (e.g., "0.01", "1.5", "100")' })
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, { message: 'Price must be a positive number' }),

  /**
   * Timeout in milliseconds
   * Default: 300000 (5 minutes)
   */
  timeout_ms: z
    .number()
    .int()
    .positive()
    .max(600000, { message: 'Timeout must not exceed 600000ms (10 minutes)' })
    .optional()
    .default(300000),

  /**
   * Metadata (custom information)
   * Supported fields:
   * - discoverable: boolean - Whether to register with X402 Bazaar
   * - description: string - Endpoint description
   * - inputSchema: object - Input parameter schema (for Bazaar)
   * - outputSchema: object - Output result schema (for Bazaar)
   */
  metadata: z.object({
    /**
     * Whether to register with X402 Bazaar (effective only when using CDP Facilitator)
     */
    discoverable: z.boolean().optional().default(false),

    /**
     * Endpoint description (for Bazaar display)
     */
    description: z.string().optional(),

    /**
     * Input parameter schema (for Bazaar documentation generation and AI agent understanding)
     */
    inputSchema: z.record(z.unknown()).optional(),

    /**
     * Output result schema (for Bazaar documentation generation and AI agent understanding)
     */
    outputSchema: z.record(z.unknown()).optional(),

    /**
     * Other custom metadata
     */
  }).passthrough().optional(),
});

export type ProtectedEndpoint = z.infer<typeof ProtectedEndpointSchema>;

// =============================================================================
// Router Configuration Schema
// =============================================================================

/**
 * Router configuration
 *
 * Defines routing rules for a service, including passthrough paths and protected endpoints
 */
export const RouterConfigSchema = z.object({
  /**
   * Router name (unique identifier)
   */
  name: z
    .string()
    .min(1, { message: 'Router name cannot be empty' })
    .regex(/^[a-z0-9-_]+$/, {
      message: 'Router name must contain only lowercase letters, numbers, hyphens and underscores'
    }),

  /**
   * Router path prefix
   * Example: "/lego"
   */
  path: z
    .string()
    .min(1, { message: 'Router path cannot be empty' })
    .regex(/^\//, { message: 'Router path must start with /' }),

  /**
   * Upstream service address
   * Example: "http://localhost:3322"
   */
  proxy_pass: UrlSchema,

  /**
   * Passthrough paths (no payment verification required)
   * Supports wildcards, e.g.: ["/lego/docs/*", "/lego/health"]
   */
  passthrough: z
    .array(z.string().min(1))
    .optional()
    .default([]),

  /**
   * Protected endpoint configuration
   */
  x402_config: z
    .array(ProtectedEndpointSchema)
    .min(1, { message: 'Router must have at least one protected endpoint' }),
});

export type RouterConfig = z.infer<typeof RouterConfigSchema>;

// =============================================================================
// Complete Gateway Configuration Schema
// =============================================================================

/**
 * Complete gateway configuration
 *
 * Contains all payment profiles and router configurations
 */
export const GatewayConfigSchema = z
  .object({
    /**
     * Payment profile list
     */
    x402_payment: z
      .array(PaymentProfileSchema)
      .min(1, { message: 'At least one payment profile is required' }),

    /**
     * Router configuration list
     */
    x402_routers: z
      .array(RouterConfigSchema)
      .min(1, { message: 'At least one router is required' }),
  })
  .refine(
    (config) => {
      // Validate all payment profile names are unique
      const paymentNames = config.x402_payment.map((p) => p.name);
      return paymentNames.length === new Set(paymentNames).size;
    },
    { message: 'Payment profile names must be unique' }
  )
  .refine(
    (config) => {
      // Validate all router names are unique
      const routerNames = config.x402_routers.map((r) => r.name);
      return routerNames.length === new Set(routerNames).size;
    },
    { message: 'Router names must be unique' }
  )
  .refine(
    (config) => {
      // Validate all payment profiles referenced by endpoints exist
      const paymentNames = new Set(config.x402_payment.map((p) => p.name));

      for (const router of config.x402_routers) {
        for (const endpoint of router.x402_config) {
          if (!paymentNames.has(endpoint.payment)) {
            throw new Error(
              `Endpoint "${endpoint.name}" in router "${router.name}" ` +
              `references unknown payment profile "${endpoint.payment}"`
            );
          }
        }
      }

      return true;
    },
    { message: 'All endpoint payment references must exist in x402_payment' }
  )
  .refine(
    (config) => {
      // Validate endpoint names are unique within each router
      for (const router of config.x402_routers) {
        const endpointNames = router.x402_config.map((e) => e.name);
        if (endpointNames.length !== new Set(endpointNames).size) {
          throw new Error(`Endpoint names in router "${router.name}" must be unique`);
        }
      }
      return true;
    },
    { message: 'Endpoint names within each router must be unique' }
  );

export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;

// =============================================================================
// Price Conversion Utility Functions
// =============================================================================

/**
 * USDC decimal places - USDC uses 6 decimal places
 */
export const USDC_DECIMALS = 6;

/**
 * Converts token unit price to micro units (integer)
 *
 * Examples:
 * - "0.01" → 10000 (0.01 USDC = 10000 micro USDC)
 * - "1.5"  → 1500000 (1.5 USDC = 1500000 micro USDC)
 * - "100"  → 100000000 (100 USDC = 100000000 micro USDC)
 *
 * @param priceString - Price string in token units
 * @returns BigInt representing micro units
 */
export function convertPriceToMicroUnits(priceString: string): bigint {
  // Remove leading and trailing spaces
  const cleanPrice = priceString.trim();

  // Validate format
  if (!/^\d*\.?\d+$/.test(cleanPrice)) {
    throw new Error(`Invalid price format: "${priceString}"`);
  }

  // Convert to number and validate
  const price = parseFloat(cleanPrice);
  if (isNaN(price) || price <= 0) {
    throw new Error(`Price must be a positive number: "${priceString}"`);
  }

  // Convert to micro units (multiply by 10^6)
  const microUnits = BigInt(Math.floor(price * Math.pow(10, USDC_DECIMALS)));

  return microUnits;
}

/**
 * Converts micro units back to token unit string
 *
 * Examples:
 * - 10000 → "0.01"
 * - 1500000 → "1.5"
 * - 100000000 → "100"
 *
 * @param microUnits - BigInt representing micro units
 * @returns Price string in token units
 */
export function convertMicroUnitsToPrice(microUnits: bigint): string {
  const price = Number(microUnits) / Math.pow(10, USDC_DECIMALS);
  return price.toString();
}

// =============================================================================
// Export Types and Schemas
// =============================================================================

export {
  NetworkSchema,
  HttpMethodSchema,
  EthereumAddressSchema,
  SolanaAddressSchema,
  BlockchainAddressSchema,
  UrlSchema
};
