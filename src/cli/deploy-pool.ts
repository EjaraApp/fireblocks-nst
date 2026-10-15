#!/usr/bin/env node
/**
 * Deploy a pool of generated addresses.
 *
 * Usage:
 *   npm run cli:deploy-pool -- --start 0 --end 9
 *
 * Options:
 *   --start  First index in the range (required)
 *   --end    Last index in the range, inclusive (required)
 */
import 'dotenv/config';
import {STRK} from '../coins/strk';
import {getCoinConfig} from '../utils/hvault';

function parseArgs(): {start: number; end: number} {
  const args = process.argv.slice(2);
  let start: number | undefined;
  let end: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start' && args[i + 1]) {
      start = parseInt(args[++i], 10);
    } else if (args[i] === '--end' && args[i + 1]) {
      end = parseInt(args[++i], 10);
    }
  }

  if (start === undefined || isNaN(start) || end === undefined || isNaN(end)) {
    console.error('Usage: npm run cli:deploy-pool -- --start <n> --end <n>');
    process.exit(1);
  }

  if (start < 0 || end < start) {
    console.error('start must be >= 0 and end must be >= start');
    process.exit(1);
  }

  return {start, end};
}

async function main() {
  const {start, end} = parseArgs();
  const total = end - start + 1;

  console.log('Loading config from Vault...');
  const config = await getCoinConfig('STRK');
  const strk = new STRK(config);

  console.log(`Deploying ${total} addresses (index ${start} to ${end})...\n`);

  let deployed = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = start; i <= end; i++) {
    const address = strk.generateAddress(i);
    process.stdout.write(
      `[${i - start + 1}/${total}] Index ${i} (${address}): `
    );

    try {
      const alreadyDeployed = await strk.isDeployed(address);
      if (alreadyDeployed) {
        console.log('already deployed, skipping');
        skipped++;
        continue;
      }

      const txHash = await strk.deployAccount(i);
      console.log(`deployed (TX: ${txHash})`);
      deployed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED — ${msg}`);
      failed++;
    }
  }

  console.log(
    `\nSummary: ${deployed} deployed, ${skipped} skipped, ${failed} failed`
  );

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Deploy pool failed:', err.message || err);
  process.exit(1);
});
