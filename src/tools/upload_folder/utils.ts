import { Bee } from "@ethersphere/bee-js";
import {
  ExtendedTask,
  TaskState,
  UpdateStatusFunction,
} from "../../tasks/models";
import { getResponseWithStructuredContent } from "../../utils";
import { TaskManager } from "../../tasks/task-manager";
import { UploadDeferredResult } from "../../models";

export const updateUploadFolderTaskStatus: UpdateStatusFunction = async (
  extendedTask: ExtendedTask,
  bee: Bee,
  taskManager: TaskManager
): Promise<void> => {
  try {
    if (!extendedTask?._meta?.tagId) {
      return;
    }

    const tagUid = Number(extendedTask._meta.tagId);
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

    if (isComplete && extendedTask?.result?.structuredContent) {
      const uploadDeferredResult = extendedTask.result
        .structuredContent as UploadDeferredResult;

      taskManager.setTaskResult(
        extendedTask.task.taskId,
        getResponseWithStructuredContent({
          reference: uploadDeferredResult.reference,
          message: "Folder upload completed successfully.",
        })
      );

      // Clean up tag (fire and forget)
      bee.deleteTag(tagUid).catch((error) => {
        console.error(`Failed to delete tag ${tagUid}:`, error);
      });
    } else {
      const reference = extendedTask?._meta?.reference;
      await taskManager.updateTaskStatus(
        extendedTask.task.taskId,
        TaskState.WORKING,
        `
        Processing: ${processedPercentage}% (${processed}/${total} chunks)${reference ? ` for reference ${reference}` : ""}.
        You can also use query_upload_progress for tag id ${tagUid} to track progress.
        `
      );
    }
  } catch (error) {
    await taskManager.updateTaskStatus(
      extendedTask.task.taskId,
      TaskState.FAILED,
      `Failed to update task ${extendedTask.task.taskId} status.`
    );
  }
};
