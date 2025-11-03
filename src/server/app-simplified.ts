/**
 * X402 Gateway Simplified Application (using x402-hono)
 *
 * This is a simplified implementation based on the official x402-hono library
 * Used to validate the feasibility of standard X402 Facilitator
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';
import { paymentMiddleware } from 'x402-hono';
import { createFacilitatorConfig } from '@coinbase/x402';
import * as dotenv from 'dotenv';
import { loadGatewayConfig } from '../config/gateway.js';
import type { GatewayConfig, PaymentProfile, ProtectedEndpoint, RouterConfig } from '../config/schema.js';

// =============================================================================
// Environment Variable Loading
// =============================================================================

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001; // Use different port to avoid conflicts
const NODE_ENV = process.env.NODE_ENV || 'development';
const DEBUG_REQUEST_RESPONSE = process.env.DEBUG_REQUEST_RESPONSE === 'true';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// =============================================================================
// Create Main Application
// =============================================================================

const app = new Hono();

// Global CORS configuration
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowHeaders: ['Content-Type', 'X-Payment', 'Authorization', 'X-Request-ID'],
    exposeHeaders: ['X-Payment-Response', 'X-Request-ID'],
  }),
);

// Static file service - Provide favicon and other static resources
app.get('/favicon.ico', serveStatic({ root: './public', path: 'favicon.png' }));
app.get('/favicon.png', serveStatic({ root: './public', path: 'favicon.png' }));
app.get('/logo.png', serveStatic({ root: './public', path: 'logo.png' }));
app.use('/public/*', serveStatic({ root: './' }));

// Root path health check
app.get('/', (c) => {
  return c.json({
    service: 'X402 Payment Gateway (Simplified)',
    version: '2.0.0',
    implementation: 'x402-hono',
    status: 'running',
    documentation: `http://localhost:${PORT}/health`,
  });
});

// Global health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'X402 Payment Gateway (Simplified)',
    version: '2.0.0',
    implementation: 'x402-hono',
    environment: NODE_ENV,
  });
});

// =============================================================================
// X402 Dedicated Endpoints
// =============================================================================

// X402 Health Check Endpoint (Compatibility)
app.get('/x402/health', (c) => {
  const isConfigValid = gatewayConfig !== null;

  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    x402: {
      enabled: isConfigValid,
      version: '2.0.0',
      implementation: 'x402-hono',
      facilitator: 'Standard X402 Facilitator',
      facilitatorUrl: 'https://x402.org/facilitator'
    },
    service: {
      name: 'X402 Payment Gateway (Simplified)',
      version: '2.0.0',
      environment: NODE_ENV,
      status: 'running'
    },
    configuration: {
      hasConfig: isConfigValid,
      paymentProfiles: gatewayConfig?.x402_payment?.length || 0,
      routers: gatewayConfig?.x402_routers?.length || 0
    }
  });
});

// X402 Service Catalog Endpoint
app.get('/x402/catalog', (c) => {
  try {
    // Build endpoints object
    const endpoints: Record<string, any> = {};

    // X402 own endpoints
    endpoints.health = {
      method: 'GET',
      path: '/x402/health',
      description: 'X402 health check endpoint',
      requiresPayment: false
    };

    endpoints.catalog = {
      method: 'GET',
      path: '/x402/catalog',
      description: 'X402 service catalog and documentation',
      requiresPayment: false
    };

    // Add routing endpoints from gateway configuration
    if (gatewayConfig) {
      for (const router of gatewayConfig.x402_routers) {
        // Passthrough endpoints (no payment required)
        for (const passthroughPath of router.passthrough || []) {
          // Handle wildcard paths
          if (passthroughPath.includes('*')) {
            const basePath = passthroughPath.replace('*', '');
            const pathName = `${router.name}-${basePath.replace(/[^a-zA-Z0-9]/g, '-')}`;
            endpoints[pathName] = {
              method: 'GET',
              path: `${router.path}${passthroughPath}`,
              description: `Passthrough endpoint for ${router.name}`,
              requiresPayment: false,
              router: router.name
            };
          } else {
            const pathName = `${router.name}-${passthroughPath.replace(/[^a-zA-Z0-9]/g, '-')}`;
            endpoints[pathName] = {
              method: 'GET',
              path: `${router.path}${passthroughPath}`,
              description: `Passthrough endpoint for ${router.name}`,
              requiresPayment: false,
              router: router.name
            };
          }
        }

        // Payment protected endpoints
        for (const endpoint of router.x402_config) {
          const paymentProfile = gatewayConfig.x402_payment.find(p => p.name === endpoint.payment);
          const pathName = `${router.name}-${endpoint.name}`;

          endpoints[pathName] = {
            method: endpoint.method,
            path: `${router.path}${endpoint.path}`,
            description: endpoint.metadata?.description || `Protected endpoint for ${router.name}`,
            requiresPayment: true,
            router: router.name,
            payment: {
              profile: endpoint.payment,
              network: paymentProfile?.chain || 'unknown',
              asset: paymentProfile?.token_name || 'USDC',
              price: `$${endpoint.price}`,
              address: paymentProfile?.address,
              facilitator: paymentProfile?.facilitator_url ? 'Standard X402' : 'CDP Platform'
            },
            timeout: `${endpoint.timeout_ms}ms`
          };
        }
      }

      // Build price list
      const pricing: Record<string, string> = {};
      for (const router of gatewayConfig.x402_routers) {
        for (const endpoint of router.x402_config) {
          pricing[endpoint.name] = `$${endpoint.price}`;
        }
      }

      // Build payment configuration
      const paymentProfiles = gatewayConfig.x402_payment.map(profile => ({
        name: profile.name,
        network: profile.chain,
        asset: profile.token_name,
        address: profile.address,
        facilitator: profile.facilitator_url ? 'Standard X402' : 'CDP Platform',
        facilitatorUrl: profile.facilitator_url || 'Not configured'
      }));

      return c.json({
        name: 'Hubble X402 Gateway API (Simplified)',
        version: '2.0.0',
        description: 'Pay-per-use API gateway powered by X402 payment protocol - Simplified Implementation',
        protocol: 'X402',
        implementation: 'x402-hono',

        endpoints,

        pricing,

        payment: {
          protocol: 'X402',
          profiles: paymentProfiles,
          facilitator: 'Standard X402 Facilitator',
          facilitatorUrl: 'https://x402.org/facilitator'
        },

        routers: gatewayConfig.x402_routers.map(router => ({
          name: router.name,
          path: router.path,
          upstream: router.proxy_pass,
          protectedEndpoints: router.x402_config.length,
          passthroughPaths: router.passthrough?.length || 0
        })),

        example: {
          // Use the first protected endpoint as an example
          request: {
            method: 'POST',
            url: `${gatewayConfig.x402_routers[0]?.path || '/lego'}${gatewayConfig.x402_routers[0]?.x402_config[0]?.path || '/api/v1/query'}`,
            headers: {
              'Content-Type': 'application/json',
              'X-Payment': '<base64-encoded-payment-proof>'
            },
            body: {
              question: 'What is the total transaction count on Base?',
              source: 'database',
              threshold: 0.7
            }
          },
          response: {
            success: true,
            message: 'Request processed by query endpoint',
            data: {
              query: 'What is the total transaction count on Base?',
              timestamp: new Date().toISOString(),
              router: gatewayConfig.x402_routers[0]?.name || 'lego',
              endpoint: gatewayConfig.x402_routers[0]?.x402_config[0]?.name || 'query',
              payment: {
                profile: gatewayConfig.x402_routers[0]?.x402_config[0]?.payment || 'base-sepolia',
                price: gatewayConfig.x402_routers[0]?.x402_config[0]?.price || '0.01',
                verified: true
              }
            }
          }
        },

        documentation: {
          x402Protocol: 'https://x402.org/docs',
          github: 'https://github.com/coinbase/x402',
          simplifiedImplementation: './docs/20251012_1307_use_x402_hono.md'
        }
      });
    }

    // Return basic information (when configuration loading fails)
    return c.json({
      name: 'Hubble X402 Gateway API (Simplified)',
      version: '2.0.0',
      description: 'Pay-per-use API gateway powered by X402 payment protocol - Simplified Implementation',
      protocol: 'X402',
      implementation: 'x402-hono',

      endpoints: {
        health: {
          method: 'GET',
          path: '/x402/health',
          description: 'X402 health check endpoint',
          requiresPayment: false
        },
        catalog: {
          method: 'GET',
          path: '/x402/catalog',
          description: 'X402 service catalog and documentation',
          requiresPayment: false
        }
      },

      error: 'Failed to load gateway configuration',
      message: 'Gateway configuration is not available'
    }, 500);

  } catch (error) {
    console.error('Failed to load gateway config for catalog:', error);

    return c.json({
      name: 'Hubble X402 Gateway API (Simplified)',
      version: '2.0.0',
      description: 'Pay-per-use API gateway powered by X402 payment protocol - Simplified Implementation',
      protocol: 'X402',
      implementation: 'x402-hono',

      endpoints: {
        health: {
          method: 'GET',
          path: '/x402/health',
          description: 'X402 health check endpoint',
          requiresPayment: false
        },
        catalog: {
          method: 'GET',
          path: '/x402/catalog',
          description: 'X402 service catalog and documentation',
          requiresPayment: false
        }
      },

      error: 'Failed to load gateway configuration',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// =============================================================================
// X402 Middleware Factory Functions
// =============================================================================

/**
 * Create X402 middleware factory function
 *
 * @param paymentProfile Payment profile configuration (read from gateway.yaml)
 * @param endpoint Endpoint configuration (read from gateway.yaml)
 * @returns x402-hono paymentMiddleware
 */
