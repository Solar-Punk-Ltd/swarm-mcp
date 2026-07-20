import { z } from "zod";

export const uploadDataSchema = z.object({
  data: z.string().min(1, { message: "Missing required parameter: data." }),
  act: z
    .preprocess((value) => {
      if (typeof value === "string") {
        return value.trim().toLowerCase() === "true";
      }
      return value;
    }, z.boolean())
    .optional(),
  grantees: z.array(z.string()).optional(),
  historyAddress: z.string().optional(),
  redundancyLevel: z.coerce.number().optional().default(0),
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
  actPublisher: z.string().optional(),
  actHistoryAddress: z.string().optional(),
  actTimestamp: z.coerce.number().optional(),
});

export const readFeedSchema = z.object({
  memoryTopic: z
    .string()
    .min(1, { message: "Missing required parameter: memoryTopic." }),
  owner: z.string().optional(),
});

export const uploadFileSchema = z.object({
  data: z.string().min(1, { message: "Missing required parameter: data." }),
  act: z
    .preprocess((value) => {
      if (typeof value === "string") {
        return value.trim().toLowerCase() === "true";
      }
      return value;
    }, z.boolean())
    .optional(),
  grantees: z.array(z.string()).optional(),
  historyAddress: z.string().optional(),
  redundancyLevel: z.coerce.number().optional().default(0),
  postageBatchId: z.string().optional(),
});

export const uploadFolderSchema = z.object({
  folderPath: z
    .string()
    .min(1, { message: "Missing required parameter: data." }),
  act: z
    .preprocess((value) => {
      if (typeof value === "string") {
        return value.trim().toLowerCase() === "true";
      }
      return value;
    }, z.boolean())
    .optional(),
  grantees: z.array(z.string()).optional(),
  historyAddress: z.string().optional(),
  redundancyLevel: z.coerce.number().optional().default(0),
  postageBatchId: z.string().optional(),
});

export const downloadFilesSchema = z.object({
  reference: z
    .string()
    .min(1, { message: "Missing required parameter: reference." }),
  filePath: z.string().optional(),
  actPublisher: z.string().optional(),
  actHistoryAddress: z.string().optional(),
  actTimestamp: z.coerce.number().optional(),
});

export const listPostageStampsSchema = z.object({
  leastUsed: z
    .preprocess((value) => {
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") {
          return true;
        } else {
          return false;
        }
      }

      return value;
    }, z.boolean())
    .optional()
    .default(false),
  limit: z.coerce.number().optional(),
  minUsage: z.coerce.number().optional(),
  maxUsage: z.coerce.number().optional(),
});

export const getPostageStampSchema = z.object({
  postageBatchId: z
    .string()
    .min(1, { message: "Missing required parameter: postageBatchId." }),
});

export const createPostageStampSchema = z.object({
  size: z.string().min(1, { message: "Missing required parameter: size." }),
  duration: z
    .string()
    .min(1, { message: "Missing required parameter: duration." }),
  label: z.string().optional(),
});

export const extendPostageStampSchema = z.object({
  postageBatchId: z
    .string()
    .min(1, { message: "Missing required parameter: postageBatchId." }),
  size: z.string().optional(),
  duration: z.string().optional(),
});

export const queryUploadProgressSchema = z.object({
  tagId: z
    .string()
    .regex(/^\d+$/, "Tag ID must be a numeric string representing an integer"),
});

const pubKeyHexSchema = z.string().min(66, {
  message: "public key must be a hex string of 66 (compressed) or 128 chars",
});

const refHexSchema = z.string().min(64, {
  message: "reference must be a hex string of 64 or 128 chars",
});

export const getNodePublicKeySchema = z.object({});

export const getWalletAddressSchema = z.object({});

export const getWalletBalanceSchema = z.object({});

export const estimateStampCostSchema = z.object({
  size: z.string().min(1, { message: "Missing required parameter: size." }),
  duration: z
    .string()
    .min(1, { message: "Missing required parameter: duration." }),
  depth: z.coerce.number().int().positive().optional(),
});

export const createGranteesSchema = z.object({
  grantees: z.array(pubKeyHexSchema).min(1, {
    message: "grantees must be a non-empty array of public keys",
  }),
  postageBatchId: z.string().optional(),
});

export const listGranteesSchema = z.object({
  reference: refHexSchema,
});

export const patchGranteesSchema = z.object({
  reference: refHexSchema,
  historyAddress: refHexSchema,
  add: z.array(pubKeyHexSchema).optional(),
  revoke: z.array(pubKeyHexSchema).optional(),
  postageBatchId: z.string().optional(),
});

export const publishToFeedWithActSchema = z.object({
  feedTopic: z
    .string()
    .min(1, { message: "Missing required parameter: feedTopic." }),
  data: z.string().optional(),
  filePath: z.string().optional(),
  isPath: z
    .preprocess((value) => {
      if (typeof value === "string") {
        return value.trim().toLowerCase() === "true";
      }
      return value;
    }, z.boolean())
    .optional()
    .default(false),
  grantees: z.array(pubKeyHexSchema).optional(),
  redundancyLevel: z.coerce.number().optional().default(0),
  postageBatchId: z.string().optional(),
  customPayload: z.union([z.string(), z.record(z.unknown())]).optional(),
});

export const patchFeedAccessSchema = z.object({
  feedTopic: z
    .string()
    .min(1, { message: "Missing required parameter: feedTopic." }),
  granteePubKey: pubKeyHexSchema,
  mode: z.enum(["add", "revoke"], {
    errorMap: () => ({ message: "mode must be either 'add' or 'revoke'." }),
  }),
  postageBatchId: z.string().optional(),
});

export const fetchFromFeedWithActSchema = z.object({
  feedTopic: z
    .string()
    .min(1, { message: "Missing required parameter: feedTopic." }),
  publisherPubKey: pubKeyHexSchema,
  feedOwner: z.string().optional(),
  filePath: z.string().optional(),
  actTimestamp: z.coerce.number().optional(),
});

export const gsocSendSchema = z.object({
  message: z
    .string()
    .min(1, { message: "Missing required parameter: message." }),
  resourceId: z
    .string()
    .min(1, { message: "Missing required parameter: resourceId." }),
  topic: z.string().min(1, { message: "Missing required parameter: topic." }),
  encoding: z.enum(["utf8", "base64", "hex"]).optional().default("utf8"),
  postageBatchId: z.string().optional(),
});
