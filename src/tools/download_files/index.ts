/**
 * MCP Tool: download_files
 * Download folder, files from a Swarm reference
 */
import { Bee, MantarayNode } from "@ethersphere/bee-js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs";
import { promisify } from "util";
import path from "path";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";
import { DownloadFilesArgs } from "./models";
import { TaskManager } from "../../tasks/task-manager";
import { CreateTaskModel, TaskState } from "../../tasks/models";
import { BAD_REQUEST_STATUS } from "../../constants";

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
  if (args.filePath) {
    const destinationFolder = args.filePath;

    if (!fs.existsSync(destinationFolder)) {
      await promisify(fs.mkdir)(destinationFolder, { recursive: true });
    }

    const nodes = node!.collect();

    if (nodes.length === 1) {
      const node = nodes[0];
      const data = await bee.downloadData(node.targetAddress);
      await promisify(fs.writeFile)(
        path.join(
          destinationFolder,
          node.fullPathString.split("\\").slice(-1)[0]
        ),
        data.toUint8Array()
      );
    } else {
      // Download each node
      for (const node of nodes) {
        const parsedPath = path.parse(node.fullPathString);
        const nodeDestFolder = path.join(destinationFolder, parsedPath.dir);
        // Create subdirectories if necessary
        if (!fs.existsSync(nodeDestFolder)) {
          await promisify(fs.mkdir)(nodeDestFolder, { recursive: true });
        }

        const data = await bee.downloadData(node.targetAddress);
        await promisify(fs.writeFile)(
          path.join(destinationFolder, node.fullPathString),
          data.toUint8Array()
        );
      }
    }

    return getResponseWithStructuredContent({
      reference: args.reference,
      manifestNodeCount: nodes.length,
      savedTo: destinationFolder,
      message: `Manifest content (${nodes.length} files) successfully downloaded to ${destinationFolder}`,
    });
  } else {
    // regular file
    const nodes = node!.collect();
    const filesList = nodes.map((node) => ({
      path: node.fullPathString || "/",
      targetAddress: Array.from(node.targetAddress)
        .map((e) => e.toString(16).padStart(2, "0"))
        .join(""),
      metadata: node.metadata,
    }));

    return getResponseWithStructuredContent({
      reference: args.reference,
      type: "manifest",
      files: filesList,
      message:
        "This is a manifest with multiple files. Provide a filePath to download all files or download individual files using their specific references.",
    });
  }
};
