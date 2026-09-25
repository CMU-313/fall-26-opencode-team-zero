export const referencedFileRoles = ["source", "test", "configuration", "documentation", "other"] as const

export type ReferencedFileRole = (typeof referencedFileRoles)[number]

export type ReferencedFileGroup = {
  role: ReferencedFileRole
  files: string[]
}

const sourceExtensions = new Set([
  "c",
  "cc",
  "cpp",
  "cs",
  "css",
  "dart",
  "ex",
  "exs",
  "go",
  "h",
  "hpp",
  "html",
  "java",
  "js",
  "jsx",
  "kt",
  "kts",
  "lua",
  "php",
  "py",
  "rb",
  "rs",
  "scss",
  "sh",
  "sql",
  "svelte",
  "swift",
  "ts",
  "tsx",
  "vue",
])

const documentationExtensions = new Set(["adoc", "md", "mdx", "rst"])
const configurationExtensions = new Set(["ini", "lock", "toml", "yaml", "yml"])
const configurationNames = new Set([
  ".babelrc",
  ".dockerignore",
  ".editorconfig",
  ".env",
  ".envrc",
  ".eslintignore",
  ".eslintrc",
  ".gitattributes",
  ".gitignore",
  ".npmrc",
  ".nvmrc",
  ".prettierignore",
  ".prettierrc",
  "bun.lock",
  "cargo.lock",
  "cargo.toml",
  "composer.json",
  "dockerfile",
  "gemfile",
  "go.mod",
  "go.sum",
  "makefile",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "pyproject.toml",
  "requirements.txt",
  "tsconfig.json",
  "yarn.lock",
])

export function classifyReferencedFile(filePath: string): ReferencedFileRole {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase()
  const segments = normalized.split("/").filter(Boolean)
  const filename = segments.at(-1) ?? ""
  const extension = filename.includes(".") ? (filename.split(".").at(-1) ?? "") : ""

  if (segments.includes(".github")) return "configuration"

  if (
    segments.some((segment) => segment === "test" || segment === "tests" || segment === "__tests__") ||
    /(^|[._-])(test|tests|spec)([._-]|$)/.test(filename)
  ) {
    return "test"
  }

  if (
    segments.some((segment) => segment === "docs" || segment === "documentation") ||
    /^readme(?:\.|$)/.test(filename) ||
    documentationExtensions.has(extension)
  ) {
    return "documentation"
  }

  if (
    configurationNames.has(filename) ||
    configurationExtensions.has(extension) ||
    /(^|[._-])(config|configuration|settings)([._-]|$)/.test(filename) ||
    /^\.env(?:\.|$)/.test(filename)
  ) {
    return "configuration"
  }

  if (sourceExtensions.has(extension)) return "source"
  return "other"
}

export function groupReferencedFiles(files: readonly string[]): ReferencedFileGroup[] {
  const groups = new Map<ReferencedFileRole, string[]>(referencedFileRoles.map((role) => [role, []]))

  for (const file of files) groups.get(classifyReferencedFile(file))!.push(file)

  return referencedFileRoles.flatMap((role) => {
    const grouped = groups.get(role)!
    return grouped.length ? [{ role, files: grouped }] : []
  })
}