function createX402Middleware(paymentProfile: PaymentProfile, endpoint: ProtectedEndpoint, fullPath: string) {
  console.log(`🔧 Creating X402 middleware for endpoint: ${endpoint.name}`);
  console.log(`   Payment Profile: ${paymentProfile.name}`);
  console.log(`   Chain: ${paymentProfile.chain}`);
  console.log(`   Price: ${endpoint.price} ${paymentProfile.token_name}`);
  console.log(`   Facilitator URL: ${paymentProfile.facilitator_url || 'Using CDP Platform'}`);
  console.log(`   Discoverable: ${endpoint.metadata?.discoverable ?? false}`);

  // Correct configuration format for x402-hono
  let facilitatorConfig;

  if (paymentProfile.facilitator_url) {
    // Determine whether to use standard X402 Facilitator or CDP Facilitator
    if (paymentProfile.facilitator_url.includes('api.cdp.coinbase.com')) {
      // Use CDP Facilitator - requires API Keys
      console.log(`   🔑 Using CDP Facilitator with API authentication`);
      const apiKeyId = process.env.CDP_API_KEY_ID;
      const apiKeySecret = process.env.CDP_API_KEY_SECRET;

      if (!apiKeyId || !apiKeySecret) {
        console.error(`   ❌ ERROR: CDP API Keys not found in environment variables!`);
        console.error(`   Required: CDP_API_KEY_ID and CDP_API_KEY_SECRET`);
        throw new Error('CDP API Keys are required for Base mainnet but not configured');
      }

      // Create facilitator configuration using @coinbase/x402 (including authentication)
      facilitatorConfig = createFacilitatorConfig(apiKeyId, apiKeySecret);
      console.log(`   ✅ CDP Facilitator config created with authentication`);
    } else {
      // Use standard X402 Facilitator (e.g., https://x402.org/facilitator)
      console.log(`   🌐 Using standard X402 Facilitator (no auth required)`);
      facilitatorConfig = {
        url: paymentProfile.facilitator_url as `${string}://${string}`,
      };
    }
  } else {
    // No facilitator_url configured, use default
    console.log(`   ⚠️  No facilitator_url configured, using default`);
    facilitatorConfig = undefined;
  }

  // Test price format expected by x402-hono
  // First try using dollar format directly (consistent with configuration file)
  const price = `$${endpoint.price}`;

  // Build configuration object
  const routeConfig: any = {
    price: price, // Price format: $0.01 (test dollar format)
    network: paymentProfile.chain as any, // Network type
    config: {
      description: endpoint.metadata?.description || `Access to ${endpoint.name} endpoint`,
      maxTimeoutSeconds: Math.floor((endpoint.timeout_ms || 300000) / 1000),
    }
  };

  // If discoverable is configured, add to config
  if (endpoint.metadata?.discoverable === true) {
    routeConfig.config.discoverable = true;
    console.log(`   📢 Endpoint will be registered to X402 Bazaar`);

    // Set resource URL to public address
    const publicBaseUrl = process.env.PUBLIC_BASE_URL;
    if (publicBaseUrl) {
      // Remove leading slash from fullPath to avoid double slashes
      const cleanPath = fullPath.startsWith('/') ? fullPath : `/${fullPath}`;
      routeConfig.config.resource = `${publicBaseUrl}${cleanPath}`;
      console.log(`   🌐 Resource URL: ${routeConfig.config.resource}`);
    } else {
      console.warn(`   ⚠️  PUBLIC_BASE_URL not configured, using default resource path`);
    }

    // Add inputSchema and outputSchema (if configured)
    if (endpoint.metadata?.inputSchema) {
      routeConfig.config.inputSchema = endpoint.metadata.inputSchema;
      console.log(`   📝 Input schema configured`);
    }

    if (endpoint.metadata?.outputSchema) {
      routeConfig.config.outputSchema = endpoint.metadata.outputSchema;
      console.log(`   📝 Output schema configured`);
    }
  }

  return paymentMiddleware(
    paymentProfile.address as `0x${string}`, // First parameter: receiving address (forced to correct type)
    { // Second parameter: routing configuration
      [fullPath]: routeConfig
    },
    facilitatorConfig // Third parameter: facilitator configuration (optional)
  );
}

