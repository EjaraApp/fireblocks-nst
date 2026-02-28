# Fireblocks NST

Generate receive addresses and manage tokens not natively supported by Fireblocks. Currently supports **STRK** (StarkNet).

## Setup

### Vault

Store token config in HashiCorp Vault at `fireblocks/<TOKEN>`:

```bash
vault kv put fireblocks/STRK \
  PRIVATE_KEY="0x..." \
  ACCOUNT_CLASS_HASH="0x..." \
  ACCOUNT_ADDRESS="0x..." \
  RPC_URL="https://rpc.starknet-testnet.lava.build"
```

### Environment

```bash
HASHICORP_VAULT_ADDRESS=http://127.0.0.1:8200
HASHICORP_VAULT_TOKEN=your-vault-token
```

### Install

```bash
npm install
```

## Usage

```typescript
import { createCoinHandler } from 'fireblocks-nst';

const handler = await createCoinHandler();
const strk = handler.getCoin('STRK');

// Generate receive addresses (deterministic, no network call)
const address = strk.generateAddress(0);

// Check balance (by index or address)
const balance = await strk.getBalance(0);

// Sweep: collect crypto from a generated address (sell flow)
// Automatically deploys the account if needed
await strk.sweep(0, recipientAddress, amount);  // specific amount
await strk.sweep(0, recipientAddress);          // full balance minus gas

// Send: transfer from master wallet to a recipient (buy flow)
await strk.send(recipientAddress, amount);
```

## API

| Method | Description |
|--------|-------------|
| `generateAddress(index)` | Returns a deterministic address for the given index. No network call. |
| `getBalance(indexOrAddress)` | Returns the token balance in wei. Accepts an index or hex address. |
| `sweep(index, recipient, amount?)` | Transfers tokens from a generated address. Auto-deploys if needed. Omit amount to sweep full balance minus gas. |
| `send(recipient, amount)` | Transfers tokens from the master wallet to a recipient. |

All methods that submit transactions return the transaction hash.

## Testing

```bash
npm test                  # unit tests
npm run test:integration  # Sepolia testnet (requires Vault + funded wallet)
```

## Adding a new token

1. Create `src/coins/<token>.ts` extending `Coin`
2. Implement `generateAddress`, `getBalance`, `sweep`, `send`
3. Register in `src/coin_handler.ts`
4. Add Vault secret at `fireblocks/<TOKEN>`
