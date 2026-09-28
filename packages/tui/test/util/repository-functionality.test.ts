import { describe, expect, test } from "bun:test"
import { analyzeRepositoryGroups } from "../../src/util/repository-functionality"

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

  test("limits the map to 30 prioritized groups", () => {
    const groups = analyzeRepositoryGroups(
      Array.from({ length: 35 }, (_, index) => `packages/area-${index}/src/index.ts`),
      ["packages/area-34/src/index.ts"],
    )
    expect(groups).toHaveLength(30)
    expect(groups[0].id).toBe("packages/area-34")
  })
})
