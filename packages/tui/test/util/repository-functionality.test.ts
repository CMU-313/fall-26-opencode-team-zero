import { describe, expect, test } from "bun:test"
import { analyzeRepositoryGroups, buildFunctionalGroupPrompt } from "../../src/util/repository-functionality"

describe("repository functionality", () => {
  test("groups repository files by workspace and feature", () => {
    const groups = analyzeRepositoryGroups([
      "packages/tui/src/routes/session/index.tsx",
      "packages/tui/src/routes/session/dialog.tsx",
      "packages/tui/src/util/referenced-file.ts",
      "packages/opencode/src/session/index.ts",
    ])

    expect(groups.map((group) => [group.id, group.files.length])).toEqual([
      ["session-runtime", 1],
      ["terminal-user-interface", 3],
    ])
  })

  test("attaches matching tests to the functionality they verify", () => {
    const [group] = analyzeRepositoryGroups([
      "packages/tui/src/util/referenced-file.ts",
      "packages/tui/test/util/referenced-file.test.ts",
    ])

    expect(group.id).toBe("terminal-user-interface")
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

  test("prioritizes functionality referenced by the current session", () => {
    const groups = analyzeRepositoryGroups(
      ["packages/tui/src/index.ts", "packages/opencode/src/session/index.ts"],
      ["packages/tui/src/index.ts"],
    )

    expect(groups.map((group) => group.id)).toEqual(["terminal-user-interface", "session-runtime"])
  })

  test("matches tests to source files inside the same workspace", () => {
    const groups = analyzeRepositoryGroups([
      "packages/api/src/auth/token.ts",
      "packages/web/src/session/token.ts",
      "packages/web/test/session/token.test.ts",
    ])

    expect(groups.find((group) => group.id === "web-application")?.files).toEqual([
      "packages/web/src/session/token.ts",
      "packages/web/test/session/token.test.ts",
    ])
  })

  test("creates relationships only from concrete import evidence", () => {
    const groups = analyzeRepositoryGroups([
      { path: "packages/app/src/index.tsx", imports: ["../../tui/src/util/referenced-file"] },
      "packages/tui/src/util/referenced-file.ts",
      "packages/tui/src/component/dialog.tsx",
    ])
    const app = groups.find((group) => group.id === "shared-user-interface")!

    expect(app.relationships).toEqual([
      {
        from: "shared-user-interface",
        to: "terminal-user-interface",
        kind: "imports",
        evidence: ["packages/app/src/index.tsx imports packages/tui/src/util/referenced-file.ts"],
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

  test("builds a bounded evidence-based learning prompt", () => {
    const groups = analyzeRepositoryGroups(
      [
        {
          path: "packages/app/src/index.tsx",
          imports: ["../../tui/src/util/referenced-file"],
        },
        "packages/tui/src/util/referenced-file.ts",
        ...Array.from({ length: 14 }, (_, index) => `packages/app/src/view-${index}.tsx`),
      ],
      ["packages/app/src/index.tsx"],
    )
    const group = groups.find((item) => item.id === "shared-user-interface")!
    const prompt = buildFunctionalGroupPrompt(group, groups)

    expect(prompt).toContain("Teach me the Shared User Interface functionality")
    expect(prompt).toContain("Session-referenced evidence:\n- packages/app/src/index.tsx")
    expect(prompt).toContain("shared-user-interface imports terminal-user-interface")
    expect(prompt).toContain("Evidence: packages/app/src/index.tsx imports")
    expect(prompt).toContain("additional files omitted")
    expect(prompt).toContain("recommended reading order")
    expect(prompt).toContain("do not generate an ASCII diagram")
    expect(prompt).not.toContain("view-9.tsx")
  })

  test("does not invent relationships when no evidence exists", () => {
    const [group] = analyzeRepositoryGroups(["packages/tui/src/session/index.ts"])
    const prompt = buildFunctionalGroupPrompt(group, [group])

    expect(prompt).toContain("No cross-group relationship has been established; do not invent one.")
  })
})
