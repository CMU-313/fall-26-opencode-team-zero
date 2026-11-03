import { expect, test } from "bun:test"
import fc from "fast-check"
import { analyzeRepositoryGroups } from "../../src/util/repository-functionality"

// Short path components keep shrinking readable; fixed roots, ignored names, and
// boundary cases below ensure generated inputs reach the rules users asked about.
const part = fc.array(fc.constantFrom("a", "b", "c", "x", "y", "z", "0", "1"), { minLength: 1, maxLength: 8 }).map((x) => x.join(""))
const filename = fc.tuple(part, fc.constantFrom(".ts", ".md", ".custom")).map(([name, ext]) => `${name}${ext}`)
const acceptedPath = fc.tuple(fc.constantFrom("src", "tests", "docs", "mystery", "builder", "packages/api/src"), part, filename)
  .map(([root, dir, file]) => `${root}/${dir}/${file}`)

function groupFiles(groups: ReturnType<typeof analyzeRepositoryGroups>) {
  return groups.flatMap((group) => group.files)
}

function subgroupFiles(groups: ReturnType<typeof analyzeRepositoryGroups>) {
  return groups.flatMap((group) => group.subgroups.flatMap((subgroup) => subgroup.files))
}

// R1: The map includes every file not excluded by R2, including unfamiliar folders.
// Kind: model/oracle. Include root files and unfamiliar/custom paths; vary count across
// empty, ordinary, and overflow-size inventories so both coverage levels are checked.
test("R1: accepted files appear exactly once in groups and subgroups", () => {
  fc.assert(fc.property(fc.array(acceptedPath, { minLength: 0, maxLength: 80 }), (paths) => {
    const input = ["README.md", "mystery/item.custom", ...paths]
    const expected = [...new Set(input)].sort()
    const groups = analyzeRepositoryGroups(input)
    expect(groupFiles(groups).sort()).toEqual(expected)
    expect(subgroupFiles(groups).sort()).toEqual(expected)
  }), { numRuns: 200 })
})

// R2: Hide files inside folders named .git, node_modules, coverage, dist, build,
// or .turbo; similarly named folders such as builder stay visible.
// Kind: invariant. Place each forbidden segment at root or nested depth and
// contrast it with a prefix/suffix lookalike at the same depth.
test("R2: ignored directory segments are exact matches at any depth", () => {
  fc.assert(fc.property(
    fc.constantFrom(".git", "node_modules", "coverage", "dist", "build", ".turbo"),
    fc.constantFrom("", "packages/api/", "apps/web/src/"),
    filename,
    (ignored, prefix, file) => {
      const hidden = `${prefix}${ignored}/${file}`
      const visible = `${prefix}${ignored}er/${file}`
      const groups = analyzeRepositoryGroups([hidden, visible])
      expect(groupFiles(groups)).toEqual([visible])
      expect(subgroupFiles(groups)).toEqual([visible])
    },
  ), { numRuns: 200 })
})

// R3: Top-level files appear in the Project root group and in a subgroup there.
// Kind: model/oracle. Vary dotfiles and ordinary filenames alongside nested paths.
test("R3: only top-level files belong to Project root", () => {
  fc.assert(fc.property(fc.uniqueArray(filename, { maxLength: 20 }), fc.uniqueArray(acceptedPath, { maxLength: 20 }),
    (rootNames, nested) => {
      const roots = [".gitignore", ...rootNames]
      const groups = analyzeRepositoryGroups([...roots, ...nested])
      const root = groups.find((group) => group.id === ".")
      expect(root?.title).toBe("Project root")
      expect(root?.files.sort()).toEqual([...new Set(roots)].sort())
      expect(root?.subgroups.flatMap((subgroup) => subgroup.files).sort()).toEqual([...new Set(roots)].sort())
      expect(groups.filter((group) => group.id !== ".").flatMap((group) => group.files).sort()).toEqual([...new Set(nested)].sort())
    }), { numRuns: 200 })
})

