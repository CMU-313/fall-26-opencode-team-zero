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
