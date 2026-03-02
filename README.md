# Fireblocks NST

Generate receive addresses and manage tokens not natively supported by Fireblocks. A single private key combined with varying indices produces infinite deterministic addresses. Currently supports **STRK** (StarkNet).

## Installation

Install from GitHub in your project:

```bash
npm install git+https://github.com/EjaraApp/fireblocks-nst.git#main
```

Then import in your code:

```typescript
import {createCoinHandler, STRK} from 'fireblocks-nst';
```

## Setup

### Vault

Store token config in HashiCorp Vault at `fireblocks/<TOKEN>`:

```bash
vault kv put fireblocks/data/STRK \
  PRIVATE_KEY="0x..." \
  ACCOUNT_CLASS_HASH="0x..." \
  ACCOUNT_ADDRESS="0x..." \
  RPC_URL="https://rpc.starknet-testnet.lava.build"
```

### Environment

Set these in your environment or `.env` file:

```bash
HASHICORP_VAULT_ADDRESS=http://127.0.0.1:8200
HASHICORP_VAULT_TOKEN=your-vault-token
```

## Usage

```typescript
import {createCoinHandler} from 'fireblocks-nst';

const handler = await createCoinHandler();
const strk = handler.getCoin('STRK');

// Generate receive addresses (deterministic, no network call)
const address = strk.generateAddress(0);

// Check balance (by index or address)
const balance = await strk.getBalance(0);

// Sweep: collect crypto from a generated address (sell flow)
// Automatically deploys the account if needed
await strk.sweep(0, recipientAddress, amount); // specific amount
await strk.sweep(0, recipientAddress); // full balance minus gas

// Send: transfer from master wallet to a recipient (buy flow)
await strk.send(recipientAddress, amount);
```

## API

| Method                             | Description                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `generateAddress(index)`           | Returns a deterministic address for the given index. No network call.                                                          |
| `getBalance(indexOrAddress)`       | Returns the balance in human-readable units (e.g. `10.5` STRK). Accepts an index or hex address.                               |
| `sweep(index, recipient, amount?)` | Transfers from a generated address. Auto-deploys if needed. Amount in STRK (e.g. `1.5`). Omit to sweep full balance minus gas. |
| `send(recipient, amount)`          | Transfers from the master wallet to a recipient. Amount in STRK (e.g. `0.01`).                                                 |

All amounts are in human-readable units (e.g. `1.5` STRK, not wei). Wei conversion is handled internally. All methods that submit transactions return the transaction hash.

## Direct Usage (Without Vault)

If you want to skip Vault and provide config directly:

```typescript
import {STRK} from 'fireblocks-nst';

const strk = new STRK({
  privateKey: '0x...',
  classHash: '0x...',
  rpcUrl: 'https://starknet-mainnet.public.blastapi.io',
  accountAddress: '0x...',
});

const address = strk.generateAddress(0);
const balance = await strk.getBalance(address);
```

## Development

```bash
npm install
npm test                  # unit tests + lint
npm run test:integration  # Sepolia testnet (requires Vault + funded wallet)
```

## Adding a new token

1. Create `src/coins/<token>.ts` extending `Coin`
2. Implement `generateAddress`, `getBalance`, `sweep`, `send`
3. Register in `src/coin_handler.ts`
4. Add Vault secret at `fireblocks/<TOKEN>`
