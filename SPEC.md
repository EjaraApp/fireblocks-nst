# Avnu Fee-Sponsorship Integration — Option A (Partial)

## Objective

Let Avnu sponsor transaction fees wherever the account supports it, and keep the
wallet-funded path where it does not.

Decided scope (see lattice: `fireblocks-nst-avnu-option-a-partial-integration-first`):

| Flow | Account | Avnu-capable? | After Option A |
|---|---|---|---|
| `send` (master → recipient) | master, Argent `0x036078…927f` | ✅ SNIP-9 | **Avnu gasless** (sponsored) |
| `deployAccount` (deploy generated address) | any class | ✅ deploy has no SNIP-9 requirement | **Avnu deploy-account** (no funding transfer) |
| `sweep` transfer (generated → recipient) | generated, OZ `0x061dac…8f` | ❌ legacy `__validate__` | **wallet-funded** (unchanged) |

Option B (migrate `ACCOUNT_CLASS_HASH` to an SNIP-9 class) is deferred and
internal-only.

## Ground truth (verified against live mainnet)

- Avnu REST paymaster base: `https://starknet.api.avnu.fi` (mainnet) /
  `https://sepolia.api.avnu.fi` (sepolia). **Not** `paymaster.avnu.fi` (that is
  the separate SNIP-29 JSON-RPC product).
- Auth header: **`api-key`** (NOT `x-paymaster-api-key`).
- Endpoints:
  - `POST /paymaster/v1/build-typed-data` → SNIP-9 `OutsideExecution` typed data
  - `POST /paymaster/v1/execute` → `{transactionHash}`
  - `POST /paymaster/v1/deploy-account` → `{transactionHash}`
- Sponsored ("gasfree") mode: `gasTokenAddress` omitted/empty + `api-key` set →
  the API-key owner is billed.
- Master account (Argent) supports `execute_from_outside_v2` (SNIP-9 v2);
  generated OZ accounts do **not** support any sponsorship mechanism (no
  `execute_from_outside*`, no `paymaster_data` in `__validate__`, no `upgrade`).

## Vault layout (already in place)

- `fireblocks/STRK`: `PRIVATE_KEY`, `ACCOUNT_CLASS_HASH`, `ACCOUNT_ADDRESS`,
  `RPC_URL`, `FEE_PAYER` (`AVNU` | `WALLET` | `AVNU_FALLBACK_WALLET`).
- `fireblocks/AVNU`: `AVNU_API_URL`, `AVNU_API_KEY`.

## Components

### 1. `src/utils/avnu.ts` (new)

`AvnuClient` (axios-based) with:

- `buildTypedData({userAddress, calls, gasTokenAddress?, maxGasTokenAmount?, accountClassHash?})`
  → returns the raw typed-data object.
  `calls` format: `{contractAddress, entrypoint, calldata: string[]}`.
- `execute({userAddress, typedData, signature, deploymentData?})` → `{transactionHash}`.
  `typedData` is serialized as a JSON string.
- `deployAccount({userAddress, deploymentData})` → `{transactionHash}`.
  `deploymentData` = `{class_hash, salt, unique, calldata, sigdata}`.

All requests send header `api-key: <avnuApiKey>`.

### 2. Signing helper (in `avnu.ts` or `strk.ts`)

Convert Avnu's typed-data object into a `starknet.js` `TypedData`, compute the
message hash for the account, and sign with the private key:

```
hash = TypedData.from(typedData).getMessageHash(accountAddress)
{r, s} = ec.starkCurve.sign(hash, privateKey)
signature = [r, s]
```

### 3. `src/coins/strk.ts` changes

- `send`: build a STRK `transfer` call; drive it through the fee-payer strategy.
  - `AVNU` → Avnu build-typed-data → sign → execute.
  - `WALLET` → existing `masterAccount.execute`.
  - `AVNU_FALLBACK_WALLET` → try Avnu, fall back to `masterAccount.execute` on error.
- `deployAccount`: build `deploymentData` for the generated address
  (`class_hash = ACCOUNT_CLASS_HASH`, `salt = index`, `unique = 0`,
  `calldata = {publicKey}`, `sigdata = []`) and drive through the strategy:
  - `AVNU` → `avnu.deployAccount` (no funding transfer).
  - `WALLET` → existing estimate + fund + `deployAccount`.
  - `AVNU_FALLBACK_WALLET` → try Avnu, fall back to the fund+deploy path.
- `sweep`: deploy step uses `deployAccount` (above); the transfer step stays
  wallet-funded (`account.execute`) because the generated OZ account cannot be
  sponsored.

### 4. Config plumbing

- `src/interfaces/coin_interface.ts`: add `feePayer` to `CoinConfig`; add
  `AvnuConfig` interface.
- `src/utils/hvault.ts`: add `getAvnuConfig()` reading `fireblocks/AVNU`;
  include `FEE_PAYER` when reading `fireblocks/STRK`.
- `src/coin_handler.ts`: load Avnu config, pass `feePayer` + avnu config to `STRK`.
- `src/coin.ts`: `Coin` carries the avnu client (constructed once).

## Testing strategy

1. **Read-only (safe)**: call `build-typed-data` on mainnet for the master
   account with a 0-amount self-transfer; assert we receive SNIP-9 typed data.
2. **Unit**: mock the Avnu client; verify strategy routing (AVNU / WALLET /
   FALLBACK) for `send` and `deployAccount`.
3. **Live (explicit, one tx)**: a real sponsored `send` of a tiny amount from the
   master account, only with user approval — proves the sign+execute path end to
   end and confirms the Argent signature format.

## Key risks

- **Argent signature format**: `execute_from_outside_v2` accepts a plain owner
  `[r, s]` (hex) signature. **Verified live on mainnet** — a sponsored 0.001 STRK
  self-transfer confirmed: `0x24a8f5a3224a2cfd3c7784f8c53c6acf60e77c9b42cf1cabfff1a564fba8961`.
- **Hex formatting**: Avnu requires **hex** for both `calldata` and `signature`
  (decimal strings are rejected with "Invalid … (hex format)"). Use `num.toHex`
  everywhere Avnu-facing (`cairo.uint256`/`CallData.compile` emit decimal).
- **`deploy-account` sigdata**: OZ accounts have `__validate_deploy__` → 0, so
  `sigdata` should be `[]`; verify the first real deploy.
- **Fee-payer default**: vault currently has `AVNU_FALLBACK_WALLET`; any Avnu
  failure degrades to the wallet path (no production bricking).

## Verification

- Unit: 51 tests pass (3 Avnu-routing tests), `gts lint` clean, `tsc` clean.
- Read-only: `build-typed-data` + `getMessageHash` + sign validated against the
  live mainnet vault.
- Live: sponsored `send` confirmed on mainnet (tx hash above).
