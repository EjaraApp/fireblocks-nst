export interface CoinInterface {
  generateAddress(userId?: string | number): string;
  transferToken(recipientAddress: string, amount: number): boolean;
}