// =============================================================================
// Logging Helper Functions
// =============================================================================

/**
 * Format and output request header information
 */
function logRequestHeaders(headers: Record<string, string>, endpointName: string) {
  console.log(`\n🔍 [${endpointName}] Request Headers:`);
  Object.entries(headers).forEach(([key, value]) => {
    console.log(`   ${key}: ${value}`);
  });
}

/**
 * Format and output response header information
 */
function logResponseHeaders(headers: Record<string, string>, endpointName: string) {
  console.log(`\n📤 [${endpointName}] Response Headers:`);
  Object.entries(headers).forEach(([key, value]) => {
    console.log(`   ${key}: ${value}`);
  });
}

/**
 * Format and output request body information
 */
function logRequestBody(body: string, endpointName: string) {
  console.log(`\n📥 [${endpointName}] Request Body:`);
  try {
    const parsedBody = JSON.parse(body);
    console.log(`   ${JSON.stringify(parsedBody, null, 2)}`);
  } catch {
    console.log(`   ${body}`);
  }
}

/**
 * Format and output response body information
 */
function logResponseBody(body: string, endpointName: string) {
  console.log(`\n📤 [${endpointName}] Response Body:`);
  try {
    const parsedBody = JSON.parse(body);
    console.log(`   ${JSON.stringify(parsedBody, null, 2)}`);
  } catch {
    console.log(`   ${body}`);
  }
}

