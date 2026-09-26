import { groupReferencedFiles } from "./referenced-file-role"

type SessionPart = {
  type: string
  tool?: string
  state?: {
    status: string
    input?: unknown
    metadata?: unknown
  }
}

export const referencedFileCommand = {
  title: "Group referenced files",
  value: "session.references.group",
  category: "Session",
  slash: {
    name: "group",
    aliases: [],
  },
} as const

export function collectReferencedFiles(parts: readonly SessionPart[]) {
  const seen = new Set<string>()

  return parts.flatMap((part) => {
    const filePath = referencedFilePath(part)
    if (!filePath) return []

    const normalized = filePath.replaceAll("\\", "/")
    if (seen.has(normalized)) return []
    seen.add(normalized)
    return [normalized]
  })
}

export function collectReferencedFileOverview(parts: readonly SessionPart[]) {
  const files = collectReferencedFiles(parts)
  return {
    files,
    groups: groupReferencedFiles(files),
  }
}

export function referencedFileCountMessage(count: number) {
  if (count === 0) return "No referenced files in this session"
  if (count === 1) return "Found 1 referenced file"
  return `Found ${count} referenced files`
}

function referencedFilePath(part: SessionPart) {
  if (part.type !== "tool" || part.tool !== "read" || part.state?.status !== "completed") return

  const display = record(part.state.metadata)?.display
  const displayRecord = record(display)
  if (displayRecord?.type === "directory") return
  if (displayRecord?.type === "file" && typeof displayRecord.path === "string") return displayRecord.path

  const filePath = record(part.state.input)?.filePath
  if (typeof filePath !== "string" || !filePath.trim()) return
  return filePath
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  return value as Record<string, unknown>
}
