/**
 * Gateway Configuration Loading Module
 *
 * Responsible for loading, parsing, and validating gateway.yaml configuration files
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { GatewayConfigSchema, type GatewayConfig } from './schema.js';

// =============================================================================
// Configuration Cache
// =============================================================================

/**
 * Configuration cache
 * Avoids repeated file reading and parsing
 */
let cachedConfig: GatewayConfig | null = null;

/**
 * Clear configuration cache
 * Used for testing or hot reload scenarios
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

// =============================================================================
// Configuration Loading
// =============================================================================

/**
 * Configuration loading error
 */
export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

/**
 * Get configuration file path
 *
 * Priority:
 * 1. Environment variable GATEWAY_CONFIG_PATH
 * 2. Default path ./config/gateway.yaml
 */
export function getConfigPath(): string {
  const envPath = process.env.GATEWAY_CONFIG_PATH;

  if (envPath) {
    // If it's a relative path, resolve relative to the current working directory
    return resolve(process.cwd(), envPath);
  }

  // Default path
  return resolve(process.cwd(), 'config', 'gateway.yaml');
}

/**
 * Load and parse YAML file
 *
 * @param filePath - Configuration file path
 * @returns Parsed object
 * @throws {ConfigLoadError} File reading or parsing failure
 */
async function loadYamlFile(filePath: string): Promise<unknown> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return parseYaml(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ConfigLoadError(
        `Config file not found: ${filePath}`,
        error
      );
    }

    throw new ConfigLoadError(
      `Failed to read config file: ${filePath}`,
      error
    );
  }
}

/**
 * Apply environment variable overrides
 *
 * Allows overriding sensitive information in configuration through environment variables
 * For example: FACILITATOR_URL, CDP_API_KEY_ID, CDP_API_KEY_SECRET
 *
 * @param config - Original configuration
 * @returns Configuration after applying overrides
 */
function applyEnvironmentOverrides(config: GatewayConfig): GatewayConfig {
  const overriddenConfig = { ...config };

  // Override Facilitator URL in payment profiles (if specified by environment variable)
  if (process.env.FACILITATOR_URL) {
    overriddenConfig.x402_payment = config.x402_payment.map((profile) => ({
      ...profile,
      facilitator_url: process.env.FACILITATOR_URL || profile.facilitator_url,
    }));
  }

  // Compatibility with legacy CDP URL environment variable overrides
  if (process.env.X402_VERIFY_URL || process.env.X402_SETTLE_URL) {
    overriddenConfig.x402_payment = config.x402_payment.map((profile) => ({
      ...profile,
      verify_url: process.env.X402_VERIFY_URL || profile.verify_url,
      settle_url: process.env.X402_SETTLE_URL || profile.settle_url,
    }));
  }

  // Override upstream addresses in routes (if specified by environment variable)
  if (process.env.LEGO_API_URL) {
    overriddenConfig.x402_routers = config.x402_routers.map((router) => ({
      ...router,
      proxy_pass: process.env.LEGO_API_URL || router.proxy_pass,
    }));
  }

  return overriddenConfig;
}

/**
 * Load gateway configuration
 *
 * Loads configuration from YAML file, performs validation and environment variable overrides
 *
 * @param options - Loading options
 * @param options.useCache - Whether to use cache (default true)
 * @param options.configPath - Configuration file path (optional, defaults to environment variable or default path)
 * @returns Validated configuration object
 * @throws {ConfigLoadError} File not found, format error, or validation failure
 *
 * @example
 * ```typescript
 * const config = await loadGatewayConfig();
 * console.log(config.x402_payment); // Payment profile list
 * console.log(config.x402_routers); // Router configuration list
 * ```
 */
