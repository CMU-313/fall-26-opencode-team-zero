import { describe, expect, test } from "bun:test"
import {
  collectReferencedFiles,
  collectReferencedFileOverview,
  referencedFileCommand,
  referencedFileCountMessage,
} from "../../src/util/referenced-file"

describe("referenced files", () => {
  test("collects completed read calls in first-reference order", () => {
    expect(
      collectReferencedFiles([
        completedRead("src/index.ts"),
        completedRead("test/index.test.ts"),
        completedRead("package.json"),
      ]),
    ).toEqual(["src/index.ts", "test/index.test.ts", "package.json"])
  })

  test("prefers the resolved display path", () => {
    expect(
      collectReferencedFiles([
        completedRead("src/index.ts", {
          display: { type: "file", path: "/project/src/index.ts" },
        }),
      ]),
    ).toEqual(["/project/src/index.ts"])
  })

  test("deduplicates paths and normalizes Windows separators", () => {
    expect(
      collectReferencedFiles([
        completedRead("C:\\project\\src\\index.ts"),
        completedRead("C:/project/src/index.ts"),
        completedRead("C:\\project\\test\\index.test.ts"),
      ]),
    ).toEqual(["C:/project/src/index.ts", "C:/project/test/index.test.ts"])
  })

  test("ignores directories and incomplete or unrelated tools", () => {
    expect(
      collectReferencedFiles([
        completedRead("src", { display: { type: "directory", path: "/project/src" } }),
        { type: "tool", tool: "read", state: { status: "running", input: { filePath: "running.ts" } } },
        { type: "tool", tool: "read", state: { status: "error", input: { filePath: "missing.ts" } } },
        { type: "tool", tool: "write", state: { status: "completed", input: { filePath: "written.ts" } } },
        { type: "text" },
      ]),
    ).toEqual([])
  })

  test("ignores malformed and empty read inputs", () => {
    expect(
      collectReferencedFiles([
        completedRead(""),
        { type: "tool", tool: "read", state: { status: "completed", input: { filePath: 42 } } },
        { type: "tool", tool: "read", state: { status: "completed", input: null } },
      ]),
    ).toEqual([])
  })

  test("collects and groups a mixed session reference pipeline", () => {
    expect(
      collectReferencedFileOverview([
        completedRead("README.md"),
        completedRead("src/index.ts"),
        completedRead("src\\index.ts"),
        completedRead("tests/index.test.ts"),
        completedRead("tsconfig.app.json"),
        completedRead("assets/logo.png"),
      ]),
    ).toEqual({
      files: ["README.md", "src/index.ts", "tests/index.test.ts", "tsconfig.app.json", "assets/logo.png"],
      groups: [
        { role: "source", files: ["src/index.ts"] },
        { role: "test", files: ["tests/index.test.ts"] },
        { role: "configuration", files: ["tsconfig.app.json"] },
        { role: "documentation", files: ["README.md"] },
        { role: "other", files: ["assets/logo.png"] },
      ],
    })
  })
})

describe("referenced file command", () => {
  test("registers the group slash command", () => {
    expect(referencedFileCommand).toEqual({
      title: "Group referenced files",
      value: "session.references.group",
      category: "Session",
      slash: { name: "group", aliases: [] },
    })
  })

  test.each([
    [0, "No referenced files in this session"],
    [1, "Found 1 referenced file"],
    [3, "Found 3 referenced files"],
  ] as const)("formats feedback for %i files", (count, expected) => {
    expect(referencedFileCountMessage(count)).toBe(expected)
  })
})

function completedRead(filePath: string, metadata?: unknown) {
  return {
    type: "tool",
    tool: "read",
    state: {
      status: "completed",
      input: { filePath },
      metadata,
    },
  }
}
