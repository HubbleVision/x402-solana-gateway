// Type definitions for X402 Solana client

export interface SolanaConfig {
  gateway_url: string;
  endpoint_path: string;
  test_question: string;
  private_key: string;
  debug: boolean;
}

export interface PaymentRequirements {
  network: string;
  maxAmountRequired: string;
  payTo: string;
  asset: string;
  extra?: {
    feePayer?: string;
  };
}