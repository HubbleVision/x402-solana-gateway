#!/usr/bin/env bun

/**
 * Bun-optimized entry point for X402 Solana payment client
 *
 * This file is specifically designed for Bun runtime to avoid CJS/ESM compatibility issues
 * with the x402-fetch package.
 */

import { createSigner, wrapFetchWithPayment } from "x402-fetch";
import { getConfig } from "./config";
import { Logger } from "./logger";

async function main() {
  const logger = new Logger();

  try {
    // Load configuration
    logger.info("🔧 Loading configuration...");
    const config = getConfig();

    if (config.debug) {
      logger.info("🐛 Debug mode enabled");
      logger.debug("Configuration:", {
        gateway_url: config.gateway_url,
        endpoint_path: config.endpoint_path,
        test_question: config.test_question,
      });
    }

    // Create Solana signer using official X402 SDK
    logger.info("🔐 Creating Solana signer...");
    const signer = await createSigner("solana-devnet", config.private_key);

    // Wrap fetch to automatically handle X402 payments
    // Note: Bun has built-in fetch, no need to pass it explicitly
    const fetchWithPayment = wrapFetchWithPayment(fetch, signer);

    const url = `${config.gateway_url}${config.endpoint_path}`;
    const requestData = {
      question: config.test_question,
    };

    logger.info(`🌐 Target endpoint: ${url}`);
    logger.info("🔄 Initiating X402 payment request (using official SDK auto-handling)...");

    // Use official SDK wrapped fetch to automatically handle 402 and payment flow
    const response = await fetchWithPayment(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    logger.success(`✅ Request completed! Status code: ${response.status}`);

    if (response.ok) {
      const responseData = await response.json();
      logger.success("✅ Payment successful! Gateway returned data:");
      logger.info("📄 Response data:", responseData);
      console.log(
        "\n🎉 ✅ Test completed successfully! X402 Solana payment flow completed using official SDK (Bun runtime)!",
      );
      process.exit(0);
    } else {
      const errorData = await response.json();
      logger.error("❌ Request failed:", errorData);
      console.log("\n💔 ❌ Test failed:", errorData.error || "Unknown error");
      process.exit(1);
    }
  } catch (error: any) {
    logger.error("💥 Program execution failed:", error.message);

    if (error.message.includes("Missing required environment variable")) {
      logger.warning("💡 Please ensure the following environment variables are set:");
      logger.warning("   - GATEWAY_URL: Gateway address");
      logger.warning("   - ENDPOINT_PATH: API endpoint path");
      logger.warning("💡 You can copy configuration from .env.example");
    }

    if (config.debug) {
      logger.debug("Error stack:", error.stack);
    }

    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Promise rejection:", reason);
  process.exit(1);
});

// Run main function
main();
