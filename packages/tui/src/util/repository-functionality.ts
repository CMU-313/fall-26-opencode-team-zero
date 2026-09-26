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

function words(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function withoutTestSuffix(filename: string) {
  return filename.replace(/\.(test|spec)\.(tsx?|jsx?)$/, ".$2")
}

function boundary(segments: string[]) {
  if ((segments[0] === "packages" || segments[0] === "apps") && segments[1]) {
    return { root: segments.slice(0, 2).join("/"), offset: 2, label: words(segments[1]) }
  }
  return { root: ".", offset: 0, label: "Project" }
}

function featureFor(file: string, sourceByBasename: Map<string, string>) {
  const segments = file.split("/")
  const workspace = boundary(segments)
  const local = segments.slice(workspace.offset)
  const areaIndex = local.findIndex((segment) => segment === "src" || segment === "test" || segment === "tests")
  const area = areaIndex === -1 ? undefined : local[areaIndex]
  const afterArea = areaIndex === -1 ? local : local.slice(areaIndex + 1)
  const filename = segments.at(-1) ?? file

  if (area === "test" || area === "tests") {
    const source = sourceByBasename.get(`${workspace.root}:${withoutTestSuffix(filename)}`)
    if (source) return featureFor(source, sourceByBasename)
  }

  if (area === "src" || area === "test" || area === "tests") {
    const directories = afterArea.slice(0, -1)
    const feature = directories.slice(0, 2).join("/") || "core"
    return {
      id: `${workspace.root}:${feature}`,
      root: [
        workspace.root === "." ? "" : workspace.root,
        area === "src" ? "src" : area,
        feature === "core" ? "" : feature,
      ]
        .filter(Boolean)
        .join("/"),
      title:
        feature === "core" ? `${workspace.label} Core` : `${words(feature.split("/").at(-1)!)} (${workspace.label})`,
    }
  }

  const role = /^(readme|docs?\b)/i.test(filename)
    ? "documentation"
    : /(^|\.)(json|ya?ml|toml|lock)$/.test(filename) || /config/i.test(filename)
      ? "infrastructure"
      : "resources"
  return { id: `${workspace.root}:${role}`, root: workspace.root, title: `${workspace.label} ${words(role)}` }
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
  const sourceByBasename = new Map(
    unique
      .filter((item) => item.path.split("/").includes("src"))
      .map((item) => {
        const segments = item.path.split("/")
        return [`${boundary(segments).root}:${segments.at(-1)!}`, item.path]
      }),
  )
  const referenced = new Set(referencedFiles.map(normalize))
  const grouped = new Map<string, FunctionalGroup>()
  const fileRecords: FileRecord[] = []

  for (const item of unique) {
    const feature = featureFor(item.path, sourceByBasename)
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

  return [...grouped.values()].sort((a, b) => a.title.localeCompare(b.title))
}
