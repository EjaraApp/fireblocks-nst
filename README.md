# Fireblocks Non-Standard Token Library

A library for generating crypto receive addresses for tokens not natively supported by Fireblocks. Each token uses a single configured private key to derive infinite deterministic addresses that can receive crypto. All complexity (account deployment, gas funding) is handled automatically.

Currently supported: **STRK** (StarkNet native token)

## Prerequisites

- Node.js >= 20
- HashiCorp Vault with KV secrets engine

## Setup

### 1. HashiCorp Vault

Enable the KV secrets engine:

```bash
vault secrets enable -path=fireblocks kv
```

Add a secret for each token. For STRK:

```bash
vault kv put fireblocks/STRK \
  PRIVATE_KEY="0x..." \
  ACCOUNT_CLASS_HASH="0x..." \
  ACCOUNT_ADDRESS="0x..." \
  RPC_URL="https://rpc.starknet-testnet.lava.build"
```

| Field | Description |
|-------|-------------|
| `PRIVATE_KEY` | StarkNet private key for signing transactions |
| `ACCOUNT_CLASS_HASH` | Class hash of the account contract to deploy |
| `ACCOUNT_ADDRESS` | Pre-deployed master wallet address (funds deployments and buy-flow sends) |
| `RPC_URL` | StarkNet RPC endpoint |

### 2. Environment

Create a `.env` file:

```bash
HASHICORP_VAULT_ADDRESS=http://127.0.0.1:8200
HASHICORP_VAULT_TOKEN=your-vault-token
```

### 3. Install

```bash
npm install
```

## Usage

```typescript
import { createCoinHandler } from 'fireblocks-nst';

const handler = await createCoinHandler();
const strk = handler.getCoin('STRK');

// Generate a receive address (deterministic, no network call)
const address = strk.generateAddress(0);

// Check balance
const balance = await strk.getBalance(0);         // by index
const balance2 = await strk.getBalance(address);   // by address

// Sweep: transfer received crypto out (auto-deploys account if needed)
const sweepTx = await strk.sweep(0, recipientAddress, amount);  // specific amount
const sweepAllTx = await strk.sweep(0, recipientAddress);       // full balance minus gas

// Send: transfer from master wallet to a recipient (buy flow)
const sendTx = await strk.send(recipientAddress, amount);
```

## API

### `generateAddress(index: number): string`

Computes a deterministic StarkNet address for the given index. Same index always returns the same address. No network call required. The address can receive tokens immediately — no deployment needed to receive.

### `getBalance(addressOrIndex: number | string): Promise<bigint>`

Returns the STRK balance in wei. Accepts an index (resolved to address) or a hex address string.

### `sweep(index: number, recipientAddress: string, amount?: bigint): Promise<string>`

Transfers tokens from a generated address to a recipient. This is the **sell flow** — collecting crypto that was received at a generated address.

- If the account at `index` hasn't been deployed yet, it is **automatically deployed** (funded from the master wallet)
- If `amount` is specified, transfers that exact amount
- If `amount` is omitted, sweeps the **full balance minus gas** (150% buffer on estimated fee)
- Throws if the balance is too low to cover gas
- Returns the transaction hash

### `send(recipientAddress: string, amount: bigint): Promise<string>`

Transfers tokens from the **master wallet** to a recipient. This is the **buy flow** — sending crypto to a user who purchased it.

Returns the transaction hash.

## Testing

```bash
# Unit tests (42 tests)
npm test

# Integration test against Sepolia testnet (requires Vault + funded master wallet)
npm run test:integration
```

## Adding a New Token

1. Create `src/coins/<token>.ts` extending `Coin`
2. Implement `generateAddress`, `getBalance`, `sweep`, `send`
3. Install the chain's SDK (e.g. `npm install <chain-sdk>`)
4. Register in `src/coin_handler.ts`
5. Add Vault secret at `fireblocks/<TOKEN>`
