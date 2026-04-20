/**
 * MCP Tool: get_node_public_key
 * Returns the Bee node's ACT publisher public key and related identity fields.
 */
import { Bee } from "@ethersphere/bee-js";
import {
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";

export async function getNodePublicKey(bee: Bee): Promise<ToolResponse> {
  try {
    const addresses = await bee.getNodeAddresses();
    return getResponseWithStructuredContent({
      publicKey: addresses.publicKey.toHex(),
      publicKeyCompressed: addresses.publicKey.toCompressedHex(),
      pssPublicKey: addresses.pssPublicKey.toHex(),
      ethAddress: addresses.ethereum.toChecksum(),
      overlay: addresses.overlay.toHex(),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return getToolErrorResponse(
      `Unable to read node addresses: ${reason}`,
    );
  }
}
