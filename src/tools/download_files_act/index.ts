/**
 * MCP Tool: download_files_act
 * Downloads ACT-protected folder/file manifests. Mirrors download_files but
 * threads ACT options (actPublisher, actHistoryAddress, actTimestamp) through
 * manifest unmarshalling and every chunk fetch.
 */
import { Bee, DownloadOptions, MantarayNode } from "@ethersphere/bee-js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";
import { normalizePublicKeyHex, normalizeReferenceHex } from "../../utils/act";
import { DownloadFilesActArgs } from "./models";
import { BAD_REQUEST_STATUS, NOT_FOUND_STATUS } from "../../constants";

export async function downloadFilesAct(
  args: DownloadFilesActArgs,
  bee: Bee,
  transport: unknown
): Promise<ToolResponse> {
  if (!args.reference) {
    return getToolErrorResponse("Missing required parameter: reference.");
  }
  if (!args.actPublisher) {
    return getToolErrorResponse("Missing required parameter: actPublisher.");
  }
  if (!args.actHistoryAddress) {
    return getToolErrorResponse(
      "Missing required parameter: actHistoryAddress."
    );
  }
  if (args.filePath && !(transport instanceof StdioServerTransport)) {
    return getToolErrorResponse(
      "Saving to file path is only supported in stdio mode."
    );
  }

  let reference: string;
  let actPublisher: string;
  let actHistoryAddress: string;
  try {
    reference = normalizeReferenceHex(args.reference);
    actPublisher = normalizePublicKeyHex(args.actPublisher);
    actHistoryAddress = normalizeReferenceHex(args.actHistoryAddress);
  } catch (e) {
    return getToolErrorResponse(e instanceof Error ? e.message : String(e));
  }

  const actOptions: DownloadOptions = {
    actPublisher,
    actHistoryAddress,
  };
  if (args.actTimestamp !== undefined) {
    actOptions.actTimestamp = args.actTimestamp;
  }

  let node: MantarayNode;
  try {
    node = await MantarayNode.unmarshal(bee, reference, actOptions);
    await node.loadRecursively(bee, actOptions);
  } catch (err) {
    if (errorHasStatus(err, NOT_FOUND_STATUS)) {
      return getToolErrorResponse(
        "Manifest not found, or this node is not a grantee for the given history."
      );
    }
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to unmarshal manifest — the reference may not be a manifest. Try download_data_act for a single object.";
    return getToolErrorResponse(msg);
  }

  const nodes = node.collect();

  if (args.filePath) {
    const destinationFolder = args.filePath;
    if (!fs.existsSync(destinationFolder)) {
      await mkdir(destinationFolder, { recursive: true });
    }

    try {
      if (nodes.length === 1) {
        const n = nodes[0];
        const data = await bee.downloadData(n.targetAddress, actOptions);
        await writeFile(
          path.join(destinationFolder, path.basename(n.fullPathString)),
          data.toUint8Array()
        );
      } else {
        for (const n of nodes) {
          const parsed = path.parse(n.fullPathString);
          const nodeDest = path.join(destinationFolder, parsed.dir);
          if (!fs.existsSync(nodeDest)) {
            await mkdir(nodeDest, { recursive: true });
          }
          const data = await bee.downloadData(n.targetAddress, actOptions);
          await writeFile(
            path.join(destinationFolder, n.fullPathString),
            data.toUint8Array()
          );
        }
      }
    } catch (err) {
      const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
        ? getErrorMessage(err)
        : "Unable to download ACT-protected files.";
      return getToolErrorResponse(msg);
    }

    return getResponseWithStructuredContent({
      reference,
      manifestNodeCount: nodes.length,
      savedTo: destinationFolder,
      message: `ACT manifest content (${nodes.length} files) successfully downloaded to ${destinationFolder}`,
    });
  }

  const filesList = nodes.map((n) => ({
    path: n.fullPathString || "/",
    targetAddress: Array.from(n.targetAddress)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
    metadata: n.metadata,
  }));

  return getResponseWithStructuredContent({
    reference,
    type: "manifest",
    files: filesList,
    message:
      "ACT-protected manifest. Provide a filePath to download all files, or call download_data_act for individual chunks.",
  });
}