// =============================================================================
// Response Handling Common Functions
// =============================================================================

/**
 * Set response headers (excluding content-length, let Hono handle it automatically)
 */
function setResponseHeaders(c: any, responseHeaders: Record<string, string>) {
  for (const [key, value] of Object.entries(responseHeaders)) {
    c.header(key, value);
  }
}

/**
 * Common logic for handling JSON responses
 */
function handleJsonResponse(
  c: any,
  responseText: string,
  responseHeaders: Record<string, string>,
  status: number,
  modifyJson?: (json: any) => void
) {
  try {
    const jsonResponse = JSON.parse(responseText);

    // If a modification function is provided, call it
    if (modifyJson && typeof jsonResponse === 'object' && jsonResponse !== null) {
      modifyJson(jsonResponse);
    }

    // Set response headers (excluding content-length, let Hono handle it automatically)
    setResponseHeaders(c, responseHeaders);
    return c.json(jsonResponse, status);
  } catch (error) {
    console.error('❌ JSON parsing error:', error);
    console.error('❌ Response text:', responseText.substring(0, 500));
    // If JSON parsing fails, return raw text directly
    setResponseHeaders(c, responseHeaders);
    return c.text(responseText, status);
  }
}

/**
 * Common logic for handling non-JSON responses
 */
