/** Fee-payment strategy. `AVNU` = Avnu sponsored only; `WALLET` = self-funded;
 * `AVNU_FALLBACK_WALLET` = try Avnu, fall back to the wallet on failure. */
export type FeePayer = 'AVNU' | 'WALLET' | 'AVNU_FALLBACK_WALLET';

export interface CoinConfig {
  privateKey: string;
  classHash: string;
  rpcUrl: string;
  accountAddress: string;
  feePayer?: FeePayer;
}

/**
 * Avnu SNIP-29 paymaster credentials (Vault secret `fireblocks/AVNU`).
 * `apiUrl` is the paymaster base URL (e.g. https://starknet.paymaster.avnu.fi);
 * `apiKey` is the portal key, sent as the `x-paymaster-api-key` header.
 */
export interface AvnuConfig {
  apiUrl: string;
  apiKey: string;
}

export interface CoinInterface {
  generateAddress(index: number): string;
  getBalance(addressOrIndex: number | string): Promise<number>;
  sweep(
    index: number,
    recipientAddress: string,
    amount?: number
  ): Promise<string>;
  send(recipientAddress: string, amount: number): Promise<string>;
}
