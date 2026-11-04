import { expect, test } from "bun:test"
import fc from "fast-check"
import { analyzeRepositoryGroups } from "../../src/util/repository-functionality"

const excludedDirectories = [".git", "node_modules", "coverage", "dist", "build", ".turbo"] as const
// Separator-free components include extensionless filenames and names matching excluded directories.
const part = fc
  .array(fc.constantFrom("a", "b", "c", "x", "y", "z", "0", "1"), { minLength: 1, maxLength: 8 })
  .map((x) => x.join(""))
const filename = fc.oneof(
  fc.constantFrom(...excludedDirectories, "README.md", ".gitignore", "package.json"),
  fc.tuple(part, fc.constantFrom("", ".ts", ".md", ".custom")).map(([name, ext]) => `${name}${ext}`),
)
const root = fc.oneof(
  fc.constantFrom("src", "tests", "docs", "mystery", "builder"),
  part.map((name) => `unfamiliar-${name}`),
  part.map((name) => `packages/${name}`),
)
const acceptedPath = fc.oneof(
  filename,
  fc.tuple(root, part, filename).map(([base, dir, file]) => `${base}/${dir}/${file}`),
)

const distinctNames = fc.uniqueArray(part, { minLength: 2, maxLength: 2 })
const workspaceRoot = fc.constantFrom("src", "packages/api/src", "apps/web/src")
const nonemptyPaths = fc.uniqueArray(acceptedPath, { minLength: 1, maxLength: 70 })
const workspaceNames = fc.uniqueArray(filename, { minLength: 1, maxLength: 25 })

function groupFiles(groups: ReturnType<typeof analyzeRepositoryGroups>) {
  return groups.flatMap((group) => group.files)
}

function subgroupFiles(groups: ReturnType<typeof analyzeRepositoryGroups>) {
  return groups.flatMap((group) => group.subgroups.flatMap((subgroup) => subgroup.files))
}

// R1: Include every file not excluded by R2, even in unfamiliar folders.
// Kind: model/oracle. Compare both coverage levels to unique input paths, including empty inventories.
test("R1: accepted files appear exactly once in groups and subgroups", () => {
  fc.assert(
    fc.property(fc.array(acceptedPath, { maxLength: 80 }), (paths) => {
      const expected = [...new Set(paths)].sort()
      const groups = analyzeRepositoryGroups(paths)
      expect(groupFiles(groups).sort()).toEqual(expected)
      expect(subgroupFiles(groups).sort()).toEqual(expected)
    }),
    {
      numRuns: 200,
      examples: [
        [[]],
        [["build"]],
        [["README.md", "src/main.ts", "tests/main.test.ts", "docs/guide.md", "mystery/item.custom"]],
      ],
    },
  )
})

// R1: Include all accepted files even when groups or subgroups overflow.
// Kind: model/oracle. Distinct directories guarantee group/subgroup boundary coverage.
test.each([29, 30, 31, 50])("R1: preserves coverage with %i groups across subgroup boundaries", (count) => {
  fc.assert(
    fc.property(filename, fc.boolean(), (file, read) => {
      for (const areas of [19, 20, 21, 25]) {
        const paths = Array.from({ length: count }, (_, group) =>
          Array.from({ length: areas }, (_, area) => `packages/group-${group}/src/area-${area}/${file}`),
        ).flat()
        const groups = analyzeRepositoryGroups(paths, read ? paths : [])
        expect(groups).toHaveLength(Math.min(count, 30))
        expect(groups.every((group) => group.subgroups.length <= 20)).toBe(true)
        expect(groupFiles(groups).sort()).toEqual([...paths].sort())
        expect(subgroupFiles(groups).sort()).toEqual([...paths].sort())
        expect(groups.flatMap((group) => group.referencedFiles).sort()).toEqual(read ? [...paths].sort() : [])
        expect(groups.flatMap((group) => group.subgroups.flatMap((area) => area.referencedFiles)).sort()).toEqual(
          read ? [...paths].sort() : [],
        )
      }
    }),
    { numRuns: 30 },
  )
})

