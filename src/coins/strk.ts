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
    const low = BigInt(result[0]);
    const high = BigInt(result[1]);
    return low + (high << 128n);
  }

  async sweep(
    index: number,
    recipientAddress: string,
    amount?: bigint
  ): Promise<string> {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Index must be a non-negative integer, got ${index}`);
    }
    if (!recipientAddress || !recipientAddress.match(/^0x[0-9a-fA-F]+$/)) {
      throw new Error(`Invalid recipient address: ${recipientAddress}`);
    }
    if (amount !== undefined && amount <= 0n) {
      throw new Error(`Amount must be positive, got ${amount}`);
    }

    const address = this.generateAddress(index);

    // Deploy the account if it hasn't been deployed yet
    if (!(await this.isDeployed(address))) {
      await this.deployAccount(index);
    }

    const account = new Account({
      provider: this.provider,
      address,
      signer: this.config.privateKey,
    });

    // If no amount specified, estimate gas and sweep the full balance
    let transferAmount = amount;
    if (transferAmount === undefined) {
      const balance = await this.getBalance(address);
      const fee = await account.estimateInvokeFee([
        {
          contractAddress: STRK_CONTRACT_ADDRESS,
          entrypoint: 'transfer',
          calldata: CallData.compile({
            recipient: recipientAddress,
            amount: cairo.uint256(balance),
          }),
        },
      ]);
      // Use 150% of estimated fee as gas buffer
      const gasCost = (fee.overall_fee * 3n) / 2n;
      transferAmount = balance - gasCost;
      if (transferAmount <= 0n) {
        throw new Error(
          `Balance (${balance}) too low to cover gas (${gasCost})`
        );
      }
    }

    const {transaction_hash} = await account.execute([
      {
        contractAddress: STRK_CONTRACT_ADDRESS,
        entrypoint: 'transfer',
        calldata: CallData.compile({
          recipient: recipientAddress,
          amount: cairo.uint256(transferAmount),
        }),
      },
    ]);

    await this.provider.waitForTransaction(transaction_hash);
    return transaction_hash;
  }

  async send(recipientAddress: string, amount: bigint): Promise<string> {
    if (!recipientAddress || !recipientAddress.match(/^0x[0-9a-fA-F]+$/)) {
      throw new Error(`Invalid recipient address: ${recipientAddress}`);
    }
    if (amount <= 0n) {
      throw new Error(`Amount must be positive, got ${amount}`);
    }

    const {transaction_hash} = await this.masterAccount.execute([
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

  // ── Internal methods ──────────────────────────

  private async isDeployed(address: string): Promise<boolean> {
    try {
      await this.provider.getClassHashAt(address);
      return true;
    } catch {
      return false;
    }
  }

  private async deployAccount(index: number): Promise<string> {
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

    // Estimate deploy fee and fund with 150% buffer
    const fee = await newAccount.estimateAccountDeployFee(deployPayload);
    const fundAmount = (fee.overall_fee * 3n) / 2n;

    // Fund from master wallet
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

    // Deploy
    const {transaction_hash: deployTx} = await newAccount.deployAccount(
      deployPayload
    );
    await this.provider.waitForTransaction(deployTx);

    return deployTx;
  }
}
