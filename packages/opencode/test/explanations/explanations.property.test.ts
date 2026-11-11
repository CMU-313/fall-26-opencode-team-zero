import { afterAll, expect, mock, spyOn, test } from "bun:test"
import fc from "fast-check"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { buildExplanationPrompt } from "../../../../sdks/vscode/src/explain"

// Command-level tests use the real extension and prompt builders. VS Code is not
// available in Bun, so only its editor/terminal boundary is replaced. The HTTP
// server captures real append/submit requests; no model response is fabricated.
// Traceability entries (documentation is maintained separately):
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
  workspaceAvailable: true,
  information: [] as string[],
  errors: [] as string[],
  launched: [] as string[],
  http: {
    prompts: [] as string[],
    endpoints: [] as string[],
    failure: undefined as undefined | { endpoint: string; status: number },
  },
}

// Hundreds of properties run for each Stryker mutant. Reuse one listener per
// process instead of exhausting ephemeral ports with one server per sample.
const createServer = () =>
  Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const endpoint = new URL(req.url).pathname
      host.http.endpoints.push(endpoint)
      if (endpoint === "/tui/append-prompt") host.http.prompts.push((await req.json()).text)
      return new Response("ok", {
        status: endpoint === `/tui/${host.http.failure?.endpoint}` ? host.http.failure!.status : 200,
      })
    },
  })
const transport = { server: undefined as ReturnType<typeof createServer> | undefined }
export async function closeServer() {
  await transport.server?.stop(true)
  transport.server = undefined
}
afterAll(closeServer)

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
    createTerminal: (options: { name: string; env: Record<string, string> }) => ({
      name: options.name,
      creationOptions: { env: options.env },
      show() {},
      sendText: (command: string) => {
        host.launched.push(command)
      },
    }),
    showInformationMessage: (message: string) => {
      host.information.push(message)
    },
    showErrorMessage: (message: string) => {
      host.errors.push(message)
    },
  },
  workspace: {
    getWorkspaceFolder: () => (host.workspaceAvailable ? {} : undefined),
    asRelativePath: (uri: { fsPath: string }) => path.basename(uri.fsPath),
  },
  commands: {
    registerCommand: (id: string, callback: () => Promise<void>) => {
      host.commands.set(id, callback)
      return { dispose() {} }
    },
  },
  Range,
  Uri: { file: (file: string) => ({ fsPath: file }) },
  ViewColumn: { Beside: 2 },
}))

// The SDK is outside the root Bun workspaces and owns its VS Code typecheck.
// Load it at runtime so opencode's typecheck does not require SDK-only types.
// This contract describes the mocked host, not the full VS Code context.
const extensionPath = path.resolve(import.meta.dir, "../../../../sdks/vscode/src/extension.ts")
const { activate } = (await import(extensionPath)) as {
  activate(context: { subscriptions: { dispose(): void }[]; asAbsolutePath(file: string): string }): void
}
activate({ subscriptions: [], asAbsolutePath: (file) => file })

function editor(
  file: string,
  text: string,
  start: number,
  end: number,
  character: number,
  endCharacter?: number,
  languageId = "typescript",
) {
  const lines = text.split("\n")
  return {
    document: {
      uri: { fsPath: file },
      languageId,
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
      end: { line: end, character: endCharacter ?? lines[end].length },
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
  endCharacter?: number
  filename?: string
  languageId?: string
  missing?: "editor" | "workspace"
  failure?: { endpoint: "append-prompt" | "submit-prompt"; status: number }
  freshTerminal?: boolean
}) {
  const server = (transport.server ??= createServer())
  const directory = await mkdtemp(path.join(tmpdir(), "opencode-properties-"))
  const files = [path.join(directory, input.filename ?? "active.ts"), path.join(directory, "other.ts")]
  const prompts: string[] = []
  const endpoints: string[] = []
  host.http = { prompts, endpoints, failure: input.failure }
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
  // A fresh terminal normally chooses a random port. Match it to this run's
  // real ephemeral server; no CLI is spawned by the VS Code boundary stub.
  const random = input.freshTerminal
    ? spyOn(Math, "random").mockReturnValue((server.port! - 16384 + 0.5) / (65535 - 16384 + 1))
    : undefined
  try {
    host.workspaceAvailable = input.missing !== "workspace"
    host.information = []
    host.errors = []
    host.launched = []
    await writeFile(files[0], input.saved)
    await writeFile(files[1], input.other)
    const before = await Promise.all(files.map((file) => readFile(file)))
    host.editor =
      input.missing === "editor"
        ? undefined
        : editor(files[0], input.text, input.start, input.end, input.character, input.endCharacter, input.languageId)
    host.terminals = input.freshTerminal
      ? []
      : [
          {
            name: "opencode learn preview",
            creationOptions: { env: { _EXTENSION_OPENCODE_PORT: String(server.port) } },
            show() {},
          },
        ]
    const command = host.commands.get(`opencode.${input.command}`)
    if (!command) throw new Error(`Missing command: ${input.command}`)
    await command()
    expect((await readdir(directory)).sort()).toEqual([input.filename ?? "active.ts", "other.ts"].sort())
    const expected = input.missing
      ? []
      : input.failure?.endpoint === "append-prompt"
        ? ["/app", "/tui/append-prompt"]
        : ["/app", "/tui/append-prompt", "/tui/submit-prompt"]
    expect(endpoints).toEqual(expected)
    expect(prompts).toHaveLength(input.missing ? 0 : 1)
    if (!input.failure) expect(host.errors).toEqual([])
    if (!input.missing) expect(host.information).toEqual([])
    return {
      prompt: prompts[0],
      before,
      after: await Promise.all(files.map((file) => readFile(file))),
      information: host.information,
      errors: host.errors,
      launched: host.launched,
      endpoints,
    }
  } finally {
    timer.mockRestore()
    random?.mockRestore()
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
      assertCodeBlock(result.prompt, "Highlighted code (including any unsaved changes):", text, "typescript")
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
      const context = lines.slice(0, -1).join(sample.newline) + sample.newline
      assertCodeBlock(
        result.prompt,
        "Earlier code in the same file (context only, including any unsaved changes):",
        context,
        "typescript",
      )
    }),
    { numRuns: 100 },
  )
}, 30000)

