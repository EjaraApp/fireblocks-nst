import {Account, ec, hash, cairo, CallData} from 'starknet';
import {Coin} from '../coin';
import {CoinConfig} from '../interfaces/coin_interface';

// STRK ERC-20 contract address (same on mainnet and sepolia)
const STRK_CONTRACT_ADDRESS =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

export class STRK extends Coin {
  private publicKey: string;
  private masterAccount: Account;

  constructor(config: CoinConfig) {
    super('STRK', config);
    this.publicKey = ec.starkCurve.getStarkKey(config.privateKey);
    this.masterAccount = new Account({
      provider: this.provider,
      address: config.accountAddress,
      signer: config.privateKey,
    });
  }

  generateAddress(index: number): string {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Index must be a non-negative integer, got ${index}`);
    }

    return hash.calculateContractAddressFromHash(
      index,
      this.config.classHash,
      CallData.compile({publicKey: this.publicKey}),
      0
    );
  }

  async deployAccount(index: number): Promise<string> {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Index must be a non-negative integer, got ${index}`);
    }

    const address = this.generateAddress(index);
    const newAccount = new Account({
      provider: this.provider,
      address,
      signer: this.config.privateKey,
    });

    const deployPayload = {
      classHash: this.config.classHash,
      constructorCalldata: CallData.compile({publicKey: this.publicKey}),
      addressSalt: index,
    };

    // Estimate how much the deployment will cost
    const fee = await newAccount.estimateAccountDeployFee(deployPayload);
    // Add 50% buffer for fee fluctuations
    const fundAmount = (fee.overall_fee * 3n) / 2n;

    // Fund the new address from the master wallet
    const {transaction_hash: fundTx} = await this.masterAccount.execute([
      {
        contractAddress: STRK_CONTRACT_ADDRESS,
        entrypoint: 'transfer',
        calldata: CallData.compile({
          recipient: address,
          amount: cairo.uint256(fundAmount),
        }),
      },
    ]);
    await this.provider.waitForTransaction(fundTx);

    // Deploy the account contract
    const {transaction_hash: deployTx} = await newAccount.deployAccount(
      deployPayload
    );
    await this.provider.waitForTransaction(deployTx);

    return deployTx;
  }

  async fundAccount(index: number, amount: bigint): Promise<string> {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Index must be a non-negative integer, got ${index}`);
    }
    if (amount <= 0n) {
      throw new Error(`Amount must be positive, got ${amount}`);
    }

    const address = this.generateAddress(index);
    const {transaction_hash} = await this.masterAccount.execute([
      {
        contractAddress: STRK_CONTRACT_ADDRESS,
        entrypoint: 'transfer',
        calldata: CallData.compile({
          recipient: address,
          amount: cairo.uint256(amount),
        }),
      },
    ]);

    await this.provider.waitForTransaction(transaction_hash);
    return transaction_hash;
  }

  async transferToken(
    fromIndex: number,
    recipientAddress: string,
    amount: bigint
  ): Promise<string> {
    if (!Number.isInteger(fromIndex) || fromIndex < 0) {
      throw new Error(
        `fromIndex must be a non-negative integer, got ${fromIndex}`
      );
    }
    if (!recipientAddress || !recipientAddress.match(/^0x[0-9a-fA-F]+$/)) {
      throw new Error(`Invalid recipient address: ${recipientAddress}`);
    }
    if (amount <= 0n) {
      throw new Error(`Amount must be positive, got ${amount}`);
    }

    const address = this.generateAddress(fromIndex);
    const account = new Account({
      provider: this.provider,
      address,
      signer: this.config.privateKey,
    });

    const {transaction_hash} = await account.execute([
      {
        contractAddress: STRK_CONTRACT_ADDRESS,
        entrypoint: 'transfer',
        calldata: CallData.compile({
          recipient: recipientAddress,
          amount: cairo.uint256(amount),
        }),
      },
    ]);

    await this.provider.waitForTransaction(transaction_hash);
    return transaction_hash;
  }

  async getBalance(addressOrIndex: number | string): Promise<bigint> {
    if (typeof addressOrIndex === 'number') {
      if (!Number.isInteger(addressOrIndex) || addressOrIndex < 0) {
        throw new Error(
          `Index must be a non-negative integer, got ${addressOrIndex}`
        );
      }
    } else if (!addressOrIndex.match(/^0x[0-9a-fA-F]+$/)) {
      throw new Error(`Invalid address: ${addressOrIndex}`);
    }

    const address =
      typeof addressOrIndex === 'number'
        ? this.generateAddress(addressOrIndex)
        : addressOrIndex;

    const result = await this.provider.callContract({
      contractAddress: STRK_CONTRACT_ADDRESS,
      entrypoint: 'balanceOf',
      calldata: CallData.compile({account: address}),
    });
    // balanceOf returns u256 as [low, high]
    const low = BigInt(result[0]);
    const high = BigInt(result[1]);
    return low + (high << 128n);
  }
}
