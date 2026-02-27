import assert from 'assert';
import sinon from 'sinon';
import {CoinHandler, createCoinHandler} from '../src/coin_handler';
import {STRK} from '../src/coins/strk';
import * as hvault from '../src/utils/hvault';
import {CoinConfig} from '../src/interfaces/coin_interface';

const TEST_CONFIG: CoinConfig = {
  privateKey:
    '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  classHash:
    '0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f',
  rpcUrl: 'https://starknet-sepolia.public.blastapi.io',
  accountAddress:
    '0x0000000000000000000000000000000000000000000000000000000000000001',
};

describe('CoinHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('init', () => {
    it('should load STRK config from vault and register the coin', async () => {
      const vaultStub = sinon
        .stub(hvault, 'getCoinConfig')
        .resolves(TEST_CONFIG);

      const handler = new CoinHandler();
      await handler.init();

      assert.ok(vaultStub.calledOnceWith('STRK'));
      const coin = handler.getCoin('STRK');
      assert.ok(coin instanceof STRK);
      assert.strictEqual(coin.name, 'STRK');
    });

    it('should propagate vault errors', async () => {
      sinon.stub(hvault, 'getCoinConfig').rejects(new Error('vault sealed'));

      const handler = new CoinHandler();

      await assert.rejects(() => handler.init(), /vault sealed/);
    });
  });

  describe('getCoin', () => {
    it('should return the registered coin', async () => {
      sinon.stub(hvault, 'getCoinConfig').resolves(TEST_CONFIG);

      const handler = new CoinHandler();
      await handler.init();

      const coin = handler.getCoin('STRK');
      assert.ok(coin instanceof STRK);
    });

    it('should throw for unregistered coin', () => {
      const handler = new CoinHandler();
      assert.throws(() => handler.getCoin('BTC'), /Coin BTC not registered/);
    });

    it('should throw for empty name', () => {
      const handler = new CoinHandler();
      assert.throws(() => handler.getCoin(''), /not registered/);
    });
  });

  describe('createCoinHandler', () => {
    it('should return an initialized handler', async () => {
      sinon.stub(hvault, 'getCoinConfig').resolves(TEST_CONFIG);

      const handler = await createCoinHandler();

      assert.ok(handler instanceof CoinHandler);
      assert.ok(handler.getCoin('STRK') instanceof STRK);
    });

    it('should produce a handler whose STRK generates addresses', async () => {
      sinon.stub(hvault, 'getCoinConfig').resolves(TEST_CONFIG);

      const handler = await createCoinHandler();
      const strk = handler.getCoin('STRK') as STRK;
      const addr = strk.generateAddress(0);

      assert.match(addr, /^0x[0-9a-fA-F]+$/);
    });
  });
});