// R1/R2: Code and context must remain distinct, correctly fenced code blocks.
// Kind: invariant. Check the block's structure, not an exact whole-prompt copy;
// this permits editorial wording elsewhere without losing the source boundary.
export function assertCodeBlock(prompt: string, label: string, text: string, language: string) {
  expect(prompt.split(`${label}\n`)).toHaveLength(2)
  const block = prompt.split(`${label}\n`)[1]
  const opening = block.split("\n")[0]
  const fence = opening.slice(0, opening.length - language.length)
  expect(opening.endsWith(language)).toBe(true)
  expect(fence).toMatch(/^`{3,}$/)
  for (const run of text.matchAll(/`+/g)) expect(fence.length).toBeGreaterThan(run[0].length)
  expect(block.startsWith(`${fence}${language}\n${text}\n${fence}`)).toBe(true)
}

// R1: The explanation identifies the current selection in the active file.
// Kind: model/oracle. Generate single/multiline selections away from line zero,
// including VS Code's exclusive next-line/column-zero endpoint. Expected labels
// are derived from selected line count rather than the production range helper.
test("R1: explanation file references identify generated selection ranges", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        start: fc.integer({ min: 0, max: 80 }),
        count: fc.integer({ min: 1, max: 6 }),
        nextLine: fc.boolean(),
        name: identifier,
        language: fc.constantFrom("typescript", "javascript", "python"),
      }),
      async (sample) => {
        const selected = Array.from({ length: sample.count }, (_, index) => `value_${index} = ${index}`)
        const lines = [
          ...Array.from({ length: sample.start }, () => "# earlier context"),
          ...selected,
          "# following context",
        ]
        const end = sample.start + sample.count - (sample.nextLine ? 0 : 1)
        const text = selected.join("\n") + (sample.nextLine ? "\n" : "")
        const result = await request({
          command: "explainSelection",
          text: lines.join("\n"),
          saved: "# stale",
          other: "",
          start: sample.start,
          end,
          character: 0,
          endCharacter: sample.nextLine ? 0 : selected.at(-1)!.length,
          filename: `${sample.name}.ts`,
          languageId: sample.language,
        })
        const first = sample.start + 1
        const last = sample.start + sample.count
        const range = sample.count === 1 ? `#L${first}` : `#L${first}-${last}`
        expect(result.prompt).toContain(`File: @${sample.name}.ts${range}\n`)
        assertCodeBlock(result.prompt, "Highlighted code (including any unsaved changes):", text, sample.language)
      },
    ),
    { numRuns: 100 },
  )
}, 30000)

// Supplemental command contract: failed explanation/suggestion requests must
// produce actionable feedback. Kind: invariant. Generate both failing HTTP
// stages, status codes, commands, and editor text instead of one canned error.
// This extends validation beyond the original R1/R3 happy-path criteria; it
// does not claim an interview requirement about error wording existed already.
test("request failures report the operation and HTTP status", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        command: fc.constantFrom("explainSelection", "suggestCode"),
        endpoint: fc.constantFrom("append-prompt", "submit-prompt"),
        status: fc.integer({ min: 400, max: 599 }),
        content: sourceText,
      }),
      async (sample) => {
        const result = await request({
          command: sample.command,
          text: `// selected\n${sample.content}`,
          saved: "// saved",
          other: "// other",
          start: 0,
          end: 0,
          character: 0,
          failure: { endpoint: sample.endpoint, status: sample.status },
        })
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toContain(
          sample.command === "explainSelection" ? "Unable to explain" : "Unable to suggest",
        )
        expect(result.errors[0]).toContain(String(sample.status))
        expect(result.after).toEqual(result.before)
      },
    ),
    { numRuns: 60 },
  )
}, 30000)

