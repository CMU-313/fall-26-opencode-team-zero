import { describe, expect, test } from "bun:test"
import {
  classifyReferencedFile,
  explainReferencedFileRole,
  groupReferencedFiles,
  referencedFileRoles,
} from "../../src/util/referenced-file-role"

describe("referenced file role", () => {
  test.each([
    ["src/session/prompt.ts", "source"],
    ["packages/app/src/page.tsx", "source"],
    ["test/session/prompt.test.ts", "test"],
    ["src/__tests__/prompt.ts", "test"],
    ["C:\\project\\tests\\prompt.spec.ts", "test"],
    ["README.md", "documentation"],
    ["docs/architecture.mdx", "documentation"],
    ["package.json", "configuration"],
    [".github/workflows/test.yml", "configuration"],
    ["vite.config.ts", "configuration"],
    ["assets/logo.png", "other"],
    ["data/example.custom", "other"],
  ] as const)("classifies %s as %s", (filePath, expected) => {
    expect(classifyReferencedFile(filePath)).toBe(expected)
  })

  test("prioritizes test conventions over source extensions", () => {
    expect(classifyReferencedFile("src/parser.test.ts")).toBe("test")
  })

  test("exposes roles in display order", () => {
    expect(referencedFileRoles).toEqual(["source", "test", "configuration", "documentation", "other"])
  })

  test("groups files in display order and omits empty roles", () => {
    expect(
      groupReferencedFiles(["README.md", "src/index.ts", "assets/logo.png", "src/index.test.ts", "src/parser.ts"]),
    ).toEqual([
      { role: "source", files: ["src/index.ts", "src/parser.ts"] },
      { role: "test", files: ["src/index.test.ts"] },
      { role: "documentation", files: ["README.md"] },
      { role: "other", files: ["assets/logo.png"] },
    ])
  })

  test.each([
    ["tests/parser.ts", "test", "It is inside a recognized test directory."],
    ["parser.spec.ts", "test", "Its filename follows a recognized test or spec convention."],
    ["README.md", "documentation", "Its filename identifies it as a project README."],
    ["package.json", "configuration", "Its filename is a recognized project configuration file."],
    ["src/parser.ts", "source", "Its .ts extension is commonly used for source code."],
    [
      "assets/logo.png",
      "other",
      "It does not match a recognized source, test, configuration, or documentation convention.",
    ],
  ] as const)("explains why %s is classified as %s", (filePath, role, reason) => {
    expect(explainReferencedFileRole(filePath)).toEqual({ role, reason })
  })
})
