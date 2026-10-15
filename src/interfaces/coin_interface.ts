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

/** Avnu REST paymaster credentials (Vault secret `fireblocks/AVNU`). */
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
