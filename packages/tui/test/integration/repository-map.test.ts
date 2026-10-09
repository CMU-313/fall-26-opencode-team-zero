import { expect, test } from "bun:test"
import { collectReferencedFiles } from "../../src/util/referenced-file"
import { analyzeRepositoryGroups, buildFunctionalGroupPrompt, buildGroupNamingPrompt } from "../../src/util/repository-functionality"

test("integration: completed session reads prioritize map groups and ground their guides", () => {
  const referenced = collectReferencedFiles(
    [
      { type: "tool", tool: "read", state: { status: "completed", input: { filePath: "/repo/apps/web/src/home.tsx" } } },
      { type: "tool", tool: "read", state: { status: "error", input: { filePath: "/repo/packages/api/src/user.ts" } } },
    ],
    "/repo",
  )
  const groups = analyzeRepositoryGroups(
    ["packages/api/src/user.ts", "apps/web/src/home.tsx", "apps/web/test/home.test.ts"],
    referenced,
  )
  const web = groups[0]

  expect(referenced).toEqual(["apps/web/src/home.tsx"])
  expect(web.id).toBe("apps/web")
  expect(web.referencedFiles).toEqual(referenced)
  expect(buildGroupNamingPrompt(groups)).toContain("- apps/web/src/home.tsx")
  expect(buildFunctionalGroupPrompt(web, groups)).toContain("- apps/web/src/home.tsx")
  expect(buildFunctionalGroupPrompt(web.subgroups[0], groups)).toContain("- apps/web/src/home.tsx")
})

test("integration: repeated session reads count once in the map and guide", () => {
  const reads = [
    { type: "tool", tool: "read", state: { status: "completed", input: { filePath: "/repo/apps/web/src/home.tsx" } } },
    { type: "tool", tool: "read", state: { status: "completed", input: { filePath: "apps/web/src/home.tsx" } } },
  ]
  const referenced = collectReferencedFiles(reads, "/repo")
  const [web] = analyzeRepositoryGroups(["apps/web/src/home.tsx", "apps/web/src/about.tsx"], referenced)
  const prompt = buildFunctionalGroupPrompt(web, [web])

  expect(referenced).toEqual(["apps/web/src/home.tsx"])
  expect(web.referencedFiles).toEqual(["apps/web/src/home.tsx"])
  expect(prompt.match(/- apps\/web\/src\/home\.tsx/g)).toHaveLength(1)
})