function handleTextResponse(
  c: any,
  responseText: string,
  responseHeaders: Record<string, string>,
  status: number
) {
  // Set response headers (non-JSON response)
  setResponseHeaders(c, responseHeaders);
  return c.text(responseText, status);
}

// =============================================================================
// Request Handling Functions
// =============================================================================

/**
 * Handle protected requests
 */
async function handleProtectedRequest(c: any, router: RouterConfig, endpoint: ProtectedEndpoint) {
  try {
    console.log(`🔄 Processing protected request: ${endpoint.name}`);

    // Payment verification completed, directly process business logic
    let body = null;
    let bodyText = '';
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      bodyText = await c.req.text();
      body = bodyText;
    }

    // Detailed logging
    if (DEBUG_REQUEST_RESPONSE) {
      // Log request headers
      const requestHeaders = c.req.header();
      logRequestHeaders(requestHeaders, endpoint.name);

      // Log request body
      if (bodyText) {
        logRequestBody(bodyText, endpoint.name);
      }
    } else {
      console.log(`   Request body: ${bodyText ? bodyText.substring(0, 100) + (bodyText.length > 100 ? '...' : '') : '(empty)'}`);
    }

    // Forward to upstream service
    const upstreamUrl = router.proxy_pass;
    const targetUrl = `${upstreamUrl}${router.path}${endpoint.path}`;

    console.log(`   Forwarding to: ${targetUrl}`);
    console.log(`   Method: ${c.req.method}`);

    // Get request headers and filter out some unnecessary ones
    const headers = new Headers();
    for (const [key, value] of Object.entries(c.req.header())) {
      if (!['host', 'connection', 'content-length'].includes(key.toLowerCase()) && value) {
        headers.set(key, value as string);
      }
    }

    // Forward request to upstream service
    console.log(`   Forwarding request...`);
    const response = await fetch(targetUrl, {
      method: c.req.method,
      headers: headers,
      body: body,
    });

    console.log(`   Upstream response status: ${response.status}`);

    // Get response headers (excluding content-length to avoid conflicts)
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      if (!['connection', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    // Return upstream service response
    const responseText = await response.text();
    console.log(`   Response received, length: ${responseText.length}`);

    // Detailed response logging
    if (DEBUG_REQUEST_RESPONSE) {
      // Log response headers
      logResponseHeaders(responseHeaders, endpoint.name);

      // Log response body
      logResponseBody(responseText, endpoint.name);
    }

    // Return response based on content type
    if (responseHeaders['content-type']?.includes('application/json')) {
      return handleJsonResponse(c, responseText, responseHeaders, response.status, (jsonResponse) => {
        // Add payment information
        jsonResponse.gateway = {
          router: router.name,
          endpoint: endpoint.name,
          payment: {
            profile: endpoint.payment,
            price: endpoint.price,
            verified: true,
          },
          timestamp: new Date().toISOString(),
        };
      });
    } else {
      return handleTextResponse(c, responseText, responseHeaders, response.status);
    }

  } catch (error: any) {
    console.error('❌ Request handling error:', error);
    return c.json(
      {
        error: 'Internal server error',
        message: error.message,
        endpoint: endpoint.name,
      },
      500
    );
  }
}

/**
 * Proxy request to upstream service
 */
async function proxyRequest(c: any, router: RouterConfig) {
  try {
    console.log(`🔄 Proxying request to upstream: ${router.proxy_pass}`);

    const url = new URL(c.req.url);
    const targetUrl = `${router.proxy_pass}${url.pathname}${url.search}`;

    console.log(`   Target URL: ${targetUrl}`);
    console.log(`   Method: ${c.req.method}`);

    // Get request body
    let body = null;
    let bodyText = '';
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      bodyText = await c.req.text();
      body = bodyText;
    }

    // Detailed logging
    if (DEBUG_REQUEST_RESPONSE) {
      // Log request headers
      const requestHeaders = c.req.header();
      logRequestHeaders(requestHeaders, `proxy-${router.name}`);

      // Log request body
      if (bodyText) {
        logRequestBody(bodyText, `proxy-${router.name}`);
      }
    } else {
      console.log(`   Request body: ${bodyText ? bodyText.substring(0, 100) + (bodyText.length > 100 ? '...' : '') : '(empty)'}`);
    }

    // Get request headers and filter out some unnecessary ones
    const headers = new Headers();
    for (const [key, value] of Object.entries(c.req.header())) {
      if (!['host', 'connection', 'content-length'].includes(key.toLowerCase()) && value) {
        headers.set(key, value as string);
      }
    }

    // Forward request to upstream service
    console.log(`   Forwarding request...`);
    const response = await fetch(targetUrl, {
      method: c.req.method,
      headers: headers,
      body: body,
    });

    console.log(`   Upstream response status: ${response.status}`);

    // Get response headers (excluding content-length to avoid conflicts)
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      if (!['connection', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    // Return upstream service response
    const responseText = await response.text();
    console.log(`   Response received, length: ${responseText.length}`);

    // Detailed response logging
    if (DEBUG_REQUEST_RESPONSE) {
      // Log response headers
      logResponseHeaders(responseHeaders, `proxy-${router.name}`);

      // Log response body
      logResponseBody(responseText, `proxy-${router.name}`);
    }

    // Return response based on content type
    if (responseHeaders['content-type']?.includes('application/json')) {
      return handleJsonResponse(c, responseText, responseHeaders, response.status);
    } else {
      return handleTextResponse(c, responseText, responseHeaders, response.status);
    }

  } catch (error: any) {
    console.error('❌ Proxy error:', error);
    return c.json(
      {
        error: 'Proxy error',
        message: error.message,
        router: router.name,
      },
      502
    );
  }
}

// =============================================================================
// Dynamic Route Registration
// =============================================================================

/**
 * Register gateway routes
 */
function registerGatewayRoutes(config: GatewayConfig) {
  console.log('\n📋 Registering simplified gateway routes...');
  console.log(`   Config type: ${typeof config}`);
  console.log(`   Config keys: ${Object.keys(config)}`);
  console.log(`   Payment profiles: ${config.x402_payment?.length || 0}`);
  console.log(`   Routers: ${config.x402_routers?.length || 0}\n`);

  if (!config || !config.x402_routers) {
    console.error('❌ Invalid config provided to registerGatewayRoutes');
    return;
  }

  // Iterate through all route configurations
  for (const router of config.x402_routers) {
    registerRouter(router, config);
  }

  console.log('✅ All routes registered\n');
}

/**
 * Register a single router
 */
function registerRouter(router: RouterConfig, config: GatewayConfig) {
  console.log(`📍 Registering simplified router: ${router.name}`);
  console.log(`   Path: ${router.path}`);
  console.log(`   Upstream: ${router.proxy_pass}`);

  // 1. Register passthrough paths (no payment required)
  if (router.passthrough && router.passthrough.length > 0) {
    console.log(`   Passthrough patterns: ${router.passthrough.length}`);

    for (const pattern of router.passthrough) {
      if (pattern.includes('*')) {
        // Handle wildcard paths - Hono supports wildcard paths
        const wildcardPath = `${router.path}${pattern}`;

        app.all(wildcardPath, async (c) => {
          console.log(`   🔓 Passthrough: ${c.req.method} ${c.req.path}`);
          return await proxyRequest(c, router);
        });

        console.log(`   🔓 Registered: ${wildcardPath} (wildcard)`);
      } else {
        // Handle exact paths
        const fullPath = `${router.path}${pattern}`;
        app.get(fullPath, async (c) => {
          console.log(`   🔓 Passthrough: ${c.req.method} ${c.req.path}`);
          return await proxyRequest(c, router);
        });

        console.log(`   🔓 Registered: ${fullPath} (exact)`);
      }
    }
  }

  // 2. Register X402 protected endpoints
  console.log(`   Protected endpoints: ${router.x402_config.length}`);

  for (const endpoint of router.x402_config) {
    // Get payment profile
    const paymentProfile = config.x402_payment.find(p => p.name === endpoint.payment);
    if (!paymentProfile) {
      console.error(`   ❌ Error: Payment profile "${endpoint.payment}" not found for endpoint "${endpoint.name}"`);
      continue;
    }

    console.log(`   🔒 ${endpoint.method} ${endpoint.path} → ${endpoint.name}`);
    console.log(`      Payment: ${endpoint.payment} | Price: ${endpoint.price}`);

    // Register route (payment verification → business logic processing)
    const fullPath = `${router.path}${endpoint.path}`;

    // Create X402 middleware
    const x402Middleware = createX402Middleware(paymentProfile, endpoint, fullPath);

    if (endpoint.method === 'POST') {
      app.post(fullPath, x402Middleware, async (c) => {
        return await handleProtectedRequest(c, router, endpoint);
      });
    } else if (endpoint.method === 'GET') {
      app.get(fullPath, x402Middleware, async (c) => {
        return await handleProtectedRequest(c, router, endpoint);
      });
    } else {
      app.on(endpoint.method, fullPath, x402Middleware, async (c) => {
        return await handleProtectedRequest(c, router, endpoint);
      });
    }

    console.log(`   ✅ Registered: ${endpoint.method} ${fullPath}`);
  }

  console.log(`   ✅ Router "${router.name}" registered\n`);
}

// =============================================================================
// Load Configuration and Register Routes
// =============================================================================

let gatewayConfig: GatewayConfig | null = null;

try {
  console.log('🔧 Loading simplified gateway configuration...');
  console.log('🔧 Config path:', process.cwd() + '/config/gateway.yaml');
  gatewayConfig = await loadGatewayConfig();
  console.log('✅ Configuration loaded successfully');
  console.log('✅ Config object:', JSON.stringify(gatewayConfig, null, 2));
  console.log();

  // Register all gateway routes
  registerGatewayRoutes(gatewayConfig);
} catch (error: any) {
  console.error('❌ Failed to load gateway configuration:', error.message);
  console.error('❌ Error details:', error);
  console.error('⚠️  Gateway will start but no routes will be available');
  console.error('💡 Please check your config/gateway.yaml file\n');
}

// =============================================================================
// Global Error Handling
// =============================================================================

// 404 Handler
app.notFound((c) => {
  const availableRouters = gatewayConfig?.x402_routers.map((r) => ({
    name: r.name,
    path: r.path,
    endpoints: r.x402_config.map((ep) => ({
      method: ep.method,
      path: `${r.path}${ep.path}`,
      name: ep.name,
    })),
  }));

  return c.json(
    {
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
      availableRouters: availableRouters || [],
      hint: 'Check GET /health for service status',
      implementation: 'x402-hono',
    },
    404,
  );
});

// Global error handler
app.onError((err, c) => {
  console.error('❌ Server Error:', err);

  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred',
      hint: 'Please contact support if this persists',
      implementation: 'x402-hono',
    },
    500,
  );
});

