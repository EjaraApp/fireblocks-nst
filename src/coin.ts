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

  async deployAccount(_index: number): Promise<string> {
    throw new Error(`deployAccount not implemented for ${this.name}`);
  }

  async fundAccount(_index: number, _amount: bigint): Promise<string> {
    throw new Error(`fundAccount not implemented for ${this.name}`);
  }

  async transferToken(
    _fromIndex: number,
    _recipientAddress: string,
    _amount: bigint
  ): Promise<string> {
    throw new Error(`transferToken not implemented for ${this.name}`);
  }

  async getBalance(_addressOrIndex: number | string): Promise<bigint> {
    throw new Error(`getBalance not implemented for ${this.name}`);
  }
}
