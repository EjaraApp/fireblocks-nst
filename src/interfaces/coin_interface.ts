export interface CoinConfig {
  privateKey: string;
  classHash: string;
  rpcUrl: string;
  accountAddress: string;
}

export interface CoinInterface {
  generateAddress(index: number): string;
  getBalance(addressOrIndex: number | string): Promise<bigint>;
  sweep(
    index: number,
    recipientAddress: string,
    amount?: bigint
  ): Promise<string>;
  send(recipientAddress: string, amount: bigint): Promise<string>;
}