// =============================================================================
// Start Server
// =============================================================================

console.log('🚀 Starting Simplified X402 Payment Gateway...');
console.log(`📍 Port: ${PORT}`);
console.log(`🌍 Environment: ${NODE_ENV}`);
console.log(`📦 Implementation: x402-hono`);
console.log(`📝 Debug Mode: ${DEBUG_REQUEST_RESPONSE ? 'ENABLED (detailed request/response logs)' : 'DISABLED (basic logs only)'}`);
console.log(`📊 Log Level: ${LOG_LEVEL}`);

if (gatewayConfig) {
  console.log(`💰 Payment profiles: ${gatewayConfig.x402_payment.length}`);
  console.log(`🔀 Routers: ${gatewayConfig.x402_routers.length}`);

  for (const profile of gatewayConfig.x402_payment) {
    const facilitatorType = profile.facilitator_url ? 'Standard X402' : 'CDP Platform';
    console.log(`   💳 ${profile.name}: ${profile.chain} | ${profile.token_name} | ${facilitatorType}`);
  }

  for (const router of gatewayConfig.x402_routers) {
    console.log(`   📍 ${router.name}: ${router.path} → ${router.proxy_pass}`);
  }
}

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: '0.0.0.0', // Listen on all network interfaces, allow external access from Docker containers
});

