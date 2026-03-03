#!/usr/bin/env node
/**
 * Sweep balance from a generated address to the master account.
 *
 * Usage:
 *   npm run cli:sweep -- --index 5
 *   npm run cli:sweep -- --index 5 --amount 0.5
 *   npm run cli:sweep -- --address 0x123...abc
 *   npm run cli:sweep -- --address 0x123...abc --amount 0.5
 *
 * Options:
 *   --index    Address index to sweep from (provide this or --address)
 *   --address  Generated address to sweep from (looked up by index)
 *   --amount   Amount in STRK to sweep (optional, sweeps full balance minus gas if omitted)
 */
import 'dotenv/config';
import {STRK} from '../coins/strk';
import {getCoinConfig} from '../utils/hvault';

const MAX_INDEX_SEARCH = 10000;

function parseArgs(): {index?: number; address?: string; amount?: number} {
  const args = process.argv.slice(2);
  let index: number | undefined;
  let address: string | undefined;
  let amount: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--index' && args[i + 1]) {
      index = parseInt(args[++i], 10);
    } else if (args[i] === '--address' && args[i + 1]) {
      address = args[++i];
    } else if (args[i] === '--amount' && args[i + 1]) {
      amount = parseFloat(args[++i]);
    }
  }

  if (index === undefined && !address) {
    console.error(
      'Usage: npm run cli:sweep -- --index <n> [--amount <n>]\n' +
        '       npm run cli:sweep -- --address <0x...> [--amount <n>]'
    );
    process.exit(1);
  }

  if (index !== undefined && isNaN(index)) {
    console.error('Index must be a number');
    process.exit(1);
  }

  if (address && !address.match(/^0x[0-9a-fA-F]+$/)) {
    console.error('Address must be a valid hex string (0x...)');
    process.exit(1);
  }

  if (amount !== undefined && (isNaN(amount) || amount <= 0)) {
    console.error('Amount must be a positive number');
    process.exit(1);
  }

  return {index, address, amount};
}

function findIndex(strk: STRK, target: string): number {
  const normalized = target.toLowerCase();
  for (let i = 0; i < MAX_INDEX_SEARCH; i++) {
    if (strk.generateAddress(i).toLowerCase() === normalized) {
      return i;
    }
  }
  throw new Error(
    `Address not found in first ${MAX_INDEX_SEARCH} generated addresses`
  );
}

async function main() {
  const parsed = parseArgs();

  console.log('Loading config from Vault...');
  const config = await getCoinConfig('STRK');
  const strk = new STRK(config);

  let index: number;
  if (parsed.index !== undefined) {
    index = parsed.index;
  } else {
    console.log(`Looking up index for address ${parsed.address}...`);
    index = findIndex(strk, parsed.address!);
    console.log(`Found at index ${index}`);
  }

  const amount = parsed.amount;
  const address = strk.generateAddress(index);
  const balance = await strk.getBalance(index);
  console.log(`Address (index ${index}): ${address}`);
  console.log(`Balance: ${balance} STRK`);

  if (balance === 0) {
    console.log('Nothing to sweep — balance is zero.');
    return;
  }

  const master = config.accountAddress;
  const sweepDesc = amount ? `${amount} STRK` : 'full balance (minus gas)';
  console.log(`Sweeping ${sweepDesc} to master (${master})...`);

  const txHash = await strk.sweep(index, master, amount);
  console.log(`Done! TX: ${txHash}`);

  const remaining = await strk.getBalance(index);
  console.log(`Remaining balance: ${remaining} STRK`);
}

main().catch(err => {
  console.error('Sweep failed:', err.message || err);
  process.exit(1);
});
