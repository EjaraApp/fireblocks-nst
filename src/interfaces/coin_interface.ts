export interface CoinConfig {
  privateKey: string;
  classHash: string;
  rpcUrl: string;
  accountAddress: string;
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