console.log(`\n✅ Simplified Gateway running on http://localhost:${PORT}`);
console.log(`🏥 Health check: http://localhost:${PORT}/health`);
console.log(`📚 Implementation: x402-hono + Standard X402 Facilitator`);

// Print all registered routes
printAllRoutes();

console.log('\n🚀 Ready to accept requests!\n');

/**
 * Print all registered routes
 */
function printAllRoutes() {
  console.log('\n📋 All Registered Routes:');
  console.log('═'.repeat(60));

  // Global routes
  console.log('\n🌐 Global Routes:');
  console.log('   GET  / - Root health check');
  console.log('   GET  /health - Global health check');

  // X402 routes
  console.log('\n💰 X402 Routes:');
  console.log('   GET  /x402/health - X402 health check and config');
  console.log('   GET  /x402/catalog - Service catalog and docs');

  // Dynamic gateway routes
  if (gatewayConfig && gatewayConfig.x402_routers.length > 0) {
    console.log('\n🔀 Dynamic Gateway Routes:');

    for (const router of gatewayConfig.x402_routers) {
      console.log(`\n   📍 Router: ${router.name} (${router.path})`);
      console.log(`      ↳ Upstream: ${router.proxy_pass}`);

      // Passthrough routes
      if (router.passthrough && router.passthrough.length > 0) {
        console.log('      🔓 Passthrough:');
        for (const pattern of router.passthrough) {
          console.log(`         ALL  ${router.path}${pattern}`);
        }
      }

      // Protected endpoints
      if (router.x402_config.length > 0) {
        console.log('      🔒 Protected:');
        for (const endpoint of router.x402_config) {
          console.log(`         ${endpoint.method.toUpperCase().padEnd(5)} ${router.path}${endpoint.path} (${endpoint.name})`);
          console.log(`               💳 ${endpoint.payment} - $${endpoint.price}`);
        }
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📚 Documentation:');
  console.log('   📖 GET /x402/catalog - Complete API documentation');
  console.log('   🏥 GET /health - Service health status');
  console.log('   🏥 GET /x402/health - X402 configuration status');
  console.log('═'.repeat(60));
}

export default app;