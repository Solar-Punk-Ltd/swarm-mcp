import { z } from "zod";

export const uploadDataSchema = z.object({
  data: z.string().min(1, { message: "Missing required parameter: data." }),
  redundancyLevel: z.number().optional().default(0),
  postageBatchId: z.string().optional(),
});

export const updateFeedSchema = z.object({
  data: z.string().min(1, { message: "Missing required parameter: data." }),
  memoryTopic: z
    .string()
    .min(1, { message: "Missing required parameter: topic." }),
  postageBatchId: z.string().optional(),
});

export const downloadDataSchema = z.object({
  reference: z
    .string()
    .min(1, { message: "Missing required parameter: reference." }),
});

export const readFeedSchema = z.object({
  memoryTopic: z
    .string()
    .min(1, { message: "Missing required parameter: memoryTopic." }),
  owner: z.string().optional(),
});

export const uploadFileSchema = z.object({
  data: z.string().min(1, { message: "Missing required parameter: data." }),
  isPath: z.boolean().optional(),
  redundancyLevel: z.number().optional(),
  postageBatchId: z.string().optional(),
});

export const uploadFolderSchema = z.object({
  folderPath: z
    .string()
    .min(1, { message: "Missing required parameter: data." }),
  redundancyLevel: z.number().optional(),
  postageBatchId: z.string().optional(),
});

export const downloadFilesSchema = z.object({
  reference: z
    .string()
    .min(1, { message: "Missing required parameter: reference." }),
  filePath: z.string().optional(),
});

export const listPostageStampsSchema = z.object({
  leastUsed: z.boolean().optional().default(false),
  limit: z.number().optional(),
  minUsage: z.number().optional(),
  maxUsage: z.number().optional(),
});

export const getPostageStampSchema = z.object({
  postageBatchId: z
    .string()
    .min(1, { message: "Missing required parameter: postageBatchId." }),
});

export const createPostageStampSchema = z.object({
  size: z.number({
    required_error: "Missing required parameter: size.",
  }),
  duration: z
    .string()
    .min(1, { message: "Missing required parameter: duration." }),
  label: z.string().optional(),
});

export const extendPostageStampSchema = z.object({
  postageBatchId: z
    .string()
    .min(1, { message: "Missing required parameter: postageBatchId." }),
  size: z.number().optional(),
  duration: z.string().optional(),
});

export const queryUploadProgressSchema = z.object({
  tagId: z
    .string()
    .regex(/^\d+$/, "Tag ID must be a numeric string representing an integer"),
});
