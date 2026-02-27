export interface CoinConfig {
  privateKey: string;
  classHash: string;
  rpcUrl: string;
  accountAddress: string;
}

export interface CoinInterface {
  generateAddress(index: number): string;
  deployAccount(index: number): Promise<string>;
  fundAccount(index: number, amount: bigint): Promise<string>;
  transferToken(
    fromIndex: number,
    recipientAddress: string,
    amount: bigint
  ): Promise<string>;
  getBalance(addressOrIndex: number | string): Promise<bigint>;
}
