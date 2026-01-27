import { Bee } from "@ethersphere/bee-js";
import { ExtendedTask, TaskState } from "../../tasks/models";
import { getResponseWithStructuredContent } from "../../utils";

export const updateUploadFolderTaskStatus = async (
  task: ExtendedTask,
  bee: Bee
): Promise<void> => {
  try {
    if (!task.meta?.id) return;
    const tagUid = task.meta.id as number;
    const tag = await bee.retrieveTag(tagUid);

    const synced = tag.synced ?? 0;
    const seen = tag.seen ?? 0;
    const processed = synced + seen;
    const total = tag.split ?? 0;

    const processedPercentage =
      total > 0 ? Math.round((processed / total) * 100) : 0;
    const isComplete = processedPercentage === 100;

    const now = new Date().toISOString();
    task.lastUpdatedAt = now;

    if (isComplete) {
      task.status = TaskState.COMPLETED;
      task.statusMessage = "Folder upload completed successfully.";
      task.result = getResponseWithStructuredContent({
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
      task.status = TaskState.WORKING;
      task.statusMessage = `Processing: ${processedPercentage}% (${processed}/${total} chunks)`;
    }
  } catch (error) {
    console.error(`Failed to update task ${task.taskId} status:`, error);
    task.status = TaskState.FAILED;
    task.statusMessage = "Failed to retrieve folder upload status from Swarm";
    task.lastUpdatedAt = new Date().toISOString();
  }
};
