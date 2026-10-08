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

  test("includes session-referenced files in the naming sample", () => {
    const files = Array.from({ length: 12 }, (_, index) => `src/session/file-${index}.ts`)
    const referenced = files.at(-1)!
    const [group] = analyzeRepositoryGroups(files, [referenced])
    const prompt = buildGroupNamingPrompt([group])

    expect(prompt).toContain(`- ${referenced}`)
    expect(prompt.split("\n- ")).toHaveLength(6)
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

  test("handles empty repositories and ignores generated-only inventories", () => {
    expect(analyzeRepositoryGroups([])).toEqual([])
    expect(analyzeRepositoryGroups(["node_modules/pkg/index.js", "dist/app.js", ".git/config"])).toEqual([])
  })

  test("keeps root files and unfamiliar layouts without losing paths", () => {
    const files = [
      "README.md",
      "mystery/component.custom",
      "services/api/lib/start.ts",
      "modules/parser/spec/check.txt",
    ]
    const groups = analyzeRepositoryGroups(files)

    expect(groups.flatMap((group) => group.files).sort()).toEqual([...files].sort())
    expect(groups.find((group) => group.id === ".")?.files).toEqual(["README.md"])
    expect(groups.map((group) => group.id)).toEqual(
      expect.arrayContaining(["mystery", "services/api", "modules/parser"]),
    )
  })

  test.each([19, 20, 21, 25])("boundary-value analysis: preserves files with %i subgroups", (count) => {
    const files = Array.from({ length: count }, (_, index) => `packages/api/src/feature-${index}/index.ts`)
    const [group] = analyzeRepositoryGroups(files, files)

    expect(group.subgroups).toHaveLength(Math.min(count, 20))
    expect(group.subgroups.flatMap((subgroup) => subgroup.files).sort()).toEqual([...files].sort())
    expect(group.subgroups.flatMap((subgroup) => subgroup.referencedFiles).sort()).toEqual([...files].sort())
    if (count > 20) {
      expect(group.subgroups.at(-1)?.title).toBe("Other areas")
      expect(group.subgroups.at(-1)?.files).toHaveLength(count - 19)
    }
  })

  test.each([29, 30, 31, 35])("boundary-value analysis: preserves files with %i groups", (count) => {
    const files = Array.from({ length: count }, (_, index) => `packages/area-${index}/src/index.ts`)
    const groups = analyzeRepositoryGroups(files, files)

    expect(groups).toHaveLength(Math.min(count, 30))
    expect(groups.flatMap((group) => group.files).sort()).toEqual([...files].sort())
    expect(groups.flatMap((group) => group.referencedFiles).sort()).toEqual([...files].sort())
    expect(groups.flatMap((group) => group.subgroups.flatMap((subgroup) => subgroup.files)).sort()).toEqual(
      [...files].sort(),
    )
    if (count > 30) {
      expect(groups.at(-1)?.title).toBe("Other repository groups")
      expect(groups.at(-1)?.files).toHaveLength(count - 29)
    }
  })

  test.each(["", "No names available", '{"src":', '{"src": "Source",}'])(
    "retains structural names for malformed naming response %j",
    (response) => {
      const groups = analyzeRepositoryGroups(["src/main.ts", "docs/guide.md"])
      expect(applyGroupNames(groups, response)).toEqual(groups)
    },
  )

  test("metamorphic testing: duplicate and reordered path formats preserve the map", () => {
    const files = ["packages/api/src/login.ts", "packages/api/test/login.test.ts", "apps/web/src/home.tsx"]
    const expected = analyzeRepositoryGroups(files, ["apps/web/src/home.tsx"])
    const changed = analyzeRepositoryGroups(
      ["./apps/web/src/home.tsx", "packages\\api\\test\\login.test.ts", ...files.toReversed(), files[0]],
      ["apps\\web\\src\\home.tsx"],
    )

    expect(changed).toEqual(expected)
  })

  test("generated-input property: every accepted file belongs to one group and subgroup", () => {
    for (const count of [1, 2, 17, 18, 19, 30, 31, 75]) {
      const files = Array.from({ length: count }, (_, index) =>
        index % 2 ? `apps/web/test/case-${index}.test.ts` : `packages/api/src/feature-${index}/index.ts`,
      )
      const groups = analyzeRepositoryGroups(
        files.flatMap((file, index) => (index % 2 ? [file, file] : [`./${file}`, file])),
        [files[0], files.at(-1)!],
      )
      const references = [...new Set([files[0], files.at(-1)!])].sort()

      expect(groups.flatMap((group) => group.files).sort()).toEqual([...files].sort())
      expect(groups.flatMap((group) => group.subgroups.flatMap((subgroup) => subgroup.files)).sort()).toEqual(
        [...files].sort(),
      )
      expect(groups.flatMap((group) => group.referencedFiles).sort()).toEqual(references)
    }
  })

  test("pairwise testing: a late referenced file survives prompt length limits", () => {
    const files = Array.from({ length: 35 }, (_, index) => `src/session/file-${index}.ts`)
    const referenced = files.at(-1)!
    const [group] = analyzeRepositoryGroups(files, [referenced])
    const prompt = buildFunctionalGroupPrompt(group, [group])
    const listed = prompt.split("Representative files:\n")[1].split("\n- (", 1)[0].split("\n")

    expect(listed).toHaveLength(15)
    expect(listed[0]).toBe(`- ${referenced}`)
    expect(prompt).toContain(`(${files.length - 15} additional files omitted)`)
  })

  test("retains names for missing and non-string values without changing the original map", () => {
    const groups = analyzeRepositoryGroups(["src/main.ts", "docs/guide.md", "tests/main.test.ts"])
    const original = structuredClone(groups)
    const renamed = applyGroupNames(groups, '{"src": "Application", "docs": 42, "unrelated": "Unused"}')

    expect(renamed.find((group) => group.id === "src")?.title).toBe("Application")
    expect(renamed.find((group) => group.id === "docs")).toEqual(groups.find((group) => group.id === "docs"))
    expect(renamed.find((group) => group.id === "tests")).toEqual(groups.find((group) => group.id === "tests"))
    expect(renamed).toHaveLength(groups.length)
    expect(groups).toEqual(original)
  })
})
