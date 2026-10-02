export type LearningArea = {
  id: string
  title: string
  root: string
  files: string[]
  referencedFiles: string[]
}

export type FunctionalGroup = LearningArea & { subgroups: LearningArea[] }

const ignored = new Set([".git", "node_modules", "coverage", "dist", "build", ".turbo"])
const sourceRoots = new Set(["src", "lib", "test", "tests", "spec"])
const workspaceRoots = new Set(["apps", "packages", "modules", "services"])

function normalize(file: string) {
  return file
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/{2,}/g, "/")
}

function label(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (x) => x.toUpperCase())
}

function groupRoot(file: string) {
  const dirs = file.split("/").slice(0, -1)
  if (!dirs.length) return "."
  return workspaceRoots.has(dirs[0]) && dirs[1] ? dirs.slice(0, 2).join("/") : dirs[0]
}

function subgroupRoot(file: string, root: string) {
  const dirs = file.split("/").slice(0, -1)
  const source = dirs.findIndex((part) => sourceRoots.has(part))
  if (source >= 0 && dirs[source + 1]) return `${root}/${dirs[source + 1]}`
  const relative = dirs.slice(root === "." ? 0 : root.split("/").length)
  return relative[0] ? `${root}/${relative[0]}` : `${root}/project-files`
}

function rank<T extends LearningArea>(areas: T[]) {
  return areas.sort(
    (a, b) =>
      b.referencedFiles.length - a.referencedFiles.length ||
      b.files.length - a.files.length ||
      a.title.localeCompare(b.title),
  )
}

function limit<T extends LearningArea>(areas: T[], maximum: number, overflow: (rest: T[]) => T) {
  const ordered = rank(areas)
  if (ordered.length <= maximum) return ordered
  return [...ordered.slice(0, maximum - 1), overflow(ordered.slice(maximum - 1))]
}

export function analyzeRepositoryGroups(input: readonly string[], referencedFiles: readonly string[] = []) {
  const files = [...new Set(input.map(normalize))]
    .filter((file) => file && !file.split("/").some((part) => ignored.has(part)))
    .sort((a, b) => a.localeCompare(b))
  const referenced = new Set(referencedFiles.map(normalize))
  const groups = new Map<string, FunctionalGroup>()

  for (const file of files) {
    const root = groupRoot(file)
    const group = groups.get(root) ?? {
      id: root,
      title: root === "." ? "Project root" : label(root.split("/").at(-1)!),
      root,
      files: [],
      referencedFiles: [],
      subgroups: [],
    }
    group.files.push(file)
    if (referenced.has(file)) group.referencedFiles.push(file)
    groups.set(root, group)
  }

  for (const group of groups.values()) {
    const subgroups = new Map<string, LearningArea>()
    for (const file of group.files) {
      const root = subgroupRoot(file, group.root)
      const subgroup = subgroups.get(root) ?? {
        id: root,
        title: label(root.split("/").at(-1)!),
        root,
        files: [],
        referencedFiles: [],
      }
      subgroup.files.push(file)
      if (referenced.has(file)) subgroup.referencedFiles.push(file)
      subgroups.set(root, subgroup)
    }
    group.subgroups = limit([...subgroups.values()], 20, (rest) => ({
      id: `${group.id}/other`,
      title: "Other areas",
      root: group.root,
      files: rest.flatMap((item) => item.files),
      referencedFiles: rest.flatMap((item) => item.referencedFiles),
    }))
  }

  return limit([...groups.values()], 30, (rest) => ({
    id: "other-repository-groups",
    title: "Other repository groups",
    root: ".",
    files: rest.flatMap((item) => item.files),
    referencedFiles: rest.flatMap((item) => item.referencedFiles),
    subgroups: rest.flatMap((item) => item.subgroups),
  }))
}
