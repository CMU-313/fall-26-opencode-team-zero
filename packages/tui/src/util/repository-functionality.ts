export type FunctionalGroup = {
  id: string
  title: string
  root: string
  files: string[]
  referencedFiles: string[]
}

const ignoredSegments = new Set([".git", "node_modules", "coverage", "dist", "build", ".turbo"])
const sourceRoots = new Set(["src", "lib", "test", "tests", "spec"])
const workspaceRoots = new Set(["apps", "packages", "modules", "services"])
const maxGroups = 30

function normalize(file: string) {
  return file
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/{2,}/g, "/")
}

function areaRoot(file: string) {
  const directories = file.split("/").slice(0, -1)
  if (!directories.length) return "."

  const source = directories.findIndex((segment) => sourceRoots.has(segment))
  if (source >= 0 && directories[source + 1]) {
    return [...directories.slice(0, source), directories[source + 1]].join("/")
  }
  if (workspaceRoots.has(directories[0]) && directories[1]) return directories.slice(0, 2).join("/")
  return directories[0]
}

function label(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

function areaTitle(root: string) {
  if (root === ".") return "Project root"
  const segments = root.split("/")
  const area = label(segments.at(-1)!)
  const workspace = workspaceRoots.has(segments[0]) ? segments[1] : segments.length > 1 ? segments[0] : undefined
  return workspace && label(workspace) !== area ? `${area} · ${label(workspace)}` : area
}

export function analyzeRepositoryGroups(input: readonly string[], referencedFiles: readonly string[] = []) {
  const files = [...new Set(input.map(normalize))]
    .filter((file) => file && !file.split("/").some((segment) => ignoredSegments.has(segment)))
    .sort((a, b) => a.localeCompare(b))
  const referenced = new Set(referencedFiles.map(normalize))
  const grouped = new Map<string, FunctionalGroup>()

  for (const file of files) {
    const root = areaRoot(file)
    const group = grouped.get(root) ?? {
      id: root,
      title: areaTitle(root),
      root,
      files: [],
      referencedFiles: [],
    }
    group.files.push(file)
    if (referenced.has(file)) group.referencedFiles.push(file)
    grouped.set(root, group)
  }

  const ranked = [...grouped.values()].sort(
    (a, b) =>
      b.referencedFiles.length - a.referencedFiles.length ||
      b.files.length - a.files.length ||
      a.title.localeCompare(b.title),
  )
  if (ranked.length <= maxGroups) return ranked

  const visible = ranked.slice(0, maxGroups - 1)
  const remaining = ranked.slice(maxGroups - 1)
  visible.push({
    id: "other-repository-areas",
    title: "Other repository areas",
    root: ".",
    files: remaining.flatMap((group) => group.files).sort((a, b) => a.localeCompare(b)),
    referencedFiles: remaining.flatMap((group) => group.referencedFiles),
  })
  return visible
}

export function buildGroupNamingPrompt(groups: readonly FunctionalGroup[]) {
  return [
    "Give each repository area a concise, beginner-friendly functionality name.",
    "Infer names only from the path and representative files. Return only a JSON object mapping each exact area id to a name of at most four words.",
    ...groups.flatMap((group) => [`Area: ${group.id}`, ...group.files.slice(0, 5).map((file) => `- ${file}`)]),
  ].join("\n")
}

export function applyGroupNames(groups: readonly FunctionalGroup[], response: string) {
  try {
    const start = response.indexOf("{")
    const end = response.lastIndexOf("}")
    const names = JSON.parse(response.slice(start, end + 1)) as Record<string, unknown>
    return groups.map((group) => {
      const title = names[group.id]
      return typeof title === "string" && title.trim() ? { ...group, title: title.trim().slice(0, 50) } : group
    })
  } catch {
    return [...groups]
  }
}

export function buildFunctionalGroupPrompt(group: FunctionalGroup, groups: readonly FunctionalGroup[]) {
  const files = [...new Set([...group.referencedFiles, ...group.files])].slice(0, 15)
  const others = groups.filter((item) => item.id !== group.id)
  return [
    `Teach me what functionality the repository area ${group.title} supports.`,
    `This area contains ${group.files.length} files. Inspect these representative files:`,
    ...files.map((file) => `- ${file}`),
    ...(group.files.length > files.length ? [`- (${group.files.length - files.length} additional files omitted)`] : []),
    "",
    "Files already referenced in this session:",
    ...(group.referencedFiles.length ? group.referencedFiles.slice(0, 8).map((file) => `- ${file}`) : ["- None"]),
    "",
    "Other repository groups:",
    ...others.flatMap((item) => [
      `- ${item.title} (${item.root})`,
      ...item.files.slice(0, 2).map((file) => `  - ${file}`),
    ]),
    "",
    "Read the relevant files before answering. Infer a concise functionality name for this area, explain its responsibility and how its important files work together, then give a short reading order and one question to check my understanding.",
    "Identify its most important relationships with the other groups. For each relationship, explain the direction and cite concrete import, call, shared-data, or configuration evidence. Do not invent a relationship when repository evidence is unavailable.",
    "Cite file paths for repository-specific claims and clearly label inferences.",
  ].join("\n")
}