export async function loadGatewayConfig(
  options: {
    useCache?: boolean;
    configPath?: string;
  } = {}
): Promise<GatewayConfig> {
  const { useCache = true, configPath } = options;

  // If cache exists and caching is enabled, return directly
  if (useCache && cachedConfig) {
    return cachedConfig;
  }

  // Get configuration file path
  const filePath = configPath || getConfigPath();

  // Load YAML file
  const rawConfig = await loadYamlFile(filePath);

  // Validate configuration
  let validatedConfig: GatewayConfig;
  try {
    validatedConfig = GatewayConfigSchema.parse(rawConfig);
  } catch (error) {
    throw new ConfigLoadError(
      `Config validation failed: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }

  // Apply environment variable overrides
  const finalConfig = applyEnvironmentOverrides(validatedConfig);

  // Cache configuration
  if (useCache) {
    cachedConfig = finalConfig;
  }

  return finalConfig;
}

// =============================================================================
// Configuration Access Helper Functions
// =============================================================================

/**
 * Get payment profile
 *
 * @param config - Gateway configuration
 * @param name - Payment profile name
 * @returns Payment profile object, returns undefined if not found
 */
export function getPaymentProfile(
  config: GatewayConfig,
  name: string
) {
  return config.x402_payment.find((profile) => profile.name === name);
}

/**
 * Get router configuration
 *
 * @param config - Gateway configuration
 * @param name - Router name
 * @returns Router configuration object, returns undefined if not found
 */
export function getRouter(
  config: GatewayConfig,
  name: string
) {
  return config.x402_routers.find((router) => router.name === name);
}

/**
 * Get protected endpoint
 *
 * @param router - Router configuration
 * @param name - Endpoint name
 * @returns Endpoint configuration object, returns undefined if not found
 */
export function getEndpoint(
  router: GatewayConfig['x402_routers'][0],
  name: string
) {
  return router.x402_config.find((endpoint) => endpoint.name === name);
}

// =============================================================================
// Configuration Validation Helper Functions
// =============================================================================

/**
 * Validate configuration integrity
 *
 * Performs additional runtime checks, such as network address matching, etc.
 *
 * @param config - Gateway configuration
 * @returns Validation results and warning messages
 */
export function validateConfig(config: GatewayConfig): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check facilitator configuration in payment profiles
  for (const profile of config.x402_payment) {
    if (profile.facilitator_url) {
      // Using standard X402 Facilitator
      if (!profile.facilitator_url.includes('x402.org')) {
        warnings.push(
          `Payment profile "${profile.name}": facilitator_url does not point to standard X402 Facilitator`
        );
      }
    } else if (profile.verify_url && profile.settle_url) {
      // Using CDP Platform (compatibility)
      if (!profile.verify_url.includes('cdp.coinbase.com')) {
        warnings.push(
          `Payment profile "${profile.name}": verify_url does not point to Coinbase CDP`
        );
      }
      if (!profile.settle_url.includes('cdp.coinbase.com')) {
        warnings.push(
          `Payment profile "${profile.name}": settle_url does not point to Coinbase CDP`
        );
      }
      warnings.push(
        `Payment profile "${profile.name}": Using legacy CDP Platform configuration. Consider migrating to standard X402 Facilitator.`
      );
    } else {
      errors.push(
        `Payment profile "${profile.name}": Neither facilitator_url nor (verify_url + settle_url) are configured`
      );
    }
  }

  // Check if router paths overlap
  const routerPaths = config.x402_routers.map((r) => r.path);
  for (let i = 0; i < routerPaths.length; i++) {
    for (let j = i + 1; j < routerPaths.length; j++) {
      if (routerPaths[i].startsWith(routerPaths[j]) || routerPaths[j].startsWith(routerPaths[i])) {
        warnings.push(
          `Router paths "${routerPaths[i]}" and "${routerPaths[j]}" may overlap`
        );
      }
    }
  }

  // Check endpoint path conflicts
  for (const router of config.x402_routers) {
    const endpointPaths = new Set<string>();
    for (const endpoint of router.x402_config) {
      const fullPath = `${endpoint.method} ${endpoint.path}`;
      if (endpointPaths.has(fullPath)) {
        errors.push(
          `Router "${router.name}": duplicate endpoint "${fullPath}"`
        );
      }
      endpointPaths.add(fullPath);
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Print configuration summary
 *
 * Used for debugging and logging output
 *
 * @param config - Gateway configuration
 */
export function printConfigSummary(config: GatewayConfig): void {
  console.log('📋 Gateway Configuration Summary:');
  console.log(`   Payment Profiles: ${config.x402_payment.length}`);

  for (const profile of config.x402_payment) {
    console.log(`     - ${profile.name} (${profile.chain})`);
  }

  console.log(`   Routers: ${config.x402_routers.length}`);

  for (const router of config.x402_routers) {
    console.log(`     - ${router.name} → ${router.path}`);
    console.log(`       Passthrough: ${router.passthrough?.length || 0} rules`);
    console.log(`       Protected: ${router.x402_config.length} endpoints`);
  }

  const validation = validateConfig(config);
  if (validation.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    for (const warning of validation.warnings) {
      console.log(`     - ${warning}`);
    }
  }

  if (validation.errors.length > 0) {
    console.log('❌ Errors:');
    for (const error of validation.errors) {
      console.log(`     - ${error}`);
    }
  }
}
