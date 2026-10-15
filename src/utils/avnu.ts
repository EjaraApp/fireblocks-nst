import axios from 'axios';
import {AvnuConfig} from '../interfaces/coin_interface';

/** A single call in the format Avnu's paymaster API expects. */
export interface AvnuCall {
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
}

/** Account deployment parameters for `/paymaster/v1/deploy-account`. */
export interface AvnuDeploymentData {
  class_hash: string;
  salt: string;
  unique: string;
  calldata: string[];
  sigdata: string[];
}

export interface BuildTypedDataRequest {
  userAddress: string;
  calls: AvnuCall[];
  /** Omit/empty for sponsored ("gasfree") mode. */
  gasTokenAddress?: string;
  maxGasTokenAmount?: string;
  accountClassHash?: string;
}

/**
 * Thin client for Avnu's REST paymaster API (NOT the SNIP-29 JSON-RPC product).
 * Auth is the `api-key` header. All endpoints live under `/paymaster/v1/`.
 */
export class AvnuClient {
  private apiUrl: string;
  private apiKey: string;

  constructor(config: AvnuConfig) {
    this.apiUrl = config.apiUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'api-key': this.apiKey,
    };
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    try {
      const response = await axios.post(`${this.apiUrl}${path}`, body, {
        headers: this.headers(),
      });
      return response.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data as Record<string, unknown>;
        const detail =
          data.messages ?? data.message ?? data.error ?? JSON.stringify(data);
        throw new Error(`Avnu ${path} failed: ${JSON.stringify(detail)}`);
      }
      throw err;
    }
  }

  /** Build SNIP-9 typed data for a list of calls. */
  async buildTypedData(req: BuildTypedDataRequest): Promise<unknown> {
    const body: Record<string, unknown> = {
      userAddress: req.userAddress,
      calls: req.calls,
    };
    if (req.gasTokenAddress) body.gasTokenAddress = req.gasTokenAddress;
    if (req.maxGasTokenAmount) body.maxGasTokenAmount = req.maxGasTokenAmount;
    if (req.accountClassHash) body.accountClassHash = req.accountClassHash;
    return this.post('/paymaster/v1/build-typed-data', body);
  }

  /** Execute signed typed data gaslessly. Returns the transaction hash. */
  async execute(
    userAddress: string,
    typedData: string,
    signature: string[],
    deploymentData?: AvnuDeploymentData | null
  ): Promise<string> {
    const body: Record<string, unknown> = {
      userAddress,
      typedData,
      signature,
    };
    if (deploymentData) body.deploymentData = deploymentData;
    const data = (await this.post('/paymaster/v1/execute', body)) as {
      transactionHash: string;
    };
    return data.transactionHash;
  }

  /** Deploy an account with Avnu sponsoring the fee. Returns the tx hash. */
  async deployAccount(
    userAddress: string,
    deploymentData: AvnuDeploymentData
  ): Promise<string> {
    const data = (await this.post('/paymaster/v1/deploy-account', {
      userAddress,
      deploymentData,
    })) as {transactionHash: string};
    return data.transactionHash;
  }
}
