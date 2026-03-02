import {RpcProvider} from 'starknet';
import {CoinConfig, CoinInterface} from './interfaces/coin_interface';

export class Coin implements CoinInterface {
  name: string;
  config: CoinConfig;
  provider: RpcProvider;

  constructor(name: string, config: CoinConfig) {
    this.name = name;
    this.config = config;
    this.provider = new RpcProvider({nodeUrl: config.rpcUrl});
  }

  generateAddress(_index: number): string {
    throw new Error(`generateAddress not implemented for ${this.name}`);
  }

  async getBalance(_addressOrIndex: number | string): Promise<number> {
    throw new Error(`getBalance not implemented for ${this.name}`);
  }

  async sweep(
    _index: number,
    _recipientAddress: string,
    _amount?: number
  ): Promise<string> {
    throw new Error(`sweep not implemented for ${this.name}`);
  }

  async send(_recipientAddress: string, _amount: number): Promise<string> {
    throw new Error(`send not implemented for ${this.name}`);
  }
}
