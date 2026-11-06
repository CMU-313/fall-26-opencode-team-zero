import { expect, mock, spyOn, test } from "bun:test"
import fc from "fast-check"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

// Command-level tests use the real extension and prompt builders. VS Code is not
// available in Bun, so only its editor/terminal boundary is replaced. The HTTP
// server captures real append/submit requests; no model response is fabricated.
// Traceability entries (the user's file restriction excludes editing the table):
// R1 | current selection survives renaming (metamorphic) | R1 test below
// R2 | earlier called definitions reach the request (invariant) | R2 test below
// R3 | active file/cursor reach the request (invariant; partial) | suggestions file
// R5 | requesting either feature preserves files (invariant) | suggestions file

export const identifier = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), { minLength: 1, maxLength: 16 })
  .map((letters) => `value_${letters.join("")}`)

// Valid identifiers avoid vacuous syntax errors. Distinct names expose stale
// selections. Fence runs, Unicode, CRLF, blank text, and final newlines exercise
// lossless transport instead of just generating arbitrary unrelated strings.
export const sourceText = fc.oneof(
  fc.constantFrom("", "\n", "\r\n", "// café λ 😀\n", "// ```\n", "// ````````\r\n"),
  fc.string({ maxLength: 200 }),
)

export const program = fc.record({
  name: identifier,
  amount: fc.integer({ min: -1000, max: 1000 }),
  padding: fc.integer({ min: 0, max: 65 }),
  newline: fc.constantFrom("\n", "\r\n"),
})

const host = {
  editor: undefined as undefined | ReturnType<typeof editor>,
  terminals: [] as { name: string; creationOptions: { env: Record<string, string> }; show(): void }[],
  commands: new Map<string, () => Promise<void>>(),
}

class Range {
  constructor(
    public startLine: number,
    public startCharacter: number,
    public endLine: number,
    public endCharacter: number,
  ) {}
}

mock.module("vscode", () => ({
  window: {
    get activeTextEditor() {
      return host.editor
    },
    get terminals() {
      return host.terminals
    },
    showInformationMessage: (message: string) => {
      throw new Error(message)
    },
    showErrorMessage: (message: string) => {
      throw new Error(message)
    },
  },
  workspace: {
    getWorkspaceFolder: () => ({}),
    asRelativePath: (uri: { fsPath: string }) => path.basename(uri.fsPath),
  },
  commands: {
    registerCommand: (id: string, callback: () => Promise<void>) => {
      host.commands.set(id, callback)
      return { dispose() {} }
    },
  },
  Range,
}))

// The SDK is outside the root Bun workspaces and owns its VS Code typecheck.
// Load it at runtime so opencode's typecheck does not require SDK-only types.
// This contract describes the mocked host, not the full VS Code context.
const extensionPath = path.resolve(import.meta.dir, "../../../../sdks/vscode/src/extension.ts")
const { activate } = (await import(extensionPath)) as {
  activate(context: { subscriptions: { dispose(): void }[] }): void
}
activate({ subscriptions: [] })

function editor(file: string, text: string, start: number, end: number, character: number) {
  const lines = text.split("\n")
  return {
    document: {
      uri: { fsPath: file },
      languageId: "typescript",
      lineCount: lines.length,
      lineAt: (line: number) => ({ text: lines[line] }),
      getText: (range: Range | { start: { line: number }; end: { line: number; character: number } }) => {
        const first = range instanceof Range ? range.startLine : range.start.line
        const last = range instanceof Range ? range.endLine : range.end.line
        const column = range instanceof Range ? range.endCharacter : range.end.character
        return lines
          .slice(first, last + 1)
          .map((line, index) => (index === last - first ? line.slice(0, column) : line))
          .join("\n")
      },
    },
    selection: {
      isEmpty: start === end && lines[start].length === 0,
      start: { line: start, character: 0 },
      end: { line: end, character: lines[end].length },
      active: { line: start, character },
    },
  }
}

