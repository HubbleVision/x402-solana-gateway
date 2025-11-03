import { config } from 'dotenv';
import { SolanaConfig } from './types.js';

// Load environment variables
config();

export function getConfig(): SolanaConfig {
  const required = ['SOLANA_PRIVATE_KEY', 'GATEWAY_URL', 'ENDPOINT_PATH'];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    private_key: process.env.SOLANA_PRIVATE_KEY!,
    gateway_url: process.env.GATEWAY_URL!,
    endpoint_path: process.env.ENDPOINT_PATH!,
    test_question: process.env.TEST_QUESTION || 'Query the number of trading users and total trading volume of popular tokens in the past 24 hours (sol)',
    debug: process.env.DEBUG === 'true'
  };
}

export const GATEWAY_CONFIG = {
  port: 3101,
  networks: {
    'solana-devnet': {
      rpc: 'https://api.devnet.solana.com',
      ws: 'wss://api.devnet.solana.com',
      usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
    },
    'solana': {
      rpc: 'https://api.mainnet-beta.solana.com',
      ws: 'wss://api.mainnet-beta.solana.com',
      usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    }
  }
};