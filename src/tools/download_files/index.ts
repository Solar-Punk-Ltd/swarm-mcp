/**
 * MCP Tool: download_files
 * Download folder or files from a Swarm reference. If ACT parameters
 * (actPublisher, actHistoryAddress) are provided, threads ACT options
 * through manifest unmarshalling and every chunk fetch. Both ACT params
 * must be supplied together; partial input is rejected.
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
import { DownloadFilesArgs } from "./models";
import { TaskManager } from "../../tasks/task-manager";
import { CreateTaskModel, TaskState } from "../../tasks/models";
import { BAD_REQUEST_STATUS, NOT_FOUND_STATUS } from "../../constants";

export async function downloadFiles(
  args: DownloadFilesArgs,
  bee: Bee,
  transport: any,
  taskManager?: TaskManager,
  createTaskModel?: CreateTaskModel
): Promise<ToolResponse> {
  if (!args.reference) {
    return getToolErrorResponse("Missing required parameter: reference.");
  }
  if (args.filePath && !(transport instanceof StdioServerTransport)) {
    return getToolErrorResponse(
      "Saving to file path is only supported in stdio mode."
    );
  }

  const hasPublisher = typeof args.actPublisher === "string";
  const hasHistory = typeof args.actHistoryAddress === "string";
  if (hasPublisher !== hasHistory) {
    return getToolErrorResponse(
      "ACT download requires both actPublisher and actHistoryAddress."
    );
  }

  if (hasPublisher && hasHistory) {
    return downloadFilesAct(args, bee);
  }

  // Check if the reference is a manifest
  let isManifest = false;
  let node: MantarayNode;

  try {
    node = await MantarayNode.unmarshal(bee, args.reference);
    await node.loadRecursively(bee);
    isManifest = true;
  } catch (error) {
    // ignore
  }

  if (!isManifest) {
    return getToolErrorResponse(
      "Try download_data tool instead since the given reference is not a manifest."
    );
  }

  const isRunningAsTask = taskManager && createTaskModel;

  if (isRunningAsTask) {
    const task = await taskManager.createTask(createTaskModel, null, null);

    downloadFilesHelper(args, bee, node!)
      .then(async (result) => {
        await taskManager.setTaskResult(task.taskId, result);
      })
      .catch((error) => {
        let errorMessage = "Unable to download files.";
        if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
          errorMessage = getErrorMessage(error);
        }

        taskManager.updateTaskStatus(
          task.taskId,
          TaskState.FAILED,
          errorMessage
        );
      });

    return {
      task,
    };
  }

  return await downloadFilesHelper(args, bee, node!);
}

const downloadFilesHelper = async (
  args: DownloadFilesArgs,
  bee: Bee,
  node: MantarayNode
) => {
  const destinationFolder = path.resolve(args.filePath ?? process.cwd());

  if (!fs.existsSync(destinationFolder)) {
    await mkdir(destinationFolder, { recursive: true });
  }

  const nodes = node!.collect();

  if (nodes.length === 1) {
    const single = nodes[0];
    const data = await bee.downloadData(single.targetAddress);
    await writeFile(
      path.join(destinationFolder, path.basename(single.fullPathString)),
      data.toUint8Array()
    );
  } else {
    for (const child of nodes) {
      const parsedPath = path.parse(child.fullPathString);
      const nodeDestFolder = path.join(destinationFolder, parsedPath.dir);
      if (!fs.existsSync(nodeDestFolder)) {
        await mkdir(nodeDestFolder, { recursive: true });
      }

      const data = await bee.downloadData(child.targetAddress);
      await writeFile(
        path.join(destinationFolder, child.fullPathString),
        data.toUint8Array()
      );
    }
  }

  return getResponseWithStructuredContent({
    reference: args.reference,
    manifestNodeCount: nodes.length,
    savedTo: destinationFolder,
    message:
      nodes.length === 1
        ? `File successfully downloaded to ${destinationFolder}`
        : `Manifest content (${nodes.length} files) successfully downloaded to ${destinationFolder}`,
  });
};

async function downloadFilesAct(
  args: DownloadFilesArgs,
  bee: Bee
): Promise<ToolResponse> {
  let reference: string;
  let actPublisher: string;
  let actHistoryAddress: string;
  try {
    reference = normalizeReferenceHex(args.reference);
    actPublisher = normalizePublicKeyHex(args.actPublisher!);
    actHistoryAddress = normalizeReferenceHex(args.actHistoryAddress!);
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
      : "Unable to unmarshal manifest — the reference may not be a manifest. Try download_data for a single object.";
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
      "ACT-protected manifest. Provide a filePath to download all files, or call download_data for individual chunks.",
  });
}