// R2: Exclude the six ignored directory names, keeping lookalike folders and matching filenames.
// Kind: invariant. Exercise every ignored name at arbitrary nesting depths.
test.each([...excludedDirectories])("R2: excludes the directory %s but keeps matching filenames", (ignored) => {
  fc.assert(
    fc.property(fc.array(part, { maxLength: 5 }), filename, (dirs, file) => {
      const prefix = dirs.length ? `${dirs.join("/")}/` : ""
      const hidden = `${prefix}${ignored}/${file}`
      const lookalike = `${prefix}${ignored}er/${file}`
      const matchingFile = `${prefix}${ignored}`
      const paths = [hidden, lookalike, matchingFile]
      const groups = analyzeRepositoryGroups(paths, paths)
      const expected = [lookalike, matchingFile].sort()
      expect(groupFiles(groups).sort()).toEqual(expected)
      expect(subgroupFiles(groups).sort()).toEqual(expected)
      expect(groups.flatMap((group) => group.referencedFiles).sort()).toEqual(expected)
    }),
    { numRuns: 200, examples: [[[], "main.ts"]] },
  )
})

// R3: Root files belong to Project root. If the 30-group cap combines that group,
// its files remain in the overflow group's lists and never in a named folder group.
// Kind: model/oracle. Vary ordinary root names and dotfiles in small repositories.
test("R3: only top-level files belong to Project root in small repositories", () => {
  fc.assert(
    fc.property(fc.uniqueArray(filename, { maxLength: 20 }), fc.uniqueArray(part, { maxLength: 10 }), (names, dirs) => {
      const roots = [...new Set([".gitignore", "package.json", "README.md", ...names])]
      const nested = ["src/main.ts", ...dirs.map((dir) => `${dir}/nested.ts`)]
      const groups = analyzeRepositoryGroups([...roots, ...nested])
      const project = groups.find((group) => group.id === ".")!
      expect(project.title).toBe("Project root")
      expect([...project.files].sort()).toEqual([...roots].sort())
      expect(project.subgroups.flatMap((area) => area.files).sort()).toEqual([...roots].sort())
      expect(groupFiles(groups.filter((group) => group.id !== ".")).sort()).toEqual([...nested].sort())
    }),
    { numRuns: 200 },
  )
})

// R4: Adding and deleting a file restores the deterministic map when other paths
// and session-referenced paths do not change.
// Kind: round-trip. Fixed references, existing/new folders, and inventories on both sides of the cap.
test("R4: temporary file addition and removal restores the map", () => {
  fc.assert(
    fc.property(part, fc.boolean(), (name, newGroup) => {
      for (const count of [0, 27, 28, 29, 31]) {
        const inventory = [
          "README.md",
          "docs/guide.md",
          "src/main.ts",
          ...Array.from({ length: count }, (_, i) => `area-${i}/main.ts`),
        ]
        const temporary = newGroup ? `scratch/${name}.md` : `docs/${name}.md`
        const referenced = ["src/main.ts"]
        const before = structuredClone(analyzeRepositoryGroups(inventory, referenced))
        inventory.push(temporary)
        const during = analyzeRepositoryGroups(inventory, referenced)
        expect(groupFiles(during)).toContain(temporary)
        expect(subgroupFiles(during)).toContain(temporary)
        inventory.pop()
        const after = analyzeRepositoryGroups(inventory, referenced)
        expect(after).toEqual(before)
        expect(groupFiles(after)).not.toContain(temporary)
        expect(after.some((group) => group.id === "scratch")).toBe(false)
      }
    }),
    { numRuns: 200 },
  )
})

// R5: Renaming an unread file within its folder preserves its group/subgroup,
// structural names, counts, and area ordering. File lists remain alphabetical.
// Kind: metamorphic. Distinct names and multiple groups/subgroups expose collateral changes.
test("R5: a same-folder rename preserves structural placement", () => {
  fc.assert(
    fc.property(distinctNames, workspaceRoot, (names, base) => {
      const oldPath = `${base}/auth/${names[0]}.ts`
      const newPath = `${base}/auth/${names[1]}.ts`
      const input = [oldPath, `${base}/auth/middle.ts`, `${base}/other/keep.ts`, "docs/guide.md"]
      const before = analyzeRepositoryGroups(input)
      const after = analyzeRepositoryGroups(input.map((path) => (path === oldPath ? newPath : path)))
      const expected = before.map((group) => ({
        ...group,
        files: group.files.map((path) => (path === oldPath ? newPath : path)).sort((a, b) => a.localeCompare(b)),
        subgroups: group.subgroups.map((area) => ({
          ...area,
          files: area.files.map((path) => (path === oldPath ? newPath : path)).sort((a, b) => a.localeCompare(b)),
        })),
      }))
      expect(after).toEqual(expected)
      expect(groupFiles(after)).not.toContain(oldPath)
      expect(groupFiles(after).filter((path) => path === newPath)).toHaveLength(1)
      expect(after.flatMap((group) => group.referencedFiles)).toEqual([])
      expect(after.flatMap((group) => group.subgroups.flatMap((area) => area.referencedFiles))).toEqual([])
    }),
    { numRuns: 200 },
  )
})

