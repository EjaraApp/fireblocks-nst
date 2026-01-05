import { CoinInterface } from './interfaces/coin_interface';

export class Coin implements CoinInterface {

  name: string;

  constructor(name: string) {
    this.name = name;
  }

  generateAddress(userId?: string | number): string {
    return ""
  }

  transferToken(recipientAddress: string, amount: number): boolean {
    return true;
  }
}
