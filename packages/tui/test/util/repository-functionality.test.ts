import { describe, expect, test } from "bun:test"
import { analyzeRepositoryGroups } from "../../src/util/repository-functionality"

describe("repository functionality", () => {
  test("groups repository files by workspace and feature", () => {
    const groups = analyzeRepositoryGroups([
      "packages/tui/src/routes/session/index.tsx",
      "packages/tui/src/routes/session/dialog.tsx",
      "packages/tui/src/util/referenced-file.ts",
      "packages/opencode/src/session/index.ts",
    ])

    expect(groups.map((group) => [group.id, group.files.length])).toEqual([
      ["packages/opencode:session", 1],
      ["packages/tui:routes/session", 2],
      ["packages/tui:util", 1],
    ])
  })

  test("attaches matching tests to the functionality they verify", () => {
    const [group] = analyzeRepositoryGroups([
      "packages/tui/src/util/referenced-file.ts",
      "packages/tui/test/util/referenced-file.test.ts",
    ])

    expect(group.id).toBe("packages/tui:util")
    expect(group.files).toEqual([
      "packages/tui/src/util/referenced-file.ts",
      "packages/tui/test/util/referenced-file.test.ts",
    ])
  })

  test("tracks referenced and entry files inside each group", () => {
    const [group] = analyzeRepositoryGroups(
      ["packages/opencode/src/session/index.ts", "packages/opencode/src/session/prompt.ts"],
      ["packages/opencode/src/session/prompt.ts"],
    )

    expect(group.entryFiles).toEqual(["packages/opencode/src/session/index.ts"])
    expect(group.referencedFiles).toEqual(["packages/opencode/src/session/prompt.ts"])
  })

  test("matches tests to source files inside the same workspace", () => {
    const groups = analyzeRepositoryGroups([
      "packages/api/src/auth/token.ts",
      "packages/web/src/session/token.ts",
      "packages/web/test/session/token.test.ts",
    ])

    expect(groups.find((group) => group.id === "packages/web:session")?.files).toEqual([
      "packages/web/src/session/token.ts",
      "packages/web/test/session/token.test.ts",
    ])
  })

  test("creates relationships only from concrete import evidence", () => {
    const groups = analyzeRepositoryGroups([
      { path: "packages/tui/src/routes/session/index.tsx", imports: ["../../util/referenced-file"] },
      "packages/tui/src/util/referenced-file.ts",
      "packages/tui/src/component/dialog.tsx",
    ])
    const session = groups.find((group) => group.id === "packages/tui:routes/session")!

    expect(session.relationships).toEqual([
      {
        from: "packages/tui:routes/session",
        to: "packages/tui:util",
        kind: "imports",
        evidence: ["packages/tui/src/routes/session/index.tsx imports packages/tui/src/util/referenced-file.ts"],
      },
    ])
  })

  test("normalizes duplicates and excludes generated directories", () => {
    const groups = analyzeRepositoryGroups([
      "./packages/tui/src/index.ts",
      "packages\\tui\\src\\index.ts",
      "packages/tui/node_modules/library/index.ts",
      "packages/tui/dist/index.js",
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].files).toEqual(["packages/tui/src/index.ts"])
  })
})