// R4: Adding and deleting a file restores the deterministic repository map when
// other paths and session-referenced paths do not change.
// Kind: round-trip. Try a temporary file in an existing folder and in a new
// folder, with a stable referenced file, to exercise group creation/removal.
test("R4: temporary file addition and removal restores the map", () => {
  fc.assert(fc.property(fc.uniqueArray(acceptedPath, { maxLength: 30 }), part, fc.boolean(),
    (extra, name, newGroup) => {
      const inventory = ["README.md", "docs/guide.md", "src/main.ts", ...extra]
      const temporary = newGroup ? `scratch/${name}.md` : `docs/${name}.md`
      const referenced = ["src/main.ts"]
      const before = analyzeRepositoryGroups(inventory, referenced)
      inventory.push(temporary)
      const during = analyzeRepositoryGroups(inventory, referenced)
      expect(groupFiles(during)).toContain(temporary)
      inventory.pop()
      const after = analyzeRepositoryGroups(inventory, referenced)
      expect(after).toEqual(before)
      if (newGroup) {
        expect(after.some((group) => group.id === "scratch")).toBe(false)
      }
    }), { numRuns: 200 })
})

// R5: Renaming an unread file within its folder keeps its group and subgroup,
// group counts and order, while replacing only the path in alphabetical lists.
// Kind: metamorphic. Generate distinct old/new basenames within a fixed source
// subgroup and retain another file and group to check nonlocal stability.
test("R5: a same-folder rename preserves structural placement", () => {
  fc.assert(fc.property(part, part, part, (oldName, newName, suffix) => {
    fc.pre(oldName !== newName)
    const oldPath = `src/auth/${oldName}.ts`
    const newPath = `src/auth/${newName}.ts`
    const unchanged = `src/auth/other-${suffix}.md`
    fc.pre(oldPath !== unchanged && newPath !== unchanged)
    const before = analyzeRepositoryGroups([oldPath, unchanged, "docs/guide.md"])
    const after = analyzeRepositoryGroups([newPath, unchanged, "docs/guide.md"])
    expect(after.map((group) => [group.id, group.title, group.files.length])).toEqual(
      before.map((group) => [group.id, group.title, group.files.length]),
    )
    const first = before.find((group) => group.id === "src")!
    const second = after.find((group) => group.id === "src")!
    expect(second.subgroups.map((subgroup) => [subgroup.id, subgroup.title, subgroup.files.length])).toEqual(
      first.subgroups.map((subgroup) => [subgroup.id, subgroup.title, subgroup.files.length]),
    )
    expect(second.files).toEqual([newPath, unchanged].sort((a, b) => a.localeCompare(b)))
    expect(second.subgroups[0].files).toEqual(second.files)
    expect(after.find((group) => group.id === "docs")).toEqual(before.find((group) => group.id === "docs"))
    expect(after.flatMap((group) => group.referencedFiles)).toEqual([])
  }), { numRuns: 200 })
})

// R6: Repeated discovery of one path does not duplicate it in a group/subgroup.
// Kind: metamorphic. Vary repeated paths and count, including overflow-size maps.
test("R6: duplicate input paths leave the complete map unchanged", () => {
  fc.assert(fc.property(fc.uniqueArray(acceptedPath, { minLength: 1, maxLength: 70 }), fc.nat({ max: 10 }),
    (paths, copies) => {
      const repeated = paths[0]
      const expected = analyzeRepositoryGroups(paths)
      const actual = analyzeRepositoryGroups([...paths, ...Array(copies).fill(repeated)])
      expect(actual).toEqual(expected)
    }), { numRuns: 200 })
})

// R7: packages/api and apps/web files remain in their own groups and subgroups.
// Kind: invariant. Generate multiple files under both workspace roots, including
// source, test, and deeper folders, so cross-group leakage is detectable.
test("R7: package and app files stay in their respective groups", () => {
  fc.assert(fc.property(fc.uniqueArray(filename, { minLength: 1, maxLength: 25 }), fc.uniqueArray(filename, { minLength: 1, maxLength: 25 }),
    (apiNames, webNames) => {
      const api = apiNames.map((file, index) => `packages/api/${index % 2 ? "test" : "src"}/auth/${file}`)
      const web = webNames.map((file, index) => `apps/web/${index % 2 ? "test" : "src"}/pages/${file}`)
      const groups = analyzeRepositoryGroups([...api, ...web])
      const apiGroup = groups.find((group) => group.id === "packages/api")!
      const webGroup = groups.find((group) => group.id === "apps/web")!
      expect(groups).toHaveLength(2)
      expect(apiGroup.files.sort()).toEqual(api.sort())
      expect(webGroup.files.sort()).toEqual(web.sort())
      expect(apiGroup.subgroups.flatMap((subgroup) => subgroup.files).sort()).toEqual(api.sort())
      expect(webGroup.subgroups.flatMap((subgroup) => subgroup.files).sort()).toEqual(web.sort())
    }), { numRuns: 200 })
})
