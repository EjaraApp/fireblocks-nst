/**
 * STRK Integration Test — runs against StarkNet Sepolia testnet.
 *
 * Prerequisites:
 *   1. Set env vars or .env:
 *      HASHICORP_VAULT_ADDRESS=<vault url>
 *      HASHICORP_VAULT_TOKEN=<vault token>
 *   2. Vault must have `fireblocks/STRK` secret with:
 *      PRIVATE_KEY, ACCOUNT_CLASS_HASH, RPC_URL, ACCOUNT_ADDRESS
 *   3. The configured ACCOUNT_ADDRESS (master wallet) must have STRK balance
 *
 * Run:
 *   npm run test:integration
 */
import 'dotenv/config';
import {STRK} from '../../src/coins/strk';
import {getCoinConfig} from '../../src/utils/hvault';

// 0.01 STRK in wei (18 decimals)
const FUND_AMOUNT = 10_000_000_000_000_000n;
// 0.001 STRK
const TRANSFER_AMOUNT = 1_000_000_000_000_000n;

async function run() {
  console.log('=== STRK Integration Test (Sepolia) ===\n');

  // 1. Load config from vault
  console.log('[1] Loading config from Vault...');
  const config = await getCoinConfig('STRK');
  console.log('    RPC URL:', config.rpcUrl);
  console.log('    Class Hash:', config.classHash);
  console.log('    Master Wallet:', config.accountAddress);
  console.log();

  const strk = new STRK(config);

  // 2. Check master wallet balance
  console.log('[2] Checking master wallet balance...');
  const masterBalance = await strk.getBalance(config.accountAddress);
  console.log(`    Balance: ${masterBalance} wei`);
  if (masterBalance === 0n) {
    console.log('    Master wallet has no funds. Cannot proceed.');
    return;
  }
  console.log();

  // 3. Generate addresses
  console.log('[3] Generating addresses...');
  for (let i = 0; i < 5; i++) {
    const addr = strk.generateAddress(i);
    console.log(`    Index ${i}: ${addr}`);
  }
  console.log();

  // 4. Deploy account at index 1 (auto-funds from master, then deploys)
  const testIndex = 1;
  const addr = strk.generateAddress(testIndex);
  console.log(`[4] Deploying account at index ${testIndex} (${addr})...`);
  console.log('    Auto-funding from master wallet + deploying...');
  try {
    const deployTx = await strk.deployAccount(testIndex);
    console.log(`    Deploy TX: ${deployTx}`);
  } catch (err: any) {
    if (
      err.message.includes('already deployed') ||
      err.message.includes('ALREADY_EXISTS')
    ) {
      console.log('    Account already deployed (skipping).');
    } else {
      throw err;
    }
  }
  console.log();

  // 5. Fund the deployed account with enough for a transfer
  console.log(
    `[5] Funding index ${testIndex} with ${FUND_AMOUNT} wei from master...`
  );
  const fundTx = await strk.fundAccount(testIndex, FUND_AMOUNT);
  console.log(`    Fund TX: ${fundTx}`);
  const balanceAfterFund = await strk.getBalance(testIndex);
  console.log(`    Balance after funding: ${balanceAfterFund} wei`);
  console.log();

  // 6. Transfer from deployed account back to master
  console.log(
    `[6] Transferring ${TRANSFER_AMOUNT} wei from index ${testIndex} to master...`
  );
  const transferTx = await strk.transferToken(
    testIndex,
    config.accountAddress,
    TRANSFER_AMOUNT
  );
  console.log(`    Transfer TX: ${transferTx}`);
  console.log();

  // 7. Final balances
  console.log('[7] Final balances:');
  const finalMaster = await strk.getBalance(config.accountAddress);
  const finalAccount = await strk.getBalance(testIndex);
  console.log(`    Master wallet: ${finalMaster} wei`);
  console.log(`    Index ${testIndex}:       ${finalAccount} wei`);

  console.log('\n=== Integration test complete — all steps passed ===');
}

run().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
