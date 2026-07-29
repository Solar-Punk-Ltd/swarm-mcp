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

  // Bypass bee-js's MantarayNode#loadRecursively — it overrides the outer
  // actHistoryAddress with the per-fork `swarm-act-history-address` metadata baked in at
  // upload time. After a patchGrantees the caller holds a fresh history that lists it as
  // a grantee, but the per-fork metadata still references the pre-purchase history that
  // does not, so nested chunk fetches 404. Bee's server-side /bzz/<ref>/<path> handler
  // applies the outer ACT headers uniformly, which is what post-grant readers need.
  //
  // Enumerate top-level paths from the manifest chunk (single /bytes/ fetch, decrypts
  // under the granted history), then let Bee resolve each file via /bzz/.
  let topLevelPaths: string[] = [];
  try {
    const node = await MantarayNode.unmarshal(bee, reference, actOptions);
    topLevelPaths = node
      .collect()
      .map((n) => n.fullPathString)
      .filter((p) => p && p !== "/");
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

  const destinationFolder = args.filePath ?? process.cwd();
  if (!fs.existsSync(destinationFolder)) {
    await mkdir(destinationFolder, { recursive: true });
  }

  const savedFiles: { path: string; size: number }[] = [];

  const downloadOne = async (relPath: string): Promise<void> => {
    // GET /bzz/<ref>/<path> with the outer ACT headers. Bee walks the manifest
    // server-side using the granted history — no per-fork override.
    const file = await bee.downloadFile(reference, relPath, actOptions);
    const bytes = file.data.toUint8Array();
    const name =
      (file.name && file.name.trim()) ||
      (relPath ? path.basename(relPath) : "download.bin");
    const outSubdir = relPath ? path.dirname(relPath) : "";
    const targetDir =
      outSubdir && outSubdir !== "."
        ? path.join(destinationFolder, outSubdir)
        : destinationFolder;
    if (targetDir !== destinationFolder && !fs.existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true });
    }
    const outPath = path.join(targetDir, name);
    await writeFile(outPath, bytes);
    savedFiles.push({
      path: path.relative(destinationFolder, outPath),
      size: bytes.length,
    });
  };

  try {
    if (topLevelPaths.length === 0) {
      // Single-file manifest (upload_file) — /bzz/<ref>/ resolves to the file itself.
      await downloadOne("");
    } else {
      for (const p of topLevelPaths) {
        await downloadOne(p);
      }
    }
  } catch (err) {
    if (errorHasStatus(err, NOT_FOUND_STATUS)) {
      return getToolErrorResponse(
        "Manifest content not found, or this node is not a grantee for the given history."
      );
    }
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to download ACT-protected files.";
    return getToolErrorResponse(msg);
  }

  return getResponseWithStructuredContent({
    reference,
    manifestNodeCount: savedFiles.length,
    savedTo: destinationFolder,
    files: savedFiles,
    message: `ACT manifest content (${savedFiles.length} file${
      savedFiles.length === 1 ? "" : "s"
    }) saved to ${destinationFolder}`,
  });
}
