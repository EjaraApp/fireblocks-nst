# Fireblocks Non-Standard Token Library

A library for generating crypto receive addresses for tokens not natively supported by Fireblocks. Each token uses a single configured private key to derive infinite deterministic addresses that can receive crypto, and the same key can deploy and spend from those addresses.

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
| `ACCOUNT_ADDRESS` | Pre-deployed master wallet address (funds deployments) |
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

// Deploy the account contract (auto-funds from master wallet)
const deployTx = await strk.deployAccount(0);

// Fund a deployed address from the master wallet
const fundTx = await strk.fundAccount(0, 10_000_000_000_000_000n);

// Check balance
const balance = await strk.getBalance(0);         // by index
const balance2 = await strk.getBalance(address);   // by address

// Transfer tokens out
const transferTx = await strk.transferToken(0, recipientAddress, amount);
```

## API

### `generateAddress(index: number): string`

Computes a deterministic StarkNet address for the given index. Same index always returns the same address. No network call required.

### `deployAccount(index: number): Promise<string>`

Deploys the account contract at the address for `index`. Automatically estimates the deploy fee, funds the address from the master wallet (150% of estimated fee), and deploys. Returns the deploy transaction hash.

### `fundAccount(index: number, amount: bigint): Promise<string>`

Transfers `amount` wei of STRK from the master wallet to the address at `index`. Returns the transaction hash.

### `transferToken(fromIndex: number, recipientAddress: string, amount: bigint): Promise<string>`

Transfers `amount` wei of STRK from the account at `fromIndex` to `recipientAddress`. The account must be deployed and have sufficient balance. Returns the transaction hash.

### `getBalance(addressOrIndex: number | string): Promise<bigint>`

Returns the STRK balance in wei. Accepts an index (resolved to address) or a hex address string.

## Testing

```bash
# Unit tests (50 tests)
npm test

# Integration test against Sepolia testnet (requires Vault + funded master wallet)
npm run test:integration
```

## Adding a New Token

1. Create `src/coins/<token>.ts` extending `Coin`
2. Implement `generateAddress`, `deployAccount`, `fundAccount`, `transferToken`, `getBalance`
3. Install the chain's SDK (e.g. `npm install <chain-sdk>`)
4. Register in `src/coin_handler.ts`
5. Add Vault secret at `fireblocks/<TOKEN>`
