import path from "path"

export type RepositoryFile = { path: string; imports?: readonly string[] }

export type GroupRelationship = {
  from: string
  to: string
  kind: "imports"
  evidence: string[]
}

export type FunctionalGroup = {
  id: string
  title: string
  root: string
  files: string[]
  referencedFiles: string[]
  entryFiles: string[]
  relationships: GroupRelationship[]
}

type FileRecord = RepositoryFile & { groupID: string }

const entryNames = new Set(["index.ts", "index.tsx", "index.js", "index.jsx", "main.ts", "main.tsx", "main.js"])
const ignoredSegments = new Set([".git", "node_modules", "coverage", "dist", "build", ".turbo"])

function normalize(file: string) {
  return file
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/{2,}/g, "/")
}

const packageAreas: Record<string, string> = {
  app: "Shared User Interface",
  ui: "Shared User Interface",
  "session-ui": "Shared User Interface",
  web: "Web Application",
  desktop: "Desktop Application",
  tui: "Terminal User Interface",
  core: "Core Infrastructure",
  sdk: "SDK and Extensions",
  plugin: "SDK and Extensions",
  llm: "Model Integration",
  console: "Cloud and Console",
  enterprise: "Cloud and Console",
  stats: "Cloud and Console",
  cli: "Command Line Interface",
  codemode: "Code Mode",
}

const opencodeAreas: Record<string, string> = {
  agent: "Agent System",
  command: "Agent System",
  skill: "Agent System",
  session: "Session Runtime",
  question: "Session Runtime",
  permission: "Session Runtime",
  provider: "Models and Providers",
  auth: "Models and Providers",
  account: "Models and Providers",
  server: "Server and API",
  storage: "Project Storage",
  project: "Project Storage",
  worktree: "Project Storage",
  git: "Project Storage",
  snapshot: "Project Storage",
  tool: "Developer Tools",
  patch: "Developer Tools",
  format: "Developer Tools",
  lsp: "Developer Tools",
  mcp: "Developer Tools",
  ide: "Developer Tools",
  cli: "Command Line Interface",
  config: "Configuration and Installation",
  env: "Configuration and Installation",
  installation: "Configuration and Installation",
  sync: "Runtime Services",
  share: "Runtime Services",
  "control-plane": "Runtime Services",
  background: "Runtime Services",
  bus: "Runtime Services",
  effect: "Runtime Services",
}

function areaID(title: string) {
  return title.toLowerCase().replaceAll(" ", "-")
}

function functionalityFor(file: string) {
  const segments = file.split("/")
  const filename = segments.at(-1) ?? file
  if (segments[0] !== "packages") {
    const title =
      /^(readme|docs?\b)/i.test(filename) || segments.includes("docs")
        ? "Project Documentation"
        : "Project Infrastructure"
    return { id: areaID(title), root: ".", title }
  }

  const packageName = segments[1] ?? ""
  if (packageName === "opencode") {
    const boundary = segments.findIndex((segment) => segment === "src" || segment === "test" || segment === "tests")
    const domain = boundary === -1 ? "" : (segments[boundary + 1] ?? "")
    const title = opencodeAreas[domain] ?? "OpenCode Runtime"
    return {
      id: areaID(title),
      root: `packages/opencode/${boundary === -1 ? "" : segments[boundary]}`.replace(/\/$/, ""),
      title,
    }
  }

  const title = packageAreas[packageName] ?? "Supporting Packages"
  return { id: areaID(title), root: `packages/${packageName}`, title }
}

function resolveImport(source: string, target: string, files: Set<string>) {
  if (!target.startsWith(".")) return
  const base = normalize(path.posix.join(path.posix.dirname(source), target))
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]
  return candidates.find((candidate) => files.has(candidate))
}

