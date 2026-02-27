import axios from 'axios';
import {config} from './config';
import {CoinConfig} from '../interfaces/coin_interface';

export async function getCoinConfig(coinName: string): Promise<CoinConfig> {
  const response = await axios.get(
    `${config.hashicorpVaultAddress}/v1/fireblocks/${coinName}`,
    {
      headers: {
        'X-Vault-Token': config.hashicorpVaultToken,
      },
    }
  );
  const data = response.data.data;
  return {
    privateKey: data.PRIVATE_KEY,
    classHash: data.ACCOUNT_CLASS_HASH,
    rpcUrl: data.RPC_URL,
    accountAddress: data.ACCOUNT_ADDRESS,
  };
}
