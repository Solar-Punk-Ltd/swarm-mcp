import {
  PostageBatchCuratedSchema,
  PostageBatchSummarySchema,
} from "./postage-batch";

export const SwarmToolsSchema = [
  {
    name: "upload_data",
    title: "Upload data",
    description:
      "Upload text data to Swarm. Optional options (ignore if they are not requested): " +
      "redundancyLevel: redundancy level for fault tolerance. Optional, value is 0 if not requested. " +
      "postageBatchId: The postage stamp batch ID which will be used to perform the upload, if it is provided.",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "string",
          description: "arbitrary string to upload",
        },
        redundancyLevel: {
          type: "number",
          description:
            "redundancy level for fault tolerance " +
            "(higher values provide better fault tolerance but increase storage overhead) " +
            "0 - none, 1 - medium, 2 - strong, 3 - insane, 4 - paranoid",
          default: 0,
        },
        postageBatchId: {
          type: "string",
          description:
            "The id of the batch which will be used to perform the upload.",
          default: undefined,
        },
      },
      required: ["data"],
    },
    outputSchema: {
      type: "object",
      properties: {
        reference: {
          type: "string",
          description: "Swarm reference hash for uploaded data.",
        },
        url: {
          type: "string",
          description: "URL to access uploaded data.",
        },
        message: {
          type: "string",
          description: "Upload response message.",
        },
      },
      required: ["reference", "url"],
    },
    execution: {
      taskSupport: "forbidden",
    },
  },
  {
    name: "update_feed",
    description:
      "Update the feed of a given topic with new data. Optional options (ignore if they are not requested): " +
      "postageBatchId: The postage stamp batch ID which will be used to perform the upload, if it is provided.",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "string",
          description: "arbitrary string to upload",
        },
        memoryTopic: {
          type: "string",
          description:
            "If provided, uploads the data to a feed with this topic. " +
            "It is the label of the memory that can be used later to retrieve the data instead of its content hash. " +
            "If not a hex string, it will be hashed to create a feed topic",
        },
        postageBatchId: {
          type: "string",
          description:
            "The id of the batch which will be used to perform the upload.",
          default: undefined,
        },
      },
      required: ["data", "memoryTopic"],
    },
    outputSchema: {
      type: "object",
      properties: {
        reference: {
          type: "string",
          description: "Swarm reference hash for feed update.",
        },
        topicString: {
          type: "string",
          description: "The topic string.",
        },
        topic: {
          type: "string",
          description: "The topic.",
        },
        feedUrl: {
          type: "string",
          description: "The feed URL.",
        },
        message: {
          type: "string",
          description: "Update feed response message.",
        },
      },
      required: ["reference", "topic", "feedUrl"],
    },
    execution: {
      taskSupport: "forbidden",
    },
  },
  {
    name: "download_data",
    description: "Downloads immutable data from a Swarm content address hash.",
    inputSchema: {
      type: "object",
      properties: {
        reference: {
          type: "string",
          description: "Swarm reference hash.",
        },
      },
      required: ["reference"],
    },
    outputSchema: {
      type: "object",
      properties: {
        textData: {
          type: "string",
          description: "The downloaded data for the given reference.",
        },
      },
      required: ["textData"],
    },
    execution: {
      taskSupport: "forbidden",
    },
  },
  {
    name: "read_feed",
    description: "Retrieve the latest data from the feed of a given topic.",
    inputSchema: {
      type: "object",
      properties: {
        memoryTopic: {
          type: "string",
          description: "Feed topic.",
        },
        owner: {
          type: "string",
          description:
            "when accessing external memory or feed, ethereum address of the owner must be set",
        },
      },
      required: ["memoryTopic"],
    },
    outputSchema: {
      type: "object",
      properties: {
        textData: {
          type: "string",
          description: "The downloaded data for the given topic.",
        },
      },
      required: ["textData"],
    },
    execution: {
      taskSupport: "forbidden",
    },
  },
  {
    name: "upload_file",
    description:
      "Upload a file to Swarm. Optional options (ignore if they are not requested): " +
      "isPath: whether the data parameter is a path. " +
      "redundancyLevel: redundancy level for fault tolerance. Optional, value is 0 if not requested. " +
      "postageBatchId: The postage stamp batch ID which will be used to perform the upload, if it is provided.",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "string",
          description: "base64 encoded file content or file path",
        },
        isPath: {
          type: "boolean",
          description: "whether the data parameter is a file path",
          default: false,
        },
        redundancyLevel: {
          type: "number",
          description:
            "redundancy level for fault tolerance " +
            "(higher values provide better fault tolerance but increase storage overhead) " +
            "0 - none, 1 - medium, 2 - strong, 3 - insane, 4 - paranoid",
          default: 0,
        },
        postageBatchId: {
          type: "string",
          description:
            "The id of the batch which will be used to perform the upload.",
          default: undefined,
        },
      },
      required: ["data"],
    },
    outputSchema: {
      type: "object",
      properties: {
        reference: {
          type: "string",
          description: "The Swarm reference hash of the uploaded file.",
        },
        url: {
          type: "string",
          description: "Direct access URL to the uploaded file on Swarm.",
        },
        message: {
          type: "string",
          description: "Status message about the upload result.",
        },
        tagId: {
          type: "string",
          description:
            "Tag ID for deferred uploads (null/undefined if not deferred).",
          nullable: true,
        },
      },
      required: ["reference", "url", "message"],
      additionalProperties: false,
    },
    execution: {
      taskSupport: "optional",
    },
  },
  {
    name: "upload_folder",
    description:
      "Upload a folder to Swarm. Optional options (ignore if they are not requested): " +
      "folderPath: path to the folder to upload. " +
      "redundancyLevel: redundancy level for fault tolerance. Optional, value is 0 if not requested. " +
      "postageBatchId: The postage stamp batch ID which will be used to perform the upload, if it is provided.",
    inputSchema: {
      type: "object",
      properties: {
        folderPath: {
          type: "string",
          description: "path to the folder to upload",
        },
        redundancyLevel: {
          type: "number",
          description:
            "redundancy level for fault tolerance " +
            "(higher values provide better fault tolerance but increase storage overhead) " +
            "0 - none, 1 - medium, 2 - strong, 3 - insane, 4 - paranoid",
          default: 0,
        },
        postageBatchId: {
          type: "string",
          description:
            "The id of the batch which will be used to perform the upload.",
          default: undefined,
        },
      },
      required: ["folderPath"],
    },
    outputSchema: {
      type: "object",
      properties: {
        reference: {
          type: "string",
          description: "The Swarm reference hash of the uploaded folder.",
        },
        message: {
          type: "string",
          description: "Status message about the folder upload result.",
        },
        tagId: {
          type: "string",
          description:
            "Tag ID for deferred uploads (null/undefined if not deferred).",
          nullable: true,
        },
      },
      required: ["reference", "message"],
      additionalProperties: false,
    },
    execution: {
      taskSupport: "optional",
    },
  },
  {
    name: "download_files",
    description:
      "Download folder, files from a Swarm reference and save to file path or return file list of the reference " +
      "prioritizes this tool over download_data if there is no assumption about the data type",
    inputSchema: {
      type: "object",
      properties: {
        reference: {
          type: "string",
          description: "Swarm reference hash",
        },
        filePath: {
          type: "string",
          description:
            "Optional file path to save the downloaded content (only available in stdio mode). " +
            "if not provided list of files in the manifest will be returned",
        },
      },
      required: ["reference"],
    },
    outputSchema: {
      oneOf: [
        {
          type: "object",
          properties: {
            reference: {
              type: "string",
              description: "Original Swarm reference hash.",
            },
            manifestNodeCount: {
              type: "integer",
              description: "Number of files in the manifest.",
            },
            savedTo: {
              type: "string",
              description: "Local folder path where files were saved.",
            },
            message: {
              type: "string",
              description: "Confirmation of successful download.",
            },
          },
          required: ["reference", "manifestNodeCount", "savedTo", "message"],
          additionalProperties: false,
          description: "Response when files are saved to filePath",
        },
        {
          type: "object",
          properties: {
            reference: {
              type: "string",
              description: "Original Swarm reference hash.",
            },
            type: {
              type: "string",
              const: "manifest",
              description: "Indicates this is a manifest listing.",
            },
            files: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  path: {
                    type: "string",
                    description: "File path within the manifest.",
                  },
                  targetAddress: {
                    type: "string",
                    description: "Hex address of the file content.",
                  },
                  metadata: {
                    type: "object",
                    description: "File metadata (optional).",
                    additionalProperties: true,
                  },
                },
                required: ["path", "targetAddress"],
                additionalProperties: false,
              },
              description: "List of files in the manifest.",
            },
            message: {
              type: "string",
              description: "Instructions for downloading individual files.",
            },
          },
          required: ["reference", "type", "files", "message"],
          additionalProperties: false,
          description: "Response when no filePath provided (file list)",
        },
      ],
    },
    execution: {
      taskSupport: "optional",
    },
  },
  {
    name: "list_postage_stamps",
    description:
      "List the available postage stamps. Optional options (ignore if they are not requested): leastUsed, limit, minUsage(%), maxUsage(%).",
    inputSchema: {
      type: "object",
      properties: {
        leastUsed: {
          type: "boolean",
          description:
            "A boolean value that tells if stamps are sorted so least used comes first. " +
            "true - means that stamps should be sorted " +
            "false - means that stamps should not be sorted",
          default: false,
        },
        limit: {
          type: "number",
          description: "Limit is the maximum number of returned stamps.",
        },
        minUsage: {
          type: "number",
          description: "Only list stamps with at least this usage percentage",
        },
        maxUsage: {
          type: "number",
          description: "Only list stamps with at most this usage percentage.",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        raw: {
          type: "array",
          raw: PostageBatchCuratedSchema,
        },
        summary: {
          type: "array",
          summary: PostageBatchSummarySchema,
        },
      },
      required: ["summary"],
    },
    execution: {
      taskSupport: "forbidden",
    },
  },
  {
    name: "get_postage_stamp",
    description: "Get a specific postage stamp based on postageBatchId.",
    inputSchema: {
      type: "object",
      properties: {
        postageBatchId: {
          type: "string",
          description: "The id of the stamp which is requested.",
        },
      },
      required: ["postageBatchId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        raw: PostageBatchCuratedSchema,
        summary: PostageBatchSummarySchema,
      },
      required: ["summary"],
    },
    execution: {
      taskSupport: "forbidden",
    },
  },
  {
    name: "create_postage_stamp",
    description: "Buy postage stamp based on size in megabytes and duration.",
    inputSchema: {
      type: "object",
      properties: {
        size: {
          type: "number",
          description:
            "The storage size in MB (Megabytes). " +
            "These other size units convert like this to MB: 1 byte = 0.000001 MB, 1  KB = 0.001 MB, 1GB= 1000MB",
        },
        duration: {
          type: "string",
          description:
            "Duration for which the data should be stored. " +
            "Time to live of the postage stamp, e.g. 1d - 1 day, 1w - 1 week, 1month - 1 month ",
        },
        label: {
          type: "string",
          description:
            "Sets label for the postage batch (omit if the user didn't ask for one). Do not set a label with with specific capacity values because they can get misleading.",
        },
      },
      required: ["size", "duration"],
    },
    outputSchema: {
      type: "object",
      properties: {
        postageBatchId: {
          type: "string",
          description: "Hex string of the newly created postage batch ID.",
          nullable: true,
        },
        message: {
          type: "string",
          description: "Status message.",
        },
      },
      required: ["message"],
      additionalProperties: false,
    },
    execution: {
      taskSupport: "optional",
    },
  },
  {
    name: "extend_postage_stamp",
    description:
      "Increase the duration (relative to current duration) or size (in megabytes) of a postage stamp.",
    inputSchema: {
      type: "object",
      properties: {
        postageBatchId: {
          type: "string",
          description: "The id of the batch for which extend is performed.",
        },
        size: {
          type: "number",
          description:
            "The storage size in MB (Megabytes). " +
            "These other size units convert like this to MB: 1 byte = 0.000001 MB, 1  KB = 0.001 MB, 1GB= 1000MB",
        },
        duration: {
          type: "string",
          description:
            "Duration for which the data should be stored. " +
            "Time to live of the postage stamp, e.g. 1d - 1 day, 1w - 1 week, 1month - 1 month ",
        },
      },
      required: ["postageBatchId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        postageBatchId: {
          type: "string",
          description: "The extended postage batch ID (hex string).",
        },
        message: {
          type: "string",
          description: "Status message indicating success or details.",
        },
      },
      required: ["postageBatchId", "message"],
      additionalProperties: false,
    },
    execution: {
      taskSupport: "optional",
    },
  },
  {
    name: "query_upload_progress",
    description:
      "Query upload progress for a specific upload session identified with the returned Tag ID",
    inputSchema: {
      type: "object",
      properties: {
        tagId: {
          type: "string",
          description:
            "Tag ID returned by upload_file and upload_folder tools to track upload progress",
        },
      },
      required: ["tagId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        processedPercentage: {
          type: "number",
          description: "The deferred upload processed percentage.",
        },
        message: {
          type: "string",
          description: "Query upload response message.",
        },
        startedAt: {
          type: "string",
          description: "When it started.",
        },
        tagAddress: {
          type: "string",
          description: "The address of the tag.",
        },
      },
      required: ["processedPercentage", "tagAddress"],
    },
    execution: {
      taskSupport: "forbidden",
    },
  },
];
