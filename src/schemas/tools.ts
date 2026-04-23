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
    name: "get_node_public_key",
    title: "Get node public key",
    description:
      "Returns the Bee node's ACT publisher public key (hex) and related identity fields (ETH address, overlay). Share this with consumers who need to fetch ACT-protected content you publish.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: {
      type: "object",
      properties: {
        publicKey: { type: "string" },
        publicKeyCompressed: { type: "string" },
        pssPublicKey: { type: "string" },
        ethAddress: { type: "string" },
        overlay: { type: "string" },
      },
      required: ["publicKey", "ethAddress"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "get_wallet_address",
    title: "Get wallet address",
    description:
      "Returns the ETH address of the Bee node's wallet. Use this to tell a user where to send BZZ / xDAI before purchasing a postage stamp.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: {
      type: "object",
      properties: {
        address: { type: "string" },
        chainId: { type: "number" },
        chequebookContractAddress: { type: "string" },
      },
      required: ["address"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "get_wallet_balance",
    title: "Get wallet balance",
    description:
      "Returns BZZ / native-token / chequebook balances of the Bee node's wallet. Use before create_postage_stamp to check funds.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: {
      type: "object",
      properties: {
        walletAddress: { type: "string" },
        chainId: { type: "number" },
        bzzBalance: { type: "string" },
        nativeTokenBalance: { type: "string" },
        chequebookAddress: { type: "string" },
        chequebookTotalBalance: { type: "string" },
        chequebookAvailableBalance: { type: "string" },
      },
      required: ["walletAddress", "bzzBalance", "nativeTokenBalance"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "estimate_stamp_cost",
    title: "Estimate stamp cost",
    description:
      "Given a data size and duration (same format as create_postage_stamp: e.g. '15mb', '90d'), returns a recommended depth (with 20% headroom) and BZZ cost derived from current chain price. Read-only; does not purchase anything.",
    inputSchema: {
      type: "object",
      properties: {
        size: { type: "string", description: "e.g. '15mb', '1gb'" },
        duration: { type: "string", description: "e.g. '30d', '1month'" },
        depth: {
          type: "number",
          description: "Override the automatically-chosen depth.",
        },
      },
      required: ["size", "duration"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "upload_data_act",
    title: "Upload data (ACT)",
    description:
      "Upload text data to Swarm with ACT (Access Control Trie) encryption enabled. Returns { reference, historyAddress }. Pass grantees[] (public keys) to authorize decryption at publish time, or grant later with patch_grantees.",
    inputSchema: {
      type: "object",
      properties: {
        data: { type: "string", description: "Arbitrary string to upload." },
        grantees: {
          type: "array",
          items: { type: "string" },
          description: "Optional public keys authorized to decrypt.",
        },
        historyAddress: {
          type: "string",
          description:
            "Existing ACT history to append to. Omit to create a new history.",
        },
        redundancyLevel: { type: "number", default: 0 },
        postageBatchId: { type: "string" },
      },
      required: ["data"],
    },
    outputSchema: {
      type: "object",
      properties: {
        reference: { type: "string" },
        historyAddress: { type: "string" },
        url: { type: "string" },
        grantees: { type: "array", items: { type: "string" } },
      },
      required: ["reference"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "upload_file_act",
    title: "Upload file (ACT)",
    description:
      "Upload a single file to Swarm with ACT encryption. Same semantics as upload_file but ACT-enabled, plus optional grantees[].",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "string",
          description: "base64 file content or file path.",
        },
        isPath: { type: "boolean", default: false },
        grantees: { type: "array", items: { type: "string" } },
        historyAddress: { type: "string" },
        redundancyLevel: { type: "number", default: 0 },
        postageBatchId: { type: "string" },
      },
      required: ["data"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "upload_folder_act",
    title: "Upload folder (ACT)",
    description:
      "Upload a folder to Swarm with ACT encryption. Same semantics as upload_folder but ACT-enabled, plus optional grantees[].",
    inputSchema: {
      type: "object",
      properties: {
        folderPath: { type: "string" },
        grantees: { type: "array", items: { type: "string" } },
        historyAddress: { type: "string" },
        redundancyLevel: { type: "number", default: 0 },
        postageBatchId: { type: "string" },
      },
      required: ["folderPath"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "download_data_act",
    title: "Download data (ACT)",
    description:
      "Download ACT-protected text content. Requires the publisher's public key and the history address they returned. The local Bee node decrypts using its own identity (must be in the grantee list).",
    inputSchema: {
      type: "object",
      properties: {
        reference: { type: "string" },
        actPublisher: { type: "string" },
        actHistoryAddress: { type: "string" },
        actTimestamp: {
          type: "number",
          description:
            "Optional Unix timestamp to read a past version of the grantee list.",
        },
      },
      required: ["reference", "actPublisher", "actHistoryAddress"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "download_files_act",
    title: "Download files (ACT)",
    description:
      "Download ACT-protected manifests (folders). If filePath is provided, writes files to disk; otherwise returns the manifest listing.",
    inputSchema: {
      type: "object",
      properties: {
        reference: { type: "string" },
        actPublisher: { type: "string" },
        actHistoryAddress: { type: "string" },
        actTimestamp: { type: "number" },
        filePath: { type: "string" },
      },
      required: ["reference", "actPublisher", "actHistoryAddress"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "create_grantees",
    title: "Create grantees list",
    description:
      "Create an initial grantee list from an array of public keys. Returns { reference, historyAddress } usable as actHistoryAddress on subsequent upload_*_act calls.",
    inputSchema: {
      type: "object",
      properties: {
        grantees: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
        },
        postageBatchId: { type: "string" },
      },
      required: ["grantees"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "list_grantees",
    title: "List grantees",
    description:
      "Returns the current grantee public keys for a grantees-list reference.",
    inputSchema: {
      type: "object",
      properties: { reference: { type: "string" } },
      required: ["reference"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "patch_grantees",
    title: "Patch grantees",
    description:
      "Add or revoke grantee public keys on an existing { reference, historyAddress } pair. Returns the new historyAddress. Revocation is forward-only.",
    inputSchema: {
      type: "object",
      properties: {
        reference: { type: "string" },
        historyAddress: { type: "string" },
        add: { type: "array", items: { type: "string" } },
        revoke: { type: "array", items: { type: "string" } },
        postageBatchId: { type: "string" },
      },
      required: ["reference", "historyAddress"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "publish_to_feed_with_act",
    title: "Publish to feed (ACT)",
    description:
      "Opinionated provider flow: upload content with ACT (+ optional grantees) and publish its { r, g, h } JSON to a feed entry identified by a plain-text topic. Accepts either `data` (raw text) or `filePath` (file on disk; stdio mode only). Advanced: pass `customPayload` to write an arbitrary JSON blob to the feed instead of the default { r, g, h } shape -- upload still runs if data/filePath are provided and the ACT refs come back in the response for you to embed.",
    inputSchema: {
      type: "object",
      properties: {
        feedTopic: {
          type: "string",
          description:
            "Plain-text topic label (hashed with SHA-256) or a 64-char hex topic.",
        },
        data: { type: "string" },
        filePath: { type: "string" },
        isPath: { type: "boolean", default: false },
        grantees: {
          type: "array",
          items: { type: "string" },
          description: "Optional public keys to grant at publish time.",
        },
        redundancyLevel: { type: "number", default: 0 },
        postageBatchId: { type: "string" },
        customPayload: {
          description:
            "Advanced escape hatch: JSON object or stringified JSON to write to the feed verbatim, replacing the default { r, g, h } payload. Upload still runs if data/filePath provided; embed the returned swarmHash/historyAddress/granteeListRef in your custom shape if needed.",
        },
      },
      required: ["feedTopic"],
    },
    outputSchema: {
      type: "object",
      properties: {
        feedTopic: { type: "string" },
        feedTopicHex: { type: "string" },
        feedOwner: { type: "string" },
        feedUrl: { type: "string" },
        feedReference: { type: "string" },
        reference: { type: "string" },
        historyAddress: { type: "string" },
        grantees: { type: "array", items: { type: "string" } },
      },
      required: [
        "feedTopic",
        "feedOwner",
        "feedReference",
        "reference",
        "historyAddress",
      ],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "grant_feed_access",
    title: "Grant feed access",
    description:
      "Add a grantee public key to the latest feed entry's grantee list and advance the feed. Consumer can then decrypt via fetch_from_feed_with_act without re-discovering the publisher.",
    inputSchema: {
      type: "object",
      properties: {
        feedTopic: { type: "string" },
        granteePubKey: { type: "string" },
        postageBatchId: { type: "string" },
      },
      required: ["feedTopic", "granteePubKey"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "revoke_feed_access",
    title: "Revoke feed access",
    description:
      "Remove a grantee public key from the latest feed entry and advance the feed. Note: revocation is forward-only — anyone who already knows the old historyAddress can still decrypt existing content.",
    inputSchema: {
      type: "object",
      properties: {
        feedTopic: { type: "string" },
        granteePubKey: { type: "string" },
        postageBatchId: { type: "string" },
      },
      required: ["feedTopic", "granteePubKey"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "fetch_from_feed_with_act",
    title: "Fetch from feed (ACT)",
    description:
      "Consumer flow: read the latest feed entry for a topic, resolve the { reference, historyAddress } payload, and download with ACT using the publisher's public key. If feedOwner is omitted, it's derived from publisherPubKey (aligned identity). Provide filePath to save binary / manifest content; otherwise returns text.",
    inputSchema: {
      type: "object",
      properties: {
        feedTopic: { type: "string" },
        publisherPubKey: { type: "string" },
        feedOwner: {
          type: "string",
          description:
            "Optional ETH address of the feed owner. Defaults to ethAddress(publisherPubKey).",
        },
        filePath: { type: "string" },
        actTimestamp: { type: "number" },
      },
      required: ["feedTopic", "publisherPubKey"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "publish_marketplace_feed",
    title: "Publish to marketplace feed (ACT + schema v1)",
    description:
      "Publishes one data item to a marketplace-v1 feed. append=true (default) reads the latest feed entry and appends the new item to dataItems[]; append=false replaces. Payload shape: { schemeVersion: 'v1', dataItems: [{ swarmHash, actHistoryRef, granteeRef, displayName, metadata[], tags[] }, ...] }. Consumer-side uses fetch_marketplace_feed to browse + download_data_act to decrypt a picked item.",
    inputSchema: {
      type: "object",
      properties: {
        feedTopic: {
          type: "string",
          description:
            "Plain-text topic label (hashed with SHA-256) or a 64-char hex topic. Optional: defaults to METADATA_FEED_TOPIC env var if set.",
        },
        agentId: {
          type: "integer",
          description:
            "Integer ID of the publishing agent (e.g. ERC-8004 NFT token ID).",
        },
        publisherPublicKey: {
          type: "string",
          description:
            "Compressed secp256k1 public key (33 bytes / 66 hex chars) of the publisher. Optional: defaults to the local Bee node's public key.",
        },
        data: { type: "string", description: "Text content to upload." },
        filePath: {
          type: "string",
          description: "Path to a file (stdio mode only).",
        },
        isPath: { type: "boolean", default: false },
        displayName: {
          type: "string",
          description: "Human-readable name for this data item.",
        },
        metadata: {
          type: "array",
          description:
            "Array of { key, value } metadata entries describing the data item.",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              value: { type: "string" },
            },
            required: ["key", "value"],
            additionalProperties: false,
          },
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Distinct from metadata -- tags for search/filtering.",
        },
        grantees: {
          type: "array",
          items: { type: "string" },
          description:
            "Public keys authorized to decrypt this item. Optional: if omitted or empty, the publisher's own pubkey is auto-seeded so the item stays patchable later via grant_feed_access / patch_grantees. Pass concrete buyer pubkeys here if you already know them at publish time.",
        },
        append: {
          type: "boolean",
          default: true,
          description:
            "true = read latest feed and append this item to dataItems[]; false = replace with a single-item catalog.",
        },
        redundancyLevel: { type: "number", default: 0 },
        postageBatchId: { type: "string" },
      },
      required: ["agentId", "displayName"],
    },
    execution: { taskSupport: "forbidden" },
  },
  {
    name: "fetch_marketplace_feed",
    title: "Fetch marketplace feed catalog",
    description:
      "Reads the latest feed entry and STRICT-parses it as marketplace-v1. Returns the full dataItems[] so the caller can browse the catalog. Does NOT download any item -- use download_data_act with swarmHash + actHistoryRef + publisherPubKey to decrypt the chosen one (assuming the consumer's pubkey is on that item's granteeRef).",
    inputSchema: {
      type: "object",
      properties: {
        feedTopic: {
          type: "string",
          description:
            "Optional: defaults to METADATA_FEED_TOPIC env var if set.",
        },
        publisherPubKey: { type: "string" },
        feedOwner: {
          type: "string",
          description:
            "Optional ETH address of the feed owner. Defaults to ethAddress(publisherPubKey).",
        },
      },
      required: ["publisherPubKey"],
    },
    execution: { taskSupport: "forbidden" },
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
