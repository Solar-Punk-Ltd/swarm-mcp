import { Bee } from "@ethersphere/bee-js";
import { ExtendedTask, TaskState } from "../../tasks/models";
import { getResponseWithStructuredContent } from "../../utils";
import { UploadDeferredResult } from "../upload_file/models";

export const updateUploadFolderTaskStatus = async (
  extendedTask: ExtendedTask,
  bee: Bee
): Promise<void> => {
  try {
    if (!extendedTask.result) return;
    const uploadDeferredResult = extendedTask.result as UploadDeferredResult;
    const tagUid = Number(uploadDeferredResult.tagId);
    const tag = await bee.retrieveTag(tagUid);

    const synced = tag.synced ?? 0;
    const seen = tag.seen ?? 0;
    const processed = synced + seen;
    const total = tag.split ?? 0;

    const processedPercentage =
      total > 0 ? Math.round((processed / total) * 100) : 0;
    const isComplete = processedPercentage === 100;

    const now = new Date().toISOString();
    extendedTask.task.lastUpdatedAt = now;

    if (isComplete) {
      extendedTask.task.status = TaskState.COMPLETED;
      extendedTask.task.statusMessage = "Folder upload completed successfully.";
      extendedTask.result = getResponseWithStructuredContent({
        processedPercentage,
        message: isComplete
          ? "Folder upload completed successfully."
          : `Folder upload progress: ${processedPercentage}% processed`,
        startedAt: tag.startedAt,
        tagAddress: tag.address,
      });

      // Clean up tag (fire and forget)
      bee.deleteTag(tagUid).catch((error) => {
        console.error(`Failed to delete tag ${tagUid}:`, error);
      });
    } else {
      extendedTask.task.status = TaskState.WORKING;
      extendedTask.task.statusMessage = `Processing: ${processedPercentage}% (${processed}/${total} chunks)`;
    }
  } catch (error) {
    console.error(
      `Failed to update task ${extendedTask.task.taskId} status:`,
      error
    );
    extendedTask.task.status = TaskState.FAILED;
    extendedTask.task.statusMessage =
      "Failed to retrieve folder upload status from Swarm";
    extendedTask.task.lastUpdatedAt = new Date().toISOString();
  }
};
