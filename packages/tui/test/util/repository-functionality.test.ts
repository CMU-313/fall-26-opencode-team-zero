import { describe, expect, test } from "bun:test"
import {
  analyzeRepositoryGroups,
  applyGroupNames,
  buildFunctionalGroupPrompt,
  buildGroupNamingPrompt,
} from "../../src/util/repository-functionality"

describe("repository areas", () => {
  test("groups common repository layouts without project-specific names", () => {
    const groups = analyzeRepositoryGroups([
      "packages/api/src/auth/token.ts",
      "packages/api/test/auth/token.test.ts",
      "apps/web/src/pages/home.tsx",
      "lib/parser/index.py",
      "spec/parser/index_spec.py",
    ])

    expect(groups.map((group) => group.id)).toEqual(["packages/api/auth", "parser", "apps/web/pages"])
    expect(groups.find((group) => group.id === "packages/api/auth")?.files).toHaveLength(2)
    expect(groups.find((group) => group.id === "packages/api/auth")?.title).toBe("Auth · Api")
    expect(groups.find((group) => group.id === "parser")?.files).toHaveLength(2)
  })

  test("prioritizes areas referenced in the current session", () => {
    const groups = analyzeRepositoryGroups(["src/auth/login.ts", "src/editor/open.ts"], ["src/editor/open.ts"])

    expect(groups.map((group) => group.id)).toEqual(["editor", "auth"])
    expect(groups[0].referencedFiles).toEqual(["src/editor/open.ts"])
  })

  test("builds a bounded evidence-based explanation prompt", () => {
    const [group] = analyzeRepositoryGroups(
      Array.from({ length: 20 }, (_, index) => `src/session/file-${index}.ts`),
      ["src/session/file-19.ts"],
    )
    const related = analyzeRepositoryGroups(["src/auth/login.ts"])[0]
    const prompt = buildFunctionalGroupPrompt(group, [group, related])

    expect(prompt).toContain("Infer a concise functionality name")
    expect(prompt).toContain("src/session/file-19.ts")
    expect(prompt).toContain("additional files omitted")
    expect(prompt).toContain("Other repository groups:")
    expect(prompt).toContain("Auth (auth)")
    expect(prompt).toContain("Do not invent a relationship")
    expect(prompt).not.toContain("src/session/file-8.ts")
  })

  test("limits the map and applies model-generated names", () => {
    const groups = analyzeRepositoryGroups(
      Array.from({ length: 35 }, (_, index) => `src/area-${index}/index.ts`),
      ["src/area-34/index.ts"],
    )
    const renamed = applyGroupNames(groups, '{"area-34":"Session History"}')

    expect(groups).toHaveLength(30)
    expect(groups[0].id).toBe("area-34")
    expect(renamed[0].title).toBe("Session History")
    expect(buildGroupNamingPrompt(groups)).toContain("Area: area-34")
  })
})
