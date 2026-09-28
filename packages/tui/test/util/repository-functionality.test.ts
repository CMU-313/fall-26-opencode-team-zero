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

    expect(groups.map((group) => group.id)).toEqual(["packages/api", "lib", "spec", "apps/web"])
    const api = groups.find((group) => group.id === "packages/api")!
    expect(api.subgroups).toHaveLength(1)
    expect(api.subgroups[0].id).toBe("packages/api/auth")
    expect(api.subgroups[0].files).toHaveLength(2)
  })

  test("prioritizes areas referenced in the current session", () => {
    const groups = analyzeRepositoryGroups(
      ["packages/api/src/login.ts", "packages/web/src/open.ts"],
      ["packages/web/src/open.ts"],
    )

    expect(groups.map((group) => group.id)).toEqual(["packages/web", "packages/api"])
    expect(groups[0].referencedFiles).toEqual(["packages/web/src/open.ts"])
  })

  test("builds a bounded evidence-based explanation prompt", () => {
    const [group] = analyzeRepositoryGroups(
      Array.from({ length: 20 }, (_, index) => `src/session/file-${index}.ts`),
      ["src/session/file-19.ts"],
    )
    const related = analyzeRepositoryGroups(["packages/auth/src/login.ts"])[0]
    const prompt = buildFunctionalGroupPrompt(group, [group, related])

    expect(prompt).toContain("src/session/file-19.ts")
    expect(prompt).toContain("additional files omitted")
    expect(prompt).toContain("Other groups:")
    expect(prompt).toContain("Auth (packages/auth)")
    expect(prompt).toContain("Do not invent relationships")
    expect(prompt).not.toContain("src/session/file-8.ts")
  })

  test("limits the map and applies model-generated names", () => {
    const groups = analyzeRepositoryGroups(
      Array.from({ length: 35 }, (_, index) => `packages/area-${index}/src/index.ts`),
      ["packages/area-34/src/index.ts"],
    )
    const renamed = applyGroupNames(groups, '{"packages/area-34":"Session History"}')

    expect(groups).toHaveLength(30)
    expect(groups[0].id).toBe("packages/area-34")
    expect(renamed[0].title).toBe("Session History")
    expect(buildGroupNamingPrompt(groups)).toContain("Group: packages/area-34")
  })
})