// R6: Repeated discovery must not list a path repeatedly in a group or subgroup.
// Kind: metamorphic. Always duplicate a path and independently verify complete coverage.
test("R6: duplicate input paths leave the complete map unchanged", () => {
  fc.assert(
    fc.property(nonemptyPaths, fc.integer({ min: 1, max: 10 }), (paths, copies) => {
      const repeated = paths[0]
      const expected = analyzeRepositoryGroups(paths, [repeated])
      const actual = analyzeRepositoryGroups([...paths, ...Array(copies).fill(repeated)], [repeated])
      expect(actual).toEqual(expected)
      expect(groupFiles(actual).sort()).toEqual([...paths].sort())
      expect(subgroupFiles(actual).sort()).toEqual([...paths].sort())
    }),
    { numRuns: 200 },
  )
})

// R7: packages/api and apps/web files belong to their own groups. A group combined
// by the cap may use the explicitly labeled overflow group, never another named
// workspace group. Full paths remain findable in group and subgroup file lists.
// Kind: invariant. Generate both source and test paths under each workspace root.
test("R7: package and app files stay in their respective groups in small repositories", () => {
  fc.assert(
    fc.property(workspaceNames, workspaceNames, (apiNames, webNames) => {
      const api = apiNames.map((file, i) => `packages/api/${i % 2 ? "test" : "src"}/auth/${file}`)
      const web = webNames.map((file, i) => `apps/web/${i % 2 ? "test" : "src"}/pages/${file}`)
      const groups = analyzeRepositoryGroups([...api, ...web])
      expect(groups).toHaveLength(2)
      for (const [id, paths] of [
        ["packages/api", api],
        ["apps/web", web],
      ] as const) {
        const group = groups.find((item) => item.id === id)!
        expect([...group.files].sort()).toEqual([...paths].sort())
        expect(group.subgroups.flatMap((area) => area.files).sort()).toEqual([...paths].sort())
      }
    }),
    { numRuns: 200 },
  )
})

// R3/R7: Root and workspace files retain ownership, including overflow at the 30-group cap.
// Kind: invariant. Larger competitors force unread targets into overflow. References retain named groups.
for (const requirement of ["R3", "R7"]) {
  test.each([29, 30, 31, 50])(`${requirement}: preserves ownership at %i groups`, (count) => {
    fc.assert(
      fc.property(filename, fc.boolean(), (file, read) => {
        const targets =
          requirement === "R3"
            ? [[".", file]]
            : [
                ["packages/api", `packages/api/src/auth/${file}`],
                ["apps/web", `apps/web/src/pages/${file}`],
              ]
        const paths = targets.map(([, path]) => path)
        const others = Array.from({ length: count - targets.length }, (_, i) => [
          `area-${i}/one.ts`,
          `area-${i}/two.ts`,
        ]).flat()
        const groups = analyzeRepositoryGroups([...others, ...paths], read ? paths : [])
        const overflow = count > 30 && !read
        for (const [id, path] of targets) {
          const owner = groups.find((group) => group.files.includes(path))!
          expect(owner.id).toBe(overflow ? "other-repository-groups" : id)
          if (id === ".") expect(owner.title).toBe(overflow ? "Other repository groups" : "Project root")
          expect(owner.subgroups.flatMap((area) => area.files).filter((file) => file === path)).toEqual([path])
          expect(groupFiles(groups).filter((file) => file === path)).toEqual([path])
          for (const [otherId] of targets.filter(([otherId]) => otherId !== id)) {
            expect(groups.find((group) => group.id === otherId)?.files ?? []).not.toContain(path)
          }
        }
      }),
      { numRuns: 50 },
    )
  })
}
