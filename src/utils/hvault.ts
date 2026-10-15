import axios from 'axios';
import {config} from './config';
import {AvnuConfig, CoinConfig, FeePayer} from '../interfaces/coin_interface';

export async function getCoinConfig(coinName: string): Promise<CoinConfig> {
  const response = await axios.get(
    `${config.hashicorpVaultAddress}/v1/fireblocks/data/${coinName}`,
    {
      headers: {
        'X-Vault-Token': config.hashicorpVaultToken,
      },
    }
  );
  const data = response.data.data.data;

  return {
    privateKey: data.PRIVATE_KEY,
    classHash: data.ACCOUNT_CLASS_HASH,
    rpcUrl: data.RPC_URL,
    accountAddress: data.ACCOUNT_ADDRESS,
    feePayer: (data.FEE_PAYER as FeePayer | undefined) ?? 'WALLET',
  };
}

export async function getAvnuConfig(): Promise<AvnuConfig> {
  const response = await axios.get(
    `${config.hashicorpVaultAddress}/v1/fireblocks/data/AVNU`,
    {
      headers: {
        'X-Vault-Token': config.hashicorpVaultToken,
      },
    }
  );
  const data = response.data.data.data;

  return {
    apiUrl: data.AVNU_API_URL,
    apiKey: data.AVNU_API_KEY,
  };
}
