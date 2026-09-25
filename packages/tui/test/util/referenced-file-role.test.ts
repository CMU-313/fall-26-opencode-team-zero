import { describe, expect, test } from "bun:test"
import { classifyReferencedFile, groupReferencedFiles, referencedFileRoles } from "../../src/util/referenced-file-role"

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
})
