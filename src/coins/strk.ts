import { Coin } from '../coin';


export class STRK implements Coin {
  name: string = "STRK";

  generateAddress(userId?: string | number): string {
    return ""
  }

  transferToken(recipientAddress: string, amount: number): boolean {
    return true;
  }
}
