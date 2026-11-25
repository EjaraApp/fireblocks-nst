import {PaymasterRpc} from 'starknet';
import {AvnuConfig} from '../interfaces/coin_interface';

/**
 * Build the Avnu SNIP-29 paymaster client.
 *
 * Avnu deprecated its original REST paymaster — the `/paymaster/v1/*` endpoints
 * behind the `api-key` header — in favour of the SNIP-29 JSON-RPC service at
 * `https://starknet.paymaster.avnu.fi` (sepolia: `https://sepolia.paymaster.avnu.fi`),
 * authenticated with the `x-paymaster-api-key` header.
 *
 * starknet.js already ships a SNIP-29 client (`PaymasterRpc`), so instead of
 * hand-rolling the JSON-RPC build/sign/execute dance we hand it the Avnu-specific
 * configuration and let `Account.executePaymasterTransaction` drive it. That one
 * SDK call builds the SNIP-9 outside-execution typed data, signs it with the
 * account key, and relays it through the paymaster.
 *
 * `config.apiUrl` is the paymaster base URL (no path); `config.apiKey` is the
 * portal key. Both come from the `fireblocks/AVNU` Vault secret.
 */
export function createAvnuPaymaster(config: AvnuConfig): PaymasterRpc {
  return new PaymasterRpc({
    nodeUrl: config.apiUrl.replace(/\/+$/, ''),
    headers: {'x-paymaster-api-key': config.apiKey},
  });
}
