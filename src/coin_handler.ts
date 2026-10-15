import {Coin} from './coin';
import {STRK} from './coins/strk';
import {getAvnuConfig, getCoinConfig} from './utils/hvault';
import {AvnuClient} from './utils/avnu';

/** Load the Avnu paymaster client, or return null (wallet-only) if the
 * `fireblocks/AVNU` Vault secret is unavailable. */
export async function loadAvnuClient(): Promise<AvnuClient | null> {
  try {
    return new AvnuClient(await getAvnuConfig());
  } catch (err) {
    console.warn(
      'Avnu paymaster not configured, falling back to wallet: ',
      err
    );
    return null;
  }
}

export class CoinHandler {
  coins: Map<string, Coin>;

  constructor() {
    this.coins = new Map<string, Coin>();
  }

  async init(): Promise<void> {
    const strkConfig = await getCoinConfig('STRK');
    const avnuClient = await loadAvnuClient();
    this.coins.set('STRK', new STRK(strkConfig, avnuClient));
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
