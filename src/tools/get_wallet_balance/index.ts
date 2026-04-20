/**
 * MCP Tool: get_wallet_balance
 * Returns BZZ + native-token balances of the Bee node's wallet and the
 * chequebook's available balance. Used to pre-check funds before stamp
 * purchases.
 */
import { Bee } from "@ethersphere/bee-js";
import {
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";

export async function getWalletBalance(bee: Bee): Promise<ToolResponse> {
  try {
    const [wallet, chequebook] = await Promise.all([
      bee.getWalletBalance(),
      bee.getChequebookBalance(),
    ]);
    return getResponseWithStructuredContent({
      walletAddress: wallet.walletAddress,
      chainId: wallet.chainID,
      bzzBalance: wallet.bzzBalance.toString(),
      nativeTokenBalance: wallet.nativeTokenBalance.toString(),
      chequebookAddress: wallet.chequebookContractAddress,
      chequebookTotalBalance: chequebook.totalBalance.toString(),
      chequebookAvailableBalance: chequebook.availableBalance.toString(),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return getToolErrorResponse(`Unable to read wallet balance: ${reason}`);
  }
}