// R1/R3 supporting validation: without an editor/workspace, no code request can
// be targeted. Kind: invariant. Generate both missing preconditions for both
// commands, and require visible feedback with no HTTP or file side effects.
test("unavailable editor contexts explain why a request cannot be made", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        command: fc.constantFrom("explainSelection", "suggestCode"),
        missing: fc.constantFrom("editor", "workspace"),
        content: sourceText,
      }),
      async (sample) => {
        const result = await request({
          command: sample.command,
          text: `// selected\n${sample.content}`,
          saved: sample.content,
          other: "// other",
          start: 0,
          end: 0,
          character: 0,
          missing: sample.missing,
        })
        expect(result.information).toHaveLength(1)
        expect(result.information[0].trim().length).toBeGreaterThan(0)
        expect(result.information[0]).toMatch(
          sample.missing === "workspace" ? /workspace/i : sample.command === "suggestCode" ? /file/i : /highlight/i,
        )
        expect(result.endpoints).toEqual([])
        expect(result.after).toEqual(result.before)
      },
    ),
    { numRuns: 40 },
  )
}, 30000)

// R5: Requesting an explanation/suggestion must start the read-only plan agent.
// Kind: invariant. Existing tests always reused a terminal and could not observe
// a missing agent flag. Generate both commands and fresh unsaved code here.
test("R5: fresh learning terminals start in plan mode", async () => {
  await fc.assert(
    fc.asyncProperty(fc.constantFrom("explainSelection", "suggestCode"), sourceText, async (command, content) => {
      const result = await request({
        command,
        text: `// selected\n${content}`,
        saved: content,
        other: "",
        start: 0,
        end: 0,
        character: 0,
        freshTerminal: true,
      })
      expect(result.launched).toHaveLength(1)
      expect(result.launched[0]).toMatch(/^opencode --port \d+ --agent plan$/)
      expect(result.after).toEqual(result.before)
    }),
    { numRuns: 30 },
  )
}, 30000)

// R1/R2 supplemental prompt contract: preserve the explanation task, teaching
// instructions, and the separation of file metadata, context, and selection.
// Kind: invariant. These are explicit template-contract checks beyond the
// original code-inclusion criteria. Generate empty/nonempty context, languages,
// positions, arbitrary text, and embedded fences; do not snapshot one example.
// Separator assertions examine scaffold boundaries, never prohibit text inside
// the user's code. Intentional template-policy/layout changes need test updates.
test("R1/R2: generated explanation prompts retain instructions and section boundaries", () => {
  fc.assert(
    fc.property(
      fc.record({
        name: identifier,
        language: fc.constantFrom("typescript", "javascript", "python", "markdown"),
        code: sourceText,
        context: sourceText,
        includeContext: fc.boolean(),
        start: fc.integer({ min: 0, max: 1000 }),
      }),
      (sample) => {
        const text = `// selected\n${sample.code}`
        const count = text.split("\n").length
        const context = sample.includeContext ? `// earlier\n${sample.context}` : ""
        const prompt = buildExplanationPrompt({
          relativePath: `${sample.name}.ts`,
          languageId: sample.language,
          text,
          context,
          startLine: sample.start,
          endLine: sample.start + count - 1,
          endCharacter: text.split("\n").at(-1)!.length,
        })
        const policy = prompt.split("\n\n")[0].split("\n")
        expect(policy).toHaveLength(4)
        expect(policy[0]).toMatch(/^Explain the highlighted code.*clear.*beginner-friendly language\.$/)
        expect(policy[1]).toMatch(/what it does.*why it works.*inputs.*outputs.*side effects/)
        expect(policy[2]).toMatch(/Keep that order.*short sentences or bullets.*under 120 words/)
        expect(policy[3]).toMatch(/Avoid unnecessary jargon.*define.*technical term.*Do not modify any files\./)
        // Model the physical selected lines, excluding a trailing empty line.
        const last = sample.start + count - (text.endsWith("\n") ? 1 : 0)
        const first = sample.start + 1
        const reference = `File: @${sample.name}.ts#L${first}${last === first ? "" : `-${last}`}`
        const selectedLabel = "Highlighted code (including any unsaved changes):"
        const contextLabel = "Earlier code in the same file (context only, including any unsaved changes):"
        expect(prompt).toContain(`${policy[3]}\n\n${reference}\n\n${context ? contextLabel : selectedLabel}\n`)
        assertCodeBlock(prompt, selectedLabel, text, sample.language)
        if (context) {
          assertCodeBlock(prompt, contextLabel, context, sample.language)
          const opening = prompt.split(`${contextLabel}\n`)[1].split("\n")[0]
          const fence = opening.slice(0, opening.length - sample.language.length)
          expect(prompt).toContain(`${context}\n${fence}\n\n${selectedLabel}\n`)
        }
      },
    ),
    { numRuns: 100 },
  )
})