export async function request(input: {
  command: "explainSelection" | "suggestCode"
  text: string
  saved: string
  other: string
  start: number
  end: number
  character: number
}) {
  const directory = await mkdtemp(path.join(tmpdir(), "opencode-properties-"))
  const files = [path.join(directory, "active.ts"), path.join(directory, "other.ts")]
  const prompts: string[] = []
  const endpoints: string[] = []
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const endpoint = new URL(req.url).pathname
      endpoints.push(endpoint)
      if (endpoint === "/tui/append-prompt") prompts.push((await req.json()).text)
      return new Response("ok")
    },
  })
  // Only readiness waits are shortened. This property is about editor data and
  // file preservation, not server startup timing. Restore the clock after each run.
  const timeout = globalThis.setTimeout
  const timer = spyOn(globalThis, "setTimeout").mockImplementation(
    new Proxy(timeout, {
      apply(target, receiver, args) {
        return Reflect.apply(target, receiver, [
          args[0],
          args[1] === 250 || args[1] === 1500 ? 0 : args[1],
          ...args.slice(2),
        ])
      },
    }),
  )
  try {
    await writeFile(files[0], input.saved)
    await writeFile(files[1], input.other)
    const before = await Promise.all(files.map((file) => readFile(file)))
    host.editor = editor(files[0], input.text, input.start, input.end, input.character)
    host.terminals = [
      {
        name: "opencode learn preview",
        creationOptions: { env: { _EXTENSION_OPENCODE_PORT: String(server.port) } },
        show() {},
      },
    ]
    const command = host.commands.get(`opencode.${input.command}`)
    if (!command) throw new Error(`Missing command: ${input.command}`)
    await command()
    expect((await readdir(directory)).sort()).toEqual(["active.ts", "other.ts"])
    expect(endpoints).toEqual(["/app", "/tui/append-prompt", "/tui/submit-prompt"])
    expect(prompts).toHaveLength(1)
    return { prompt: prompts[0], before, after: await Promise.all(files.map((file) => readFile(file))) }
  } finally {
    timer.mockRestore()
    server.stop(true)
    host.editor = undefined
    host.terminals = []
    await rm(directory, { recursive: true, force: true })
  }
}

// R1: When a user requests an explanation, the extension includes the currently
// selected code, including unsaved changes, in the explanation request.
// Kind: metamorphic
// Rename only the binding and its use; the transformed request must contain the
// exact transformed selection, while its instructions and location stay equal.
test("R1: explanation requests follow unsaved variable renames", async () => {
  await fc.assert(
    fc.asyncProperty(program, async (sample) => {
      const oldName = `${sample.name}_old`
      const newName = `${sample.name}_new`
      const saved = `const ${oldName} = ${sample.amount};\nconsole.log(${oldName});`
      const text = saved.replaceAll(oldName, newName)
      const original = await request({
        command: "explainSelection",
        text: saved,
        saved,
        other: "// unrelated",
        start: 0,
        end: 1,
        character: 0,
      })
      const renamed = await request({
        command: "explainSelection",
        text,
        saved,
        other: "// unrelated",
        start: 0,
        end: 1,
        character: 0,
      })
      expect(renamed.prompt).toContain(`\n${text}\n`)
      expect(renamed.prompt).not.toContain(oldName)
      expect(renamed.prompt.replaceAll(newName, oldName)).toBe(original.prompt)
    }),
    { numRuns: 100 },
  )
}, 30000)

// R1: When a user requests an explanation, the extension includes the currently
// selected code, including unsaved changes, in the explanation request.
// Kind: invariant
// Vary newlines, Unicode, and embedded fences to catch truncation or escaping.
test("R1: explanation requests preserve selected text verbatim", async () => {
  await fc.assert(
    fc.asyncProperty(sourceText, async (content) => {
      const text = `// selected\n${content}`
      const result = await request({
        command: "explainSelection",
        text,
        saved: "// saved version",
        other: "",
        start: 0,
        end: text.split("\n").length - 1,
        character: 0,
      })
      expect(result.prompt).toContain(`\n${text}\n`)
      expect(result.prompt).not.toContain("// saved version")
      const fence = result.prompt.split("\n").at(-1)!
      expect(fence).toMatch(/^`{3,}$/)
      for (const run of text.matchAll(/`+/g)) expect(fence.length).toBeGreaterThan(run[0].length)
    }),
    { numRuns: 100 },
  )
}, 30000)

// R2: The explanation request includes the selected code and the definitions of
// functions it calls that are declared earlier in the same file.
// Kind: invariant
// A real earlier helper is OUTSIDE the selection. Padding includes helpers more
// than 30 lines away, so passing the selected text alone cannot satisfy R2.
// The saved helper deliberately differs from the editor buffer, so fetching
// stale context from disk cannot satisfy the property.
test("R2: explanation requests include earlier called function definitions", async () => {
  await fc.assert(
    fc.asyncProperty(program, async (sample) => {
      const helper = `function ${sample.name}(n: number) { return n + ${sample.amount}; }`
      const selected = `function selected() { return ${sample.name}(2); }`
      const lines = [helper, ...Array.from({ length: sample.padding }, () => "// padding"), selected]
      const text = lines.join(sample.newline)
      const result = await request({
        command: "explainSelection",
        text,
        saved: text.replace(helper, "// stale saved helper definition"),
        other: "",
        start: lines.length - 1,
        end: lines.length - 1,
        character: 0,
      })
      expect(result.prompt).toContain(selected)
      expect(result.prompt).toContain(helper)
      expect(result.prompt).not.toContain("// stale saved helper definition")
    }),
    { numRuns: 100 },
  )
}, 30000)
