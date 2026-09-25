type SessionPart = {
  type: string
  tool?: string
  state?: {
    status: string
    input?: unknown
    metadata?: unknown
  }
}

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
