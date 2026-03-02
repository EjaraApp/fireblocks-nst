import {Account, ec, hash, cairo, CallData} from 'starknet';
import {Coin} from '../coin';
import {CoinConfig} from '../interfaces/coin_interface';

// STRK ERC-20 contract address (same on mainnet and sepolia)
const STRK_CONTRACT_ADDRESS =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

const DECIMALS = 18;
const ONE_UNIT = 10n ** BigInt(DECIMALS);

/** Convert a human-readable number (e.g. 0.1, 2.5) into wei (bigint). */
function toWei(value: number): bigint {
  if (typeof value !== 'number' || !isFinite(value) || value < 0) {
    throw new Error(`Invalid amount: ${value}`);
  }
  // Use string manipulation to avoid floating-point precision loss
  const str = value.toFixed(DECIMALS);
  const [whole, frac] = str.split('.');
  return BigInt(whole) * ONE_UNIT + BigInt(frac);
}

/** Convert a wei bigint into a human-readable number (e.g. 0.1, 2.5). */
function fromWei(wei: bigint): number {
  const whole = wei / ONE_UNIT;
  const frac = wei % ONE_UNIT;
  const fracStr = frac.toString().padStart(DECIMALS, '0');
  return parseFloat(`${whole}.${fracStr}`);
}

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

  async getBalance(addressOrIndex: number | string): Promise<number> {
    const wei = await this.getBalanceWei(addressOrIndex);
    return fromWei(wei);
  }

  private async getBalanceWei(
    addressOrIndex: number | string
  ): Promise<bigint> {
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
    amount?: number
  ): Promise<string> {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Index must be a non-negative integer, got ${index}`);
    }
    if (!recipientAddress || !recipientAddress.match(/^0x[0-9a-fA-F]+$/)) {
      throw new Error(`Invalid recipient address: ${recipientAddress}`);
    }
    if (amount !== undefined && amount <= 0) {
      throw new Error(`Amount must be positive, got ${amount}`);
    }

    const amountWei = amount !== undefined ? toWei(amount) : undefined;
    const address = this.generateAddress(index);
    const needsDeploy = !(await this.isDeployed(address));

    // When a specific amount is requested, verify balance can cover it before
    // spending gas on deployment or transfer
    if (amountWei !== undefined) {
      const balance = await this.getBalanceWei(address);
      if (balance < amountWei) {
        throw new Error(
          `Address balance (${fromWei(
            balance
          )}) insufficient for requested amount (${amount})`
        );
      }
    }

    // Deploy the account if it hasn't been deployed yet
    if (needsDeploy) {
      await this.deployAccount(index);
    }

    const account = new Account({
      provider: this.provider,
      address,
      signer: this.config.privateKey,
    });

    // If no amount specified, estimate gas and sweep the full balance
    let transferAmount = amountWei;
    if (transferAmount === undefined) {
      const balance = await this.getBalanceWei(address);
      if (balance === 0n) {
        throw new Error('Address has zero balance, nothing to sweep');
      }
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
          `Balance (${fromWei(balance)}) too low to cover gas (${fromWei(
            gasCost
          )})`
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

  async send(recipientAddress: string, amount: number): Promise<string> {
    if (!recipientAddress || !recipientAddress.match(/^0x[0-9a-fA-F]+$/)) {
      throw new Error(`Invalid recipient address: ${recipientAddress}`);
    }
    if (amount <= 0) {
      throw new Error(`Amount must be positive, got ${amount}`);
    }

    const amountWei = toWei(amount);

    // Verify master wallet has enough balance before executing
    const masterBalance = await this.getBalanceWei(this.config.accountAddress);
    if (masterBalance < amountWei) {
      throw new Error(
        `Master wallet balance (${fromWei(
          masterBalance
        )}) insufficient for amount (${amount})`
      );
    }

    const {transaction_hash} = await this.masterAccount.execute([
      {
        contractAddress: STRK_CONTRACT_ADDRESS,
        entrypoint: 'transfer',
        calldata: CallData.compile({
          recipient: recipientAddress,
          amount: cairo.uint256(amountWei),
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

    // Verify master wallet can cover the funding before spending gas
    const masterBalance = await this.getBalanceWei(this.config.accountAddress);
    if (masterBalance < fundAmount) {
      throw new Error(
        `Master wallet balance (${fromWei(
          masterBalance
        )}) insufficient to fund deployment (${fromWei(fundAmount)})`
      );
    }

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
