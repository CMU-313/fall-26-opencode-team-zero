import { describe, expect, test } from "bun:test"
import { collectReferencedFiles, referencedFileCommand } from "../../src/util/referenced-file"

describe("referenced files", () => {
  test("collects unique files from completed read calls", () => {
    expect(
      collectReferencedFiles([
        completedRead("src\\index.ts"),
        completedRead("src/index.ts"),
        completedRead("test/index.test.ts"),
        { type: "tool", tool: "read", state: { status: "running", input: { filePath: "ignored.ts" } } },
        { type: "tool", tool: "write", state: { status: "completed", input: { filePath: "ignored.ts" } } },
      ]),
    ).toEqual(["src/index.ts", "test/index.test.ts"])
  })

  test("equivalence partitioning: metadata file paths override input paths", () => {
    expect(
      collectReferencedFiles([
        {
          type: "tool",
          tool: "read",
          state: {
            status: "completed",
            input: { filePath: "outdated.ts" },
            metadata: { display: { type: "file", path: "src/current.ts" } },
          },
        },
        {
          type: "tool",
          tool: "read",
          state: {
            status: "completed",
            input: { filePath: "directory.ts" },
            metadata: { display: { type: "directory", path: "src" } },
          },
        },
        completedRead("src/fallback.ts"),
      ]),
    ).toEqual(["src/current.ts", "src/fallback.ts"])
  })

  test("equivalence partitioning: ignores unreadable or unfinished tool results", () => {
    expect(
      collectReferencedFiles([
        { type: "tool", tool: "read", state: { status: "completed", input: { filePath: "  " } } },
        { type: "tool", tool: "read", state: { status: "completed", input: { filePath: 42 } } },
        { type: "tool", tool: "read", state: { status: "error", input: { filePath: "failed.ts" } } },
        { type: "tool", tool: "write", state: { status: "completed", input: { filePath: "written.ts" } } },
        { type: "text" },
      ]),
    ).toEqual([])
  })

  test("registers /group", () => {
    expect(referencedFileCommand.slash.name).toBe("group")
  })
})

function completedRead(filePath: string) {
  return {
    type: "tool",
    tool: "read",
    state: { status: "completed", input: { filePath } },
  }
}
