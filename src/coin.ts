import {PaymasterRpc, RpcProvider} from 'starknet';
import {CoinConfig, CoinInterface, FeePayer} from './interfaces/coin_interface';

export class Coin implements CoinInterface {
  name: string;
  config: CoinConfig;
  provider: RpcProvider;
  paymaster: PaymasterRpc | null;

  constructor(
    name: string,
    config: CoinConfig,
    paymaster?: PaymasterRpc | null
  ) {
    this.name = name;
    this.config = config;
    this.provider = new RpcProvider({nodeUrl: config.rpcUrl});
    this.paymaster = paymaster ?? null;
  }

  get feePayer(): FeePayer {
    return this.config.feePayer ?? 'WALLET';
  }

  /** Whether the fee-payer policy allows attempting Avnu sponsorship. */
  useAvnu(): boolean {
    return (
      this.paymaster !== null &&
      (this.feePayer === 'AVNU' || this.feePayer === 'AVNU_FALLBACK_WALLET')
    );
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
