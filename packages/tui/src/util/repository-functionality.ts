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

function commonDirectory(files: readonly string[]) {
  const directories = files.map((file) => file.split("/").slice(0, -1))
  const first = directories[0] ?? []
  const difference = first.findIndex((part, index) => directories.some((directory) => directory[index] !== part))
  return first.slice(0, difference < 0 ? first.length : difference).join("/") || "."
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
    // Subgroup IDs combine related source and test areas; they are not filesystem paths.
    for (const subgroup of subgroups.values()) subgroup.root = commonDirectory(subgroup.files)
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
    subgroups: limit(rest.flatMap((item) => item.subgroups), 20, (subgroups) => ({
      id: "other-repository-groups/other",
      title: "Other areas",
      root: ".",
      files: subgroups.flatMap((item) => item.files),
      referencedFiles: subgroups.flatMap((item) => item.referencedFiles),
    })),
  }))
}

export function buildGroupNamingPrompt(groups: readonly FunctionalGroup[]) {
  return [
    "Give each repository group a concise, beginner-friendly functionality name.",
    "Return only a JSON object mapping each exact group id to a name of at most four words.",
    ...groups.flatMap((group) => [
      `Group: ${group.id}`,
      ...[...new Set([...group.referencedFiles, ...group.files])].slice(0, 5).map((file) => `- ${file}`),
    ]),
  ].join("\n")
}

export function applyGroupNames(groups: readonly FunctionalGroup[], response: string) {
  try {
    const names = JSON.parse(response.slice(response.indexOf("{"), response.lastIndexOf("}") + 1)) as Record<
      string,
      unknown
    >
    return groups.map((group) => {
      const title = names[group.id]
      return typeof title === "string" && title.trim() ? { ...group, title: title.trim().slice(0, 50) } : group
    })
  } catch {
    return [...groups]
  }
}

export function buildFunctionalGroupPrompt(area: LearningArea, groups: readonly FunctionalGroup[]) {
  const files = [...new Set([...area.referencedFiles, ...area.files])].slice(0, 15)
  return [
    `Teach me the ${area.title} functionality in this repository.`,
    `Area root: ${area.root}`,
    "Representative files:",
    ...files.map((file) => `- ${file}`),
    ...(area.files.length > files.length ? [`- (${area.files.length - files.length} additional files omitted)`] : []),
    "",
    "Other groups:",
    ...groups
      .filter((group) => group.id !== area.id)
      .flatMap((group) => [
        `- ${group.title} (${group.root})`,
        ...group.files.slice(0, 2).map((file) => `  - ${file}`),
      ]),
    "",
    "Read relevant files, explain this area's responsibility and important files, and identify evidence-backed relationships to other groups. For each relationship, explain its direction and cite concrete import, call, shared-data, or configuration evidence. Do not invent relationships.",
    "Finish with a short reading order and one question to check my understanding. Cite file paths for project-specific claims.",
  ].join("\n")
}
