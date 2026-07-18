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
          description: "Arbitrary string to upload.",
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
    title: "Update feed",
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
            "Required. Must be supplied by the user. If missing, ask the user — never invent, hash, or derive from the data. " +
            "The feed topic. Pass exactly whatever the user names it as a plain string (e.g. 'notes', 'Topic1', 'game-state') -- the server hashes non-hex strings into a topic automatically. Do NOT derive it from the data. Only ask the user if they gave no topic at all.",
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
    title: "Download data",
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
    title: "Read feed",
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
    title: "Upload file",
    description:
      "Upload a file to Swarm. Optional options (ignore if they are not requested): " +
      "redundancyLevel: redundancy level for fault tolerance. Optional, value is 0 if not requested. " +
      "postageBatchId: The postage stamp batch ID which will be used to perform the upload, if it is provided.",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "string",
          description: "File content or file path.",
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
    execution: {
      taskSupport: "optional",
    },
  },
  {
    name: "upload_folder",
    title: "Upload folder",
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
    execution: {
      taskSupport: "optional",
    },
  },
  {
    name: "download_files",
    title: "Download files",
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
            "Optional destination FOLDER (not a filename) to save the downloaded content into (only available in stdio mode). " +
            "Files from the manifest are written inside this folder using their original names. " +
            "Absolute paths are recommended; relative paths resolve against the server's current working directory. " +
            "If omitted, files are saved into the server's current working directory.",
        },
      },
      required: ["reference"],
    },
    execution: {
      taskSupport: "optional",
    },
  },
  {
    name: "list_postage_stamps",
    title: "List postage stamps",
    description:
      "List the available postage stamps. Optional options (ignore if they are not requested): leastUsed, limit, minUsage(%), maxUsage(%).",
    inputSchema: {
      type: "object",
      properties: {
        leastUsed: {
          type: "boolean",
          description:
            "A boolean value that tells if stamps are sorted so least used comes first. " +
            "true - means that stamps should be sorted. " +
            "false - means that stamps should not be sorted. " +
            "Default is false.",
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
          items: PostageBatchCuratedSchema,
        },
        summary: {
          type: "array",
          items: PostageBatchSummarySchema,
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
    title: "Get postage stamp",
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
    title: "Create postage stamp",
    description: "Buy postage stamp based on size in megabytes and duration.",
    inputSchema: {
      type: "object",
      properties: {
        size: {
          type: "string",
          description: "Storage capacity, e.g. 1GB, 1MB, 1KB.",
        },
        duration: {
          type: "string",
          description:
            "Duration for which the data should be stored. " +
            "Time to live of the postage stamp, e.g. 1d - 1 day, 1w - 1 week, 1month - 1 month ",
        },
        label: {
          type: "string",
          maxLength: 100,
          description:
            "Sets label for the postage batch (omit if the user didn't ask for one). Do not set a label with with specific capacity values because they can get misleading.",
        },
      },
      required: ["size", "duration"],
    },
    execution: {
      taskSupport: "optional",
    },
  },
  {
    name: "extend_postage_stamp",
    title: "Extend postage stamp",
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
          type: "string",
          description: "Storage capacity, e.g. 1GB, 1MB, 1KB.",
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
    execution: {
      taskSupport: "optional",
    },
  },
  {
    name: "query_upload_progress",
    title: "Query upload progress",
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
