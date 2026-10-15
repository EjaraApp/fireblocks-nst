#!/usr/bin/env node
/**
 * Sweep a pool of generated addresses back to the master account.
 *
 * Usage:
 *   npm run cli:sweep-pool -- --start 0 --end 9
 *   npm run cli:sweep-pool -- --start 0 --end 9 --amount 0.5
 *
 * Options:
 *   --start   First index in the range (required)
 *   --end     Last index in the range, inclusive (required)
 *   --amount  Amount in STRK to sweep per address (optional, sweeps full balance minus gas if omitted)
 */
import 'dotenv/config';
import {STRK} from '../coins/strk';
import {getCoinConfig} from '../utils/hvault';

function parseArgs(): {start: number; end: number; amount?: number} {
  const args = process.argv.slice(2);
  let start: number | undefined;
  let end: number | undefined;
  let amount: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start' && args[i + 1]) {
      start = parseInt(args[++i], 10);
    } else if (args[i] === '--end' && args[i + 1]) {
      end = parseInt(args[++i], 10);
    } else if (args[i] === '--amount' && args[i + 1]) {
      amount = parseFloat(args[++i]);
    }
  }

  if (start === undefined || isNaN(start) || end === undefined || isNaN(end)) {
    console.error(
      'Usage: npm run cli:sweep-pool -- --start <n> --end <n> [--amount <n>]'
    );
    process.exit(1);
  }

  if (start < 0 || end < start) {
    console.error('start must be >= 0 and end must be >= start');
    process.exit(1);
  }

  if (amount !== undefined && (isNaN(amount) || amount <= 0)) {
    console.error('Amount must be a positive number');
    process.exit(1);
  }

  return {start, end, amount};
}

async function main() {
  const {start, end, amount} = parseArgs();
  const total = end - start + 1;

  console.log('Loading config from Vault...');
  const config = await getCoinConfig('STRK');
  const strk = new STRK(config);
  const master = config.accountAddress;

  const sweepDesc = amount ? `${amount} STRK` : 'full balance (minus gas)';
  console.log(
    `Sweeping ${sweepDesc} from ${total} addresses (index ${start} to ${end}) to master (${master})...\n`
  );

  let swept = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = start; i <= end; i++) {
    const address = strk.generateAddress(i);
    process.stdout.write(
      `[${i - start + 1}/${total}] Index ${i} (${address}): `
    );

    try {
      const balance = await strk.getBalance(i);
      if (balance === 0) {
        console.log('zero balance, skipping');
        skipped++;
        continue;
      }

      console.log(`balance ${balance} STRK`);
      const txHash = await strk.sweep(i, master, amount);
      console.log(`    swept (TX: ${txHash})`);
      swept++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED — ${msg}`);
      failed++;
    }
  }

  console.log(
    `\nSummary: ${swept} swept, ${skipped} skipped (zero balance), ${failed} failed`
  );

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Sweep pool failed:', err.message || err);
  process.exit(1);
});
