export const referencedFileRoles = ["source", "test", "configuration", "documentation", "other"] as const

export type ReferencedFileRole = (typeof referencedFileRoles)[number]

export type ReferencedFileGroup = {
  role: ReferencedFileRole
  files: string[]
}

export type ReferencedFileClassification = {
  role: ReferencedFileRole
  reason: string
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

function isConfigurationName(filename: string) {
  if (configurationNames.has(filename)) return true
  if (/^(tsconfig|jsconfig)(?:\..+)?\.json$/.test(filename)) return true
  return /^\.(babelrc|eslintrc|prettierrc)(?:\..+)?$/.test(filename)
}

export function classifyReferencedFile(filePath: string): ReferencedFileRole {
  return explainReferencedFileRole(filePath).role
}

export function explainReferencedFileRole(filePath: string): ReferencedFileClassification {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase()
  const segments = normalized.split("/").filter(Boolean)
  const filename = segments.at(-1) ?? ""
  const extension = filename.includes(".") ? (filename.split(".").at(-1) ?? "") : ""

  if (segments.includes(".github")) {
    return { role: "configuration", reason: "It is inside the .github configuration directory." }
  }

  if (segments.some((segment) => segment === "test" || segment === "tests" || segment === "__tests__")) {
    return { role: "test", reason: "It is inside a recognized test directory." }
  }

  if (/(^|[._-])(test|tests|spec)([._-]|$)/.test(filename)) {
    return { role: "test", reason: "Its filename follows a recognized test or spec convention." }
  }

  if (segments.some((segment) => segment === "docs" || segment === "documentation")) {
    return { role: "documentation", reason: "It is inside a documentation directory." }
  }

  if (/^readme(?:\.|$)/.test(filename)) {
    return { role: "documentation", reason: "Its filename identifies it as a project README." }
  }

  if (documentationExtensions.has(extension)) {
    return { role: "documentation", reason: `Its .${extension} extension is commonly used for documentation.` }
  }

  if (isConfigurationName(filename)) {
    return { role: "configuration", reason: "Its filename is a recognized project configuration file." }
  }

  if (configurationExtensions.has(extension)) {
    return { role: "configuration", reason: `Its .${extension} extension is commonly used for configuration.` }
  }

  if (/(^|[._-])(config|configuration|settings)([._-]|$)/.test(filename)) {
    return { role: "configuration", reason: "Its filename contains a configuration convention." }
  }

  if (/^\.env(?:\.|$)/.test(filename)) {
    return { role: "configuration", reason: "Its filename identifies it as an environment configuration file." }
  }

  if (sourceExtensions.has(extension)) {
    return { role: "source", reason: `Its .${extension} extension is commonly used for source code.` }
  }

  return {
    role: "other",
    reason: "It does not match a recognized source, test, configuration, or documentation convention.",
  }
}

export function groupReferencedFiles(files: readonly string[]): ReferencedFileGroup[] {
  const groups = new Map<ReferencedFileRole, string[]>(referencedFileRoles.map((role) => [role, []]))

  for (const file of files) groups.get(classifyReferencedFile(file))!.push(file)

  return referencedFileRoles.flatMap((role) => {
    const grouped = groups.get(role)!
    return grouped.length ? [{ role, files: grouped }] : []
  })
}

export function buildReferencedFileGroupPrompt(group: ReferencedFileGroup) {
  const files = group.files.map((file) => `- ${file}`).join("\n")
  return [
    `Explain the ${group.role} file group in this specific project:`,
    files,
    "",
    "Base the explanation on evidence from these files and the current conversation, not generic descriptions.",
    "Explain what the files do, how they relate to each other, and how they support or challenge the answer to my previous question.",
    "Recommend a reading order and one concrete question I should be able to answer after reading them.",
    "Cite the relevant file path for every project-specific claim. Re-read the listed files if needed.",
  ].join("\n")
}
