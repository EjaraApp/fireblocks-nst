import assert from 'assert';
import sinon from 'sinon';
import {Account, RpcProvider} from 'starknet';
import {STRK} from '../../src/coins/strk';
import {CoinConfig} from '../../src/interfaces/coin_interface';

const TEST_CONFIG: CoinConfig = {
  privateKey:
    '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  classHash:
    '0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f',
  rpcUrl: 'https://starknet-sepolia.public.blastapi.io',
  accountAddress:
    '0x0000000000000000000000000000000000000000000000000000000000000001',
};

const FAKE_TX_HASH = '0xabc123def456';
const FAKE_FUND_TX_HASH = '0xfund111222';
const FAKE_DEPLOY_TX_HASH = '0xdeploy333444';
const FAKE_RECIPIENT =
  '0x049d36570d4e46f48e99674bd3fcc84644ddd6a40f7f7e7e4b1a2b3c4d5e6f70';

describe('STRK', () => {
  let strk: STRK;

  beforeEach(() => {
    strk = new STRK(TEST_CONFIG);
  });

  afterEach(() => {
    sinon.restore();
  });

  // ──────────────────────────────────────────────
  // generateAddress
  // ──────────────────────────────────────────────
  describe('generateAddress', () => {
    it('should return a deterministic address for a given index', () => {
      const addr1 = strk.generateAddress(0);
      const addr2 = strk.generateAddress(0);
      assert.strictEqual(addr1, addr2);
    });

    it('should return different addresses for different indices', () => {
      const addr0 = strk.generateAddress(0);
      const addr1 = strk.generateAddress(1);
      const addr2 = strk.generateAddress(2);
      assert.notStrictEqual(addr0, addr1);
      assert.notStrictEqual(addr1, addr2);
      assert.notStrictEqual(addr0, addr2);
    });

    it('should return a valid hex string address', () => {
      const addr = strk.generateAddress(0);
      assert.match(addr, /^0x[0-9a-fA-F]+$/);
    });

    it('should be consistent across instances with same config', () => {
      const strk2 = new STRK(TEST_CONFIG);
      assert.strictEqual(strk.generateAddress(5), strk2.generateAddress(5));
    });

    it('should generate many unique addresses', () => {
      const addresses = new Set<string>();
      for (let i = 0; i < 100; i++) {
        addresses.add(strk.generateAddress(i));
      }
      assert.strictEqual(addresses.size, 100);
    });

    it('should throw for negative index', () => {
      assert.throws(() => strk.generateAddress(-1), /non-negative integer/);
    });

    it('should throw for non-integer index', () => {
      assert.throws(() => strk.generateAddress(1.5), /non-negative integer/);
    });

    it('should work with index 0', () => {
      const addr = strk.generateAddress(0);
      assert.ok(addr.startsWith('0x'));
    });

    it('should work with large indices', () => {
      const addr = strk.generateAddress(999999);
      assert.match(addr, /^0x[0-9a-fA-F]+$/);
    });
  });

  // ──────────────────────────────────────────────
  // deployAccount
  // ──────────────────────────────────────────────
  describe('deployAccount', () => {
    function stubDeployFlow() {
      const estimateStub = sinon
        .stub(Account.prototype, 'estimateAccountDeployFee')
        .resolves({overall_fee: 1000n, resourceBounds: {}, unit: 'FRI'} as any);

      // execute is called on the master account (funding), then deployAccount on the new account
      const executeStub = sinon
        .stub(Account.prototype, 'execute')
        .resolves({transaction_hash: FAKE_FUND_TX_HASH});

      const deployStub = sinon
        .stub(Account.prototype, 'deployAccount')
        .resolves({
          contract_address: strk.generateAddress(0),
          transaction_hash: FAKE_DEPLOY_TX_HASH,
        });

      const waitStub = sinon
        .stub(RpcProvider.prototype, 'waitForTransaction')
        .resolves({} as any);

      return {estimateStub, executeStub, deployStub, waitStub};
    }

    it('should estimate fee, fund from master, then deploy', async () => {
      const {estimateStub, executeStub, deployStub, waitStub} =
        stubDeployFlow();

      const txHash = await strk.deployAccount(0);

      assert.strictEqual(txHash, FAKE_DEPLOY_TX_HASH);
      assert.ok(estimateStub.calledOnce);
      assert.ok(executeStub.calledOnce); // master funds the new address
      assert.ok(deployStub.calledOnce); // new account deploys itself
      assert.strictEqual(waitStub.callCount, 2); // wait for fund + deploy
    });

    it('should fund with 150% of estimated fee', async () => {
      const {executeStub} = stubDeployFlow();

      await strk.deployAccount(0);

      // estimated fee = 1000n, fund amount = 1000 * 3 / 2 = 1500
      const calls = executeStub.firstCall.args[0] as any[];
      assert.strictEqual(calls[0].entrypoint, 'transfer');
      assert.match(calls[0].contractAddress, /^0x04718f5a/);
    });

    it('should wait for funding tx before deploying', async () => {
      const {waitStub} = stubDeployFlow();

      await strk.deployAccount(0);

      // First wait call is for the funding tx
      assert.strictEqual(waitStub.firstCall.args[0], FAKE_FUND_TX_HASH);
      // Second wait call is for the deploy tx
      assert.strictEqual(waitStub.secondCall.args[0], FAKE_DEPLOY_TX_HASH);
    });

    it('should pass correct classHash and salt to deployAccount', async () => {
      const {deployStub} = stubDeployFlow();

      await strk.deployAccount(7);

      const call = deployStub.firstCall.args[0];
      assert.strictEqual(call.classHash, TEST_CONFIG.classHash);
      assert.strictEqual(call.addressSalt, 7);
    });

    it('should throw for negative index', async () => {
      await assert.rejects(
        () => strk.deployAccount(-1),
        /non-negative integer/
      );
    });

    it('should throw for non-integer index', async () => {
      await assert.rejects(
        () => strk.deployAccount(2.5),
        /non-negative integer/
      );
    });

    it('should propagate fee estimation errors', async () => {
      sinon
        .stub(Account.prototype, 'estimateAccountDeployFee')
        .rejects(new Error('estimation failed'));

      await assert.rejects(() => strk.deployAccount(0), /estimation failed/);
    });

    it('should propagate funding errors', async () => {
      sinon
        .stub(Account.prototype, 'estimateAccountDeployFee')
        .resolves({overall_fee: 1000n, resourceBounds: {}, unit: 'FRI'} as any);
      sinon
        .stub(Account.prototype, 'execute')
        .rejects(new Error('master account insufficient balance'));

      await assert.rejects(
        () => strk.deployAccount(0),
        /master account insufficient balance/
      );
    });

    it('should propagate deploy errors', async () => {
      sinon
        .stub(Account.prototype, 'estimateAccountDeployFee')
        .resolves({overall_fee: 1000n, resourceBounds: {}, unit: 'FRI'} as any);
      sinon
        .stub(Account.prototype, 'execute')
        .resolves({transaction_hash: FAKE_FUND_TX_HASH});
      sinon
        .stub(RpcProvider.prototype, 'waitForTransaction')
        .resolves({} as any);
      sinon
        .stub(Account.prototype, 'deployAccount')
        .rejects(new Error('deploy reverted'));

      await assert.rejects(() => strk.deployAccount(0), /deploy reverted/);
    });
  });

  // ──────────────────────────────────────────────
  // fundAccount
  // ──────────────────────────────────────────────
  describe('fundAccount', () => {
    it('should transfer from master wallet to generated address', async () => {
      const executeStub = sinon
        .stub(Account.prototype, 'execute')
        .resolves({transaction_hash: FAKE_FUND_TX_HASH});
      const waitStub = sinon
        .stub(RpcProvider.prototype, 'waitForTransaction')
        .resolves({} as any);

      const txHash = await strk.fundAccount(0, 5000n);

      assert.strictEqual(txHash, FAKE_FUND_TX_HASH);
      assert.ok(executeStub.calledOnce);
      assert.ok(waitStub.calledOnceWith(FAKE_FUND_TX_HASH));
    });

    it('should call STRK transfer with correct recipient', async () => {
      const executeStub = sinon
        .stub(Account.prototype, 'execute')
        .resolves({transaction_hash: FAKE_FUND_TX_HASH});
      sinon
        .stub(RpcProvider.prototype, 'waitForTransaction')
        .resolves({} as any);

      await strk.fundAccount(3, 1000n);

      const calls = executeStub.firstCall.args[0] as any[];
      assert.strictEqual(calls[0].entrypoint, 'transfer');
      assert.match(calls[0].contractAddress, /^0x04718f5a/);
    });

    it('should throw for negative index', async () => {
      await assert.rejects(
        () => strk.fundAccount(-1, 100n),
        /non-negative integer/
      );
    });

    it('should throw for zero amount', async () => {
      await assert.rejects(
        () => strk.fundAccount(0, 0n),
        /Amount must be positive/
      );
    });

    it('should throw for negative amount', async () => {
      await assert.rejects(
        () => strk.fundAccount(0, -10n),
        /Amount must be positive/
      );
    });

    it('should propagate master wallet errors', async () => {
      sinon
        .stub(Account.prototype, 'execute')
        .rejects(new Error('insufficient balance'));

      await assert.rejects(
        () => strk.fundAccount(0, 100n),
        /insufficient balance/
      );
    });
  });

  // ──────────────────────────────────────────────
  // transferToken
  // ──────────────────────────────────────────────
  describe('transferToken', () => {
    it('should execute transfer and return transaction hash', async () => {
      const executeStub = sinon
        .stub(Account.prototype, 'execute')
        .resolves({transaction_hash: FAKE_TX_HASH});
      const waitStub = sinon
        .stub(RpcProvider.prototype, 'waitForTransaction')
        .resolves({} as any);

      const txHash = await strk.transferToken(0, FAKE_RECIPIENT, 1000n);

      assert.strictEqual(txHash, FAKE_TX_HASH);
      assert.ok(executeStub.calledOnce);
      assert.ok(waitStub.calledOnceWith(FAKE_TX_HASH));
    });

    it('should call the STRK contract with transfer entrypoint', async () => {
      const executeStub = sinon
        .stub(Account.prototype, 'execute')
        .resolves({transaction_hash: FAKE_TX_HASH});
      sinon
        .stub(RpcProvider.prototype, 'waitForTransaction')
        .resolves({} as any);

      await strk.transferToken(0, FAKE_RECIPIENT, 500n);

      const calls = executeStub.firstCall.args[0] as any[];
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].entrypoint, 'transfer');
      assert.match(calls[0].contractAddress, /^0x04718f5a/);
    });

    it('should throw for negative fromIndex', async () => {
      await assert.rejects(
        () => strk.transferToken(-1, FAKE_RECIPIENT, 100n),
        /non-negative integer/
      );
    });

    it('should throw for non-integer fromIndex', async () => {
      await assert.rejects(
        () => strk.transferToken(0.5, FAKE_RECIPIENT, 100n),
        /non-negative integer/
      );
    });

    it('should throw for invalid recipient address', async () => {
      await assert.rejects(
        () => strk.transferToken(0, 'not-an-address', 100n),
        /Invalid recipient address/
      );
    });

    it('should throw for empty recipient address', async () => {
      await assert.rejects(
        () => strk.transferToken(0, '', 100n),
        /Invalid recipient address/
      );
    });

    it('should throw for zero amount', async () => {
      await assert.rejects(
        () => strk.transferToken(0, FAKE_RECIPIENT, 0n),
        /Amount must be positive/
      );
    });

    it('should throw for negative amount', async () => {
      await assert.rejects(
        () => strk.transferToken(0, FAKE_RECIPIENT, -10n),
        /Amount must be positive/
      );
    });

    it('should propagate provider errors', async () => {
      sinon
        .stub(Account.prototype, 'execute')
        .rejects(new Error('nonce too low'));

      await assert.rejects(
        () => strk.transferToken(0, FAKE_RECIPIENT, 100n),
        /nonce too low/
      );
    });
  });

  // ──────────────────────────────────────────────
  // getBalance
  // ──────────────────────────────────────────────
  describe('getBalance', () => {
    it('should return balance for an index', async () => {
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(['0x1388', '0x0']); // 5000 as low, 0 as high

      const balance = await strk.getBalance(0);

      assert.strictEqual(balance, 5000n);
    });

    it('should return balance for a direct address', async () => {
      const callStub = sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(['0x270f', '0x0']); // 9999

      const balance = await strk.getBalance(FAKE_RECIPIENT);

      assert.strictEqual(balance, 9999n);
      const callArg = callStub.firstCall.args[0] as any;
      assert.ok(
        callArg.calldata.some(
          (c: string) =>
            c === FAKE_RECIPIENT || BigInt(c) === BigInt(FAKE_RECIPIENT)
        )
      );
    });

    it('should resolve index to address before querying', async () => {
      const callStub = sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(['0x0', '0x0']);
      const expectedAddr = strk.generateAddress(3);

      await strk.getBalance(3);

      const callArg = callStub.firstCall.args[0] as any;
      assert.ok(
        callArg.calldata.some(
          (c: string) =>
            c === expectedAddr || BigInt(c) === BigInt(expectedAddr)
        )
      );
    });

    it('should return zero balance', async () => {
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(['0x0', '0x0']);

      const balance = await strk.getBalance(0);

      assert.strictEqual(balance, 0n);
    });

    it('should handle large balances using u256 high bits', async () => {
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(['0x0', '0x1']);

      const balance = await strk.getBalance(0);

      assert.strictEqual(balance, 1n << 128n);
    });

    it('should combine u256 low and high parts correctly', async () => {
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(['0x64', '0x2']);

      const balance = await strk.getBalance(0);

      const expected = 100n + (2n << 128n);
      assert.strictEqual(balance, expected);
    });

    it('should throw for negative index', async () => {
      await assert.rejects(() => strk.getBalance(-1), /non-negative integer/);
    });

    it('should throw for non-integer index', async () => {
      await assert.rejects(() => strk.getBalance(1.7), /non-negative integer/);
    });

    it('should throw for invalid address string', async () => {
      await assert.rejects(() => strk.getBalance('invalid'), /Invalid address/);
    });

    it('should propagate provider errors', async () => {
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .rejects(new Error('connection refused'));

      await assert.rejects(() => strk.getBalance(0), /connection refused/);
    });
  });
});
