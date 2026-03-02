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
const FAKE_FUND_TX = '0xfund111222';
const FAKE_DEPLOY_TX = '0xdeploy333444';
const FAKE_RECIPIENT =
  '0x049d36570d4e46f48e99674bd3fcc84644ddd6a40f7f7e7e4b1a2b3c4d5e6f70';

// 100 STRK in wei hex
const BALANCE_100_STRK = ['0x56BC75E2D63100000', '0x0'];
// 10 STRK in wei hex
const BALANCE_10_STRK = ['0x8AC7230489E80000', '0x0'];
// 0 STRK
const BALANCE_ZERO = ['0x0', '0x0'];

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
  // getBalance
  // ──────────────────────────────────────────────
  describe('getBalance', () => {
    it('should return balance as a number in STRK', async () => {
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(BALANCE_10_STRK);

      const balance = await strk.getBalance(0);
      assert.strictEqual(balance, 10);
    });

    it('should return balance for a direct address', async () => {
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(BALANCE_100_STRK);

      const balance = await strk.getBalance(FAKE_RECIPIENT);
      assert.strictEqual(balance, 100);
    });

    it('should resolve index to address before querying', async () => {
      const callStub = sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(BALANCE_ZERO);
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
      sinon.stub(RpcProvider.prototype, 'callContract').resolves(BALANCE_ZERO);

      const balance = await strk.getBalance(0);
      assert.strictEqual(balance, 0);
    });

    it('should handle fractional balances', async () => {
      // 0.5 STRK = 500000000000000000 wei = 0x6F05B59D3B20000
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(['0x6F05B59D3B20000', '0x0']);

      const balance = await strk.getBalance(0);
      assert.strictEqual(balance, 0.5);
    });

    it('should throw for negative index', async () => {
      await assert.rejects(() => strk.getBalance(-1), /non-negative integer/);
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

  // ──────────────────────────────────────────────
  // sweep
  // ──────────────────────────────────────────────
  describe('sweep', () => {
    function stubDeployedAccount() {
      // Account is already deployed
      sinon.stub(RpcProvider.prototype, 'getClassHashAt').resolves('0x123');
      // callContract for getBalance check (address has 100 STRK)
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(BALANCE_100_STRK);
      const executeStub = sinon
        .stub(Account.prototype, 'execute')
        .resolves({transaction_hash: FAKE_TX_HASH});
      sinon
        .stub(RpcProvider.prototype, 'waitForTransaction')
        .resolves({} as any);
      return {executeStub};
    }

    function stubUndeployedAccount() {
      // Account is NOT deployed — getClassHashAt throws
      const getClassHashStub = sinon
        .stub(RpcProvider.prototype, 'getClassHashAt')
        .rejects(new Error('Contract not found'));

      // callContract for getBalance checks (address balance + master wallet)
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(BALANCE_100_STRK);

      // estimateAccountDeployFee for deploy
      sinon
        .stub(Account.prototype, 'estimateAccountDeployFee')
        .resolves({overall_fee: 1000n, resourceBounds: {}, unit: 'FRI'} as any);

      // execute: first call = fund for deploy, second call = sweep transfer
      const executeStub = sinon.stub(Account.prototype, 'execute');
      executeStub.onFirstCall().resolves({transaction_hash: FAKE_FUND_TX});
      executeStub.onSecondCall().resolves({transaction_hash: FAKE_TX_HASH});

      // deployAccount
      const deployStub = sinon
        .stub(Account.prototype, 'deployAccount')
        .resolves({
          contract_address: '0x123',
          transaction_hash: FAKE_DEPLOY_TX,
        });

      sinon
        .stub(RpcProvider.prototype, 'waitForTransaction')
        .resolves({} as any);

      return {getClassHashStub, executeStub, deployStub};
    }

    it('should transfer with specific amount when account is deployed', async () => {
      const {executeStub} = stubDeployedAccount();

      const txHash = await strk.sweep(0, FAKE_RECIPIENT, 0.5);

      assert.strictEqual(txHash, FAKE_TX_HASH);
      assert.ok(executeStub.calledOnce);
      const calls = executeStub.firstCall.args[0] as any[];
      assert.strictEqual(calls[0].entrypoint, 'transfer');
    });

    it('should sweep full balance minus gas when no amount specified', async () => {
      sinon.stub(RpcProvider.prototype, 'getClassHashAt').resolves('0x123');
      // estimateInvokeFee for the transfer
      sinon
        .stub(Account.prototype, 'estimateInvokeFee')
        .resolves({overall_fee: 2000n, resourceBounds: {}, unit: 'FRI'} as any);
      // callContract for getBalance — 10 STRK
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(BALANCE_10_STRK);
      sinon
        .stub(Account.prototype, 'execute')
        .resolves({transaction_hash: FAKE_TX_HASH});
      sinon
        .stub(RpcProvider.prototype, 'waitForTransaction')
        .resolves({} as any);

      const txHash = await strk.sweep(0, FAKE_RECIPIENT);

      assert.strictEqual(txHash, FAKE_TX_HASH);
    });

    it('should throw when balance too low to cover gas', async () => {
      sinon.stub(RpcProvider.prototype, 'getClassHashAt').resolves('0x123');
      sinon.stub(Account.prototype, 'estimateInvokeFee').resolves({
        overall_fee: 10_000_000_000_000_000_000n,
        resourceBounds: {},
        unit: 'FRI',
      } as any);
      // Balance is only 0.5 STRK, gas is huge
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(['0x6F05B59D3B20000', '0x0']);

      await assert.rejects(
        () => strk.sweep(0, FAKE_RECIPIENT),
        /Balance.*too low to cover gas/
      );
    });

    it('should auto-deploy when account is not deployed', async () => {
      const {deployStub, executeStub} = stubUndeployedAccount();

      const txHash = await strk.sweep(0, FAKE_RECIPIENT, 0.5);

      assert.strictEqual(txHash, FAKE_TX_HASH);
      // First execute = fund for deploy, second = sweep transfer
      assert.ok(deployStub.calledOnce);
      assert.strictEqual(executeStub.callCount, 2);
    });

    it('should skip deployment when account is already deployed', async () => {
      stubDeployedAccount();

      await strk.sweep(0, FAKE_RECIPIENT, 0.5);

      // getClassHashAt was called and didn't throw → no deploy
      assert.ok(
        (Account.prototype.deployAccount as sinon.SinonStub).notCalled ||
          !(Account.prototype.deployAccount as sinon.SinonStub).called
      );
    });

    it('should throw for negative index', async () => {
      await assert.rejects(
        () => strk.sweep(-1, FAKE_RECIPIENT, 1),
        /non-negative integer/
      );
    });

    it('should throw for invalid recipient', async () => {
      await assert.rejects(
        () => strk.sweep(0, 'bad-address', 1),
        /Invalid recipient address/
      );
    });

    it('should throw for zero amount', async () => {
      await assert.rejects(
        () => strk.sweep(0, FAKE_RECIPIENT, 0),
        /Amount must be positive/
      );
    });

    it('should throw for negative amount', async () => {
      await assert.rejects(
        () => strk.sweep(0, FAKE_RECIPIENT, -5),
        /Amount must be positive/
      );
    });

    it('should propagate transfer errors', async () => {
      sinon.stub(RpcProvider.prototype, 'getClassHashAt').resolves('0x123');
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(BALANCE_100_STRK);
      sinon
        .stub(Account.prototype, 'execute')
        .rejects(new Error('nonce mismatch'));

      await assert.rejects(
        () => strk.sweep(0, FAKE_RECIPIENT, 1),
        /nonce mismatch/
      );
    });

    it('should propagate deploy errors', async () => {
      sinon
        .stub(RpcProvider.prototype, 'getClassHashAt')
        .rejects(new Error('not found'));
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(BALANCE_100_STRK);
      sinon
        .stub(Account.prototype, 'estimateAccountDeployFee')
        .rejects(new Error('estimation failed'));

      await assert.rejects(
        () => strk.sweep(0, FAKE_RECIPIENT, 1),
        /estimation failed/
      );
    });
  });

  // ──────────────────────────────────────────────
  // send
  // ──────────────────────────────────────────────
  describe('send', () => {
    it('should transfer from master wallet to recipient', async () => {
      // Master wallet has 100 STRK
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(BALANCE_100_STRK);
      const executeStub = sinon
        .stub(Account.prototype, 'execute')
        .resolves({transaction_hash: FAKE_TX_HASH});
      sinon
        .stub(RpcProvider.prototype, 'waitForTransaction')
        .resolves({} as any);

      const txHash = await strk.send(FAKE_RECIPIENT, 1);

      assert.strictEqual(txHash, FAKE_TX_HASH);
      assert.ok(executeStub.calledOnce);
      const calls = executeStub.firstCall.args[0] as any[];
      assert.strictEqual(calls[0].entrypoint, 'transfer');
      assert.match(calls[0].contractAddress, /^0x04718f5a/);
    });

    it('should wait for transaction confirmation', async () => {
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(BALANCE_100_STRK);
      sinon
        .stub(Account.prototype, 'execute')
        .resolves({transaction_hash: FAKE_TX_HASH});
      const waitStub = sinon
        .stub(RpcProvider.prototype, 'waitForTransaction')
        .resolves({} as any);

      await strk.send(FAKE_RECIPIENT, 0.5);

      assert.ok(waitStub.calledOnceWith(FAKE_TX_HASH));
    });

    it('should throw for invalid recipient', async () => {
      await assert.rejects(
        () => strk.send('not-hex', 1),
        /Invalid recipient address/
      );
    });

    it('should throw for empty recipient', async () => {
      await assert.rejects(() => strk.send('', 1), /Invalid recipient address/);
    });

    it('should throw for zero amount', async () => {
      await assert.rejects(
        () => strk.send(FAKE_RECIPIENT, 0),
        /Amount must be positive/
      );
    });

    it('should throw for negative amount', async () => {
      await assert.rejects(
        () => strk.send(FAKE_RECIPIENT, -10),
        /Amount must be positive/
      );
    });

    it('should propagate provider errors', async () => {
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(BALANCE_100_STRK);
      sinon
        .stub(Account.prototype, 'execute')
        .rejects(new Error('insufficient balance'));

      await assert.rejects(
        () => strk.send(FAKE_RECIPIENT, 1),
        /insufficient balance/
      );
    });

    it('should throw when master wallet balance is insufficient', async () => {
      // Master wallet has only 0.5 STRK
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(['0x6F05B59D3B20000', '0x0']);
      await assert.rejects(
        () => strk.send(FAKE_RECIPIENT, 10),
        /Master wallet balance.*insufficient/
      );
    });
  });

  // ──────────────────────────────────────────────
  // Safety checks
  // ──────────────────────────────────────────────
  describe('safety checks', () => {
    it('sweep should throw when address balance insufficient for requested amount', async () => {
      // Account is deployed
      sinon.stub(RpcProvider.prototype, 'getClassHashAt').resolves('0x123');
      // Address balance is only 0.5 STRK
      sinon
        .stub(RpcProvider.prototype, 'callContract')
        .resolves(['0x6F05B59D3B20000', '0x0']);

      await assert.rejects(
        () => strk.sweep(0, FAKE_RECIPIENT, 5),
        /Address balance.*insufficient/
      );
    });

    it('sweep should throw when address balance insufficient even if undeployed', async () => {
      // Account is NOT deployed
      sinon
        .stub(RpcProvider.prototype, 'getClassHashAt')
        .rejects(new Error('not found'));
      // Address balance is 0
      sinon.stub(RpcProvider.prototype, 'callContract').resolves(BALANCE_ZERO);

      await assert.rejects(
        () => strk.sweep(0, FAKE_RECIPIENT, 5),
        /Address balance.*insufficient/
      );
    });

    it('sweep should not deploy when balance check fails', async () => {
      sinon
        .stub(RpcProvider.prototype, 'getClassHashAt')
        .rejects(new Error('not found'));
      sinon.stub(RpcProvider.prototype, 'callContract').resolves(BALANCE_ZERO);
      const deployStub = sinon
        .stub(Account.prototype, 'deployAccount')
        .resolves({} as any);

      await assert.rejects(
        () => strk.sweep(0, FAKE_RECIPIENT, 5),
        /Address balance.*insufficient/
      );
      // Deploy should never have been called
      assert.ok(deployStub.notCalled);
    });

    it('sweep without amount should throw when address has zero balance', async () => {
      sinon.stub(RpcProvider.prototype, 'getClassHashAt').resolves('0x123');
      sinon.stub(RpcProvider.prototype, 'callContract').resolves(BALANCE_ZERO);

      await assert.rejects(
        () => strk.sweep(0, FAKE_RECIPIENT),
        /zero balance.*nothing to sweep/
      );
    });

    it('deploy should throw when master wallet cannot fund deployment', async () => {
      // Account is NOT deployed
      sinon
        .stub(RpcProvider.prototype, 'getClassHashAt')
        .rejects(new Error('not found'));

      // Address has enough balance for the transfer (100 STRK)
      const callStub = sinon.stub(RpcProvider.prototype, 'callContract');
      callStub.resolves(BALANCE_100_STRK);

      // estimateAccountDeployFee returns very high fee
      sinon.stub(Account.prototype, 'estimateAccountDeployFee').resolves({
        overall_fee: 999_000_000_000_000_000_000n,
        resourceBounds: {},
        unit: 'FRI',
      } as any);

      // Master wallet balance on second call is too low
      callStub.onSecondCall().resolves(['0x6F05B59D3B20000', '0x0']); // 0.5 STRK

      await assert.rejects(
        () => strk.sweep(0, FAKE_RECIPIENT, 0.5),
        /Master wallet balance.*insufficient to fund deployment/
      );
    });
  });
});
