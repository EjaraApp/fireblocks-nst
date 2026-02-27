import 'dotenv/config';

export const config = {
  hashicorpVaultAddress: process.env.HASHICORP_VAULT_ADDRESS!,
  hashicorpVaultToken: process.env.HASHICORP_VAULT_TOKEN!,
};
