import { uploadData } from "./index";
import { Bee } from "@ethersphere/bee-js";
import { UploadDataArgs } from "./models";

// Mock Bee client
const mockUploadData = jest.fn();
const mockBee = {
  uploadData: mockUploadData,
  getPostageBatches: jest.fn().mockResolvedValue([
    {
      batchID: { toHex: () => "batch-id" },
      remainingSize: { toBytes: () => 1000 },
      usable: true,
    },
  ]),
} as unknown as Bee;

describe("uploadData Tool", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should upload data successfully", async () => {
    const args: UploadDataArgs = {
      data: "Hello World",
      redundancyLevel: 2,
    };

    mockUploadData.mockResolvedValue({
      reference: "test-reference",
    });

    const result = await uploadData(args, mockBee);

    expect(mockUploadData).toHaveBeenCalledWith(
      "batch-id", // postageBatchId
      expect.any(Buffer),
      { redundancyLevel: 2 }
    );
    expect((result as any).content[0].text).toContain("test-reference");
  });

  it("should throw error if data is missing", async () => {
    const args = {} as UploadDataArgs;

    await expect(uploadData(args, mockBee)).rejects.toThrow(
      "Missing required parameter: data"
    );
  });
});
