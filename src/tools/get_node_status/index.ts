/**
 * MCP Tool: get_node_status
 * Fetches health, connectivity, wallet and chain state from the Bee node.
 */
import { Bee } from "@ethersphere/bee-js";
import { getResponseWithStructuredContent, ToolResponse } from "../../utils";

export async function getNodeStatus(bee: Bee): Promise<ToolResponse> {
  const [status, health, nodeInfo, wallet, chain] = await Promise.allSettled([
    bee.getStatus(),
    bee.getHealth(),
    bee.getNodeInfo(),
    bee.getWalletBalance(),
    bee.getChainState(),
  ]);

  const rawWallet = wallet.status === "fulfilled" ? wallet.value : null;
  const serializedWallet = rawWallet
    ? {
        ...rawWallet,
        bzzBalance: rawWallet.bzzBalance?.toDecimalString?.() ?? String(rawWallet.bzzBalance ?? ""),
        nativeTokenBalance: rawWallet.nativeTokenBalance?.toDecimalString?.() ?? String(rawWallet.nativeTokenBalance ?? ""),
      }
    : null;

  const result = {
    status:   status.status   === "fulfilled" ? status.value   : null,
    health:   health.status   === "fulfilled" ? health.value   : null,
    nodeInfo: nodeInfo.status === "fulfilled" ? nodeInfo.value : null,
    wallet:   serializedWallet,
    chain:    chain.status    === "fulfilled" ? chain.value    : null,
  };

  return getResponseWithStructuredContent(result);
}