export function analyzeRepositoryGroups(
  input: readonly (string | RepositoryFile)[],
  referencedFiles: readonly string[] = [],
): FunctionalGroup[] {
  const records = input
    .map((item) => (typeof item === "string" ? { path: item } : item))
    .map((item) => ({ ...item, path: normalize(item.path) }))
    .filter((item) => item.path && !item.path.split("/").some((segment) => ignoredSegments.has(segment)))
  const unique = [...new Map(records.map((item) => [item.path, item])).values()].sort((a, b) =>
    a.path.localeCompare(b.path),
  )
  const referenced = new Set(referencedFiles.map(normalize))
  const grouped = new Map<string, FunctionalGroup>()
  const fileRecords: FileRecord[] = []

  for (const item of unique) {
    const feature = functionalityFor(item.path)
    const group = grouped.get(feature.id) ?? {
      ...feature,
      files: [],
      referencedFiles: [],
      entryFiles: [],
      relationships: [],
    }
    group.files.push(item.path)
    if (referenced.has(item.path)) group.referencedFiles.push(item.path)
    if (entryNames.has(item.path.split("/").at(-1)!)) group.entryFiles.push(item.path)
    grouped.set(feature.id, group)
    fileRecords.push({ ...item, groupID: feature.id })
  }

  const fileSet = new Set(unique.map((item) => item.path))
  const groupByFile = new Map(fileRecords.map((item) => [item.path, item.groupID]))
  const relationships = new Map<string, GroupRelationship>()
  for (const source of fileRecords) {
    for (const imported of source.imports ?? []) {
      const target = resolveImport(source.path, imported, fileSet)
      const targetGroup = target ? groupByFile.get(target) : undefined
      if (!targetGroup || targetGroup === source.groupID) continue
      const key = `${source.groupID}->${targetGroup}`
      const relationship = relationships.get(key) ?? {
        from: source.groupID,
        to: targetGroup,
        kind: "imports" as const,
        evidence: [],
      }
      relationship.evidence.push(`${source.path} imports ${target}`)
      relationships.set(key, relationship)
    }
  }
  for (const relationship of relationships.values()) grouped.get(relationship.from)?.relationships.push(relationship)

  return [...grouped.values()].sort(
    (a, b) => b.referencedFiles.length - a.referencedFiles.length || a.title.localeCompare(b.title),
  )
}

export function buildFunctionalGroupPrompt(group: FunctionalGroup, groups: readonly FunctionalGroup[]) {
  const selectedFiles = [...new Set([...group.referencedFiles, ...group.entryFiles, ...group.files])].slice(0, 12)
  const relationships = [
    ...group.relationships.map((item) => ({ ...item, direction: "outgoing" as const })),
    ...groups.flatMap((item) =>
      item.relationships
        .filter((relationship) => relationship.to === group.id)
        .map((relationship) => ({ ...relationship, direction: "incoming" as const })),
    ),
  ]
  const related = groups
    .filter(
      (item) =>
        item.id !== group.id &&
        (relationships.some((edge) => edge.from === item.id || edge.to === item.id) ||
          item.root.split("/").slice(0, 2).join("/") === group.root.split("/").slice(0, 2).join("/")),
    )
    .slice(0, 8)

  return [
    `Teach me the ${group.title} functionality in this specific repository.`,
    `Group root: ${group.root}`,
    `Group size: ${group.files.length} files`,
    "",
    "Priority files to inspect:",
    ...selectedFiles.map((file) => `- ${file}`),
    ...(group.files.length > selectedFiles.length
      ? [`- (${group.files.length - selectedFiles.length} additional files omitted)`]
      : []),
    "",
    "Session-referenced evidence:",
    ...(group.referencedFiles.length ? group.referencedFiles.slice(0, 8).map((file) => `- ${file}`) : ["- None yet"]),
    "",
    "Evidence-backed relationships:",
    ...(relationships.length
      ? relationships
          .slice(0, 8)
          .flatMap((edge) => [
            `- ${edge.direction}: ${edge.from} ${edge.kind} ${edge.to}`,
            ...edge.evidence.slice(0, 2).map((evidence) => `  Evidence: ${evidence}`),
          ])
      : ["- No cross-group relationship has been established; do not invent one."]),
    "",
    "Nearby functionality groups:",
    ...(related.length ? related.map((item) => `- ${item.title} (${item.files.length} files)`) : ["- None"]),
    "",
    "Read the priority files before answering and base every project-specific claim on repository evidence.",
    "Explain this group's responsibility, its important files, and how established relationships support the current conversation.",
    "Give a short recommended reading order and one concrete question I should be able to answer afterward.",
    "Cite file paths for project-specific claims. Clearly label inferences, and do not generate an ASCII diagram.",
  ].join("\n")
}
