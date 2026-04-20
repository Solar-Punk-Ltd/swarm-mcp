/**
 * MCP Tool: get_wallet_address
 * Returns the Ethereum address of the Bee node's wallet. Users can be told to
 * fund this address with BZZ / xDAI before purchasing postage stamps.
 */
import { Bee } from "@ethersphere/bee-js";
import {
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";

export async function getWalletAddress(bee: Bee): Promise<ToolResponse> {
  try {
    const wallet = await bee.getWalletBalance();
    return getResponseWithStructuredContent({
      address: wallet.walletAddress,
      chainId: wallet.chainID,
      chequebookContractAddress: wallet.chequebookContractAddress,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return getToolErrorResponse(`Unable to read wallet address: ${reason}`);
  }
}
