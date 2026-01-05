import { Coin } from './coin';
import { STRK } from './coins/strk';

class CoinHandler {
  coins: Map<string, Coin>;

  constructor() {
    this.coins.set('STRK', new STRK());
  }

  getcoin(coinName: string): Coin {
    return this.coins.get(coinName)!!;
  }
}
