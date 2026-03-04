#!/usr/bin/env node
/**
 * Deploy a single generated account by index or address.
 *
 * Usage:
 *   npm run cli:deploy -- --index 5
 *   npm run cli:deploy -- --address 0x123...abc
 *
 * Options:
 *   --index    Address index to deploy (provide this or --address)
 *   --address  Generated address to deploy (looked up by index)
 */
import 'dotenv/config';
import {STRK} from '../coins/strk';
import {getCoinConfig} from '../utils/hvault';

const MAX_INDEX_SEARCH = 10000;

function parseArgs(): {index?: number; address?: string} {
  const args = process.argv.slice(2);
  let index: number | undefined;
  let address: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--index' && args[i + 1]) {
      index = parseInt(args[++i], 10);
    } else if (args[i] === '--address' && args[i + 1]) {
      address = args[++i];
    }
  }

  if (index === undefined && !address) {
    console.error(
      'Usage: npm run cli:deploy -- --index <n>\n' +
        '       npm run cli:deploy -- --address <0x...>'
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

  return {index, address};
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

  const address = strk.generateAddress(index);
  console.log(`Address (index ${index}): ${address}`);

  const deployed = await strk.isDeployed(address);
  if (deployed) {
    console.log('Account already deployed — nothing to do.');
    return;
  }

  console.log('Deploying account (funding from master wallet)...');
  const txHash = await strk.deployAccount(index);
  console.log(`Done! Deploy TX: ${txHash}`);
}

main().catch(err => {
  console.error('Deploy failed:', err.message || err);
  process.exit(1);
});
