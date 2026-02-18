import { z } from "zod";

export const uploadDataSchema = z.object({
  data: z.string(),
  redundancyLevel: z.number().optional().default(0),
  postageBatchId: z.string().optional(),
});

export const updateFeedSchema = z.object({
  data: z.string(),
  memoryTopic: z.string(),
  postageBatchId: z.string().optional(),
});

export const downloadDataSchema = z.object({
  reference: z.string(),
});

export const readFeedSchema = z.object({
  memoryTopic: z.string(),
  owner: z.string().optional(),
});

export const uploadFileSchema = z.object({
  data: z.string(),
  isPath: z.boolean().optional(),
  redundancyLevel: z.number().optional(),
  postageBatchId: z.string().optional(),
});

export const uploadFolderSchema = z.object({
  folderPath: z.string(),
  redundancyLevel: z.number().optional(),
  postageBatchId: z.string().optional(),
});

export const downloadFilesSchema = z.object({
  reference: z.string(),
  filePath: z.string().optional(),
});

export const listPostageStampsSchema = z.object({
  leastUsed: z.boolean().optional().default(false),
  limit: z.number().optional(),
  minUsage: z.number().optional(),
  maxUsage: z.number().optional(),
});

export const getPostageStampSchema = z.object({
  postageBatchId: z.string(),
});

export const createPostageStampSchema = z.object({
  size: z.number(),
  duration: z.string(),
  label: z.string().optional(),
});

export const extendPostageStampSchema = z.object({
  postageBatchId: z.string(),
  size: z.number().optional(),
  duration: z.string().optional(),
});

export const queryUploadProgressSchema = z.object({
  tagId: z
    .string()
    .regex(/^\d+$/, "Tag ID must be a numeric string representing an integer"),
});
