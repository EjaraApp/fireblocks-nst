import {Coin} from './coin';
import {STRK} from './coins/strk';
import {getCoinConfig} from './utils/hvault';

export class CoinHandler {
  coins: Map<string, Coin>;

  constructor() {
    this.coins = new Map<string, Coin>();
  }

  async init(): Promise<void> {
    const strkConfig = await getCoinConfig('STRK');
    this.coins.set('STRK', new STRK(strkConfig));
  }

  getCoin(coinName: string): Coin {
    const coin = this.coins.get(coinName);
    if (!coin) {
      throw new Error(`Coin ${coinName} not registered`);
    }
    return coin;
  }
}

export async function createCoinHandler(): Promise<CoinHandler> {
  const handler = new CoinHandler();
  await handler.init();
  return handler;
}
