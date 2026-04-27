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
      "isPath: Whether the data parameter is a path. If it is path pass: true, if it is file content: false. Default is false. " +
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
          description:
            "Whether the data parameter is a path. If it is path pass: true, if it is file content: false. Default is false.",
          default: false,
        },
        name: {
          type: "string",
          description: "The file name to associate with the upload.",
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
            "Optional file path to save the downloaded content (only available in stdio mode). " +
            "if not provided list of files in the manifest will be returned",
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
          type: "number",
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
        immutable: {
          type: "boolean",
          description:
            "If true, data uploaded with this stamp cannot be overwritten. Defaults to false.",
          default: false,
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
          type: "number",
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
  {
    name: "open_app",
    description: "Opens the Swarm MCP App UI interface. Use the 'tab' parameter to open a specific section: 'stamps' for managing postage stamps, 'upload' for uploading files to Swarm, 'history' for viewing upload history, 'status' for node network status. When opening the buy-stamp modal, extract any requested size (MB), duration, label, and immutable flag and pass them as prefill values.",
    inputSchema: {
      type: "object",
      properties: {
        tab: {
          type: "string",
          enum: ["stamps", "upload", "history"],
          description: "Which tab to open: 'stamps' for Postage Stamps, 'upload' for Upload File, 'history' for Upload History.",
        },
        stamp: {
          type: "string",
          description: "Stamp label or batch ID to open in the detail modal. Automatically switches to the stamps tab and loads stamps if needed.",
        },
        modal: {
          type: "string",
          enum: ["buy-stamp"],
          description: "Which modal to open: 'buy-stamp' opens the Buy Postage Stamp dialog.",
        },
        size: {
          type: "number",
          description: "Pre-fill the capacity field (in MB) in the Buy Postage Stamp dialog.",
        },
        duration: {
          type: "string",
          description: "Pre-fill the TTL field in the Buy Postage Stamp dialog (e.g. 1d, 1w, 1month).",
        },
        label: {
          type: "string",
          description: "Pre-fill the label field in the Buy Postage Stamp dialog.",
        },
        immutable: {
          type: "boolean",
          description: "Pre-fill the immutable checkbox in the Buy Postage Stamp dialog.",
        },
      },
      required: [],
    },
    outputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Status message.",
        },
      },
      required: ["message"],
    },
    _meta: {
      ui: {
        resourceUri: "content://open-app-ui",
      },
    },
  },
  {
    name: "open_url",
    description: "Opens a URL in the default browser on the server machine.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to open in the browser.",
        },
      },
      required: ["url"],
    },
    outputSchema: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          description: "Whether the URL was successfully opened.",
        },
        message: {
          type: "string",
          description: "Success or error message.",
        },
        url: {
          type: "string",
          description: "The URL that was opened.",
        },
      },
      required: ["success", "message"],
    },
  },
  {
    name: "select_postage_stamp",
    description: "Toggle selection of a postage stamp. Called when user checks/unchecks a stamp in the UI.",
    inputSchema: {
      type: "object",
      properties: {
        label: {
          type: "string",
          description: "The label of the postage stamp to select/deselect.",
        },
        selected: {
          type: "boolean",
          description: "Whether the stamp should be selected (true) or deselected (false).",
        },
      },
      required: ["label", "selected"],
    },
    outputSchema: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          description: "Whether the selection was successful.",
        },
        label: {
          type: "string",
          description: "The label that was selected/deselected.",
        },
        selected: {
          type: "boolean",
          description: "The new selection state.",
        },
        selectedStamps: {
          type: "array",
          items: { type: "string" },
          description: "Array of all currently selected stamp labels.",
        },
      },
      required: ["success", "label", "selected", "selectedStamps"],
    },
  },
  {
    name: "list_selected_stamps",
    description: "Get the list of currently selected postage stamp labels.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    outputSchema: {
      type: "object",
      properties: {
        selectedStamps: {
          type: "array",
          items: { type: "string" },
          description: "Array of all currently selected stamp labels.",
        },
        count: {
          type: "number",
          description: "Number of selected stamps.",
        },
      },
      required: ["selectedStamps", "count"],
    },
  },
  {
    name: "list_upload_history",
    description: "List the upload history of files and data uploaded to Swarm in this session.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    outputSchema: {
      type: "object",
      properties: {
        history: {
          type: "array",
          description: "List of upload history entries, newest first.",
        },
        count: {
          type: "number",
          description: "Total number of uploads in history.",
        },
      },
      required: ["history", "count"],
    },
  },
];
