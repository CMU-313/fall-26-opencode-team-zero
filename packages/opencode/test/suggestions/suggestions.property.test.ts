import { afterAll, expect, test } from "bun:test"
import fc from "fast-check"
import { buildCodeSuggestionPrompt } from "../../../../sdks/vscode/src/explain"
import { assertCodeBlock, closeServer, request, sourceText } from "../explanations/explanations.property.test"

afterAll(closeServer)

// Generate a coherent document and an in-bounds cursor, including first/last
// lines, zero/end columns, and positions around the +/-30-line context boundary.
// Unique line markers make incorrect slicing visible even in repetitive code.
const cursorCase = fc.integer({ min: 1, max: 90 }).chain((count) =>
  fc
    .tuple(
      fc.oneof(
        fc.constantFrom(0, count - 1, Math.min(30, count - 1), Math.min(31, count - 1)),
        fc.integer({ min: 0, max: count - 1 }),
      ),
      fc.boolean(),
    )
    .map(([line, atEnd]) => {
      const lines = Array.from({ length: count }, (_, index) => `const line_${index} = ${index};`)
      return { lines, line, character: atEnd ? lines[line].length : 0 }
    }),
)

// R3: Code suggestions should only suggest code based on where the user's
// cursor is/what file the user's on.
// Kind: invariant
// This checks the command's active-file/cursor/context boundary. The extension
// returns free-form AI text, not structured edits: this does NOT prove that a
// model's proposed edits avoid file B. That acceptance criterion needs model or
// structured-edit integration coverage; do not mark this as full R3 coverage.
test("R3: suggestion requests identify the active file and exact cursor context", async () => {
  await fc.assert(
    fc.asyncProperty(cursorCase, async (sample) => {
      const text = sample.lines.join("\n")
      const result = await request({
        command: "suggestCode",
        text,
        saved: "// stale active file",
        other: "// OTHER_FILE_SENTINEL",
        start: sample.line,
        end: sample.line,
        character: sample.character,
      })
      const start = Math.max(0, sample.line - 30)
      const end = Math.min(sample.lines.length - 1, sample.line + 30)
      expect(result.prompt).toContain(`File: @active.ts#L${sample.line + 1}\n`)
      expect(result.prompt).toContain(`Cursor: line ${sample.line + 1}, column ${sample.character + 1}\n`)
      expect(result.prompt).toContain(`Context lines: ${start + 1}-${end + 1}\n`)
      expect(result.prompt).toContain(`\n${sample.lines.slice(start, end + 1).join("\n")}\n`)
      expect(result.prompt).not.toContain("@other.ts")
      expect(result.prompt).not.toContain("OTHER_FILE_SENTINEL")
      expect(result.prompt).not.toContain("// stale active file")
      assertCodeBlock(
        result.prompt,
        "Surrounding code (including any unsaved changes):",
        sample.lines.slice(start, end + 1).join("\n"),
        "typescript",
      )
    }),
    { numRuns: 100 },
  )
}, 30000)

// R5: Should not make any changes to the codebase.
// Kind: invariant
// Generate independent saved, unsaved, and unrelated-file contents. Snapshot
// real file bytes before/after BOTH commands, rather than checking only that a
// prompt asks the model not to edit. Model/tool execution is outside this test.
test("R5: explanation and suggestion requests leave project files unchanged", async () => {
  await fc.assert(
    fc.asyncProperty(fc.record({ saved: sourceText, unsaved: sourceText, other: sourceText }), async (sample) => {
      for (const command of ["explainSelection", "suggestCode"] as const) {
        const text = `// selected\n${sample.unsaved}`
        const result = await request({
          command,
          text,
          saved: sample.saved,
          other: sample.other,
          start: 0,
          end: text.split("\n").length - 1,
          character: 0,
        })
        expect(result.after).toEqual(result.before)
        expect(result.prompt).toContain("Do not modify any files.")
      }
    }),
    { numRuns: 100 },
  )
}, 30000)

// R4's revised requirement needs a run-tests action and displayed pass/fail
// result. Neither exists in the current extension; no fake implementation is
// substituted here to manufacture passing coverage.

// R3/R5 supplemental prompt contract: keep the cursor task, read-only guidance,
// code-first teaching instructions, and unambiguous scaffold boundaries.
// Kind: invariant. Generate coherent cursor windows and multiple languages/text
// shapes. This deliberately specifies prompt policy/layout beyond the original
// cursor/file-preservation criteria; it does not assert anything about AI output.
test("R3/R5: generated suggestion prompts retain instructions and section boundaries", () => {
  fc.assert(
    fc.property(
      cursorCase,
      sourceText,
      fc.constantFrom("typescript", "javascript", "markdown"),
      (sample, content, language) => {
        const start = Math.max(0, sample.line - 30)
        const end = Math.min(sample.lines.length - 1, sample.line + 30)
        const text = sample.lines
          .slice(start, end + 1)
          .map((line, index) => (index === end - start ? `${line} // ${content.replace(/[\r\n]/g, " ")}` : line))
          .join("\n")
        const prompt = buildCodeSuggestionPrompt({
          relativePath: `source_${sample.line}.ts`,
          languageId: language,
          text,
          startLine: start,
          endLine: end,
          cursorLine: sample.line,
          cursorCharacter: sample.character,
        })
        const policy = prompt.split("\n\n")[0].split("\n")
        expect(policy).toHaveLength(5)
        expect(policy[0]).toMatch(/^Suggest code.*current cursor position\.$/)
        expect(policy[1]).toMatch(/Use the surrounding code.*inspect other relevant project files.*read-only tools/)
        expect(policy[2]).toMatch(
          /Do not modify any files\..*Return the suggested code first.*beginner-friendly explanation/,
        )
        expect(policy[3]).toMatch(/what it does and why it works.*under 120 words.*short sentences or bullets/)
        expect(policy[4]).toMatch(/Avoid unnecessary jargon.*define.*technical term/)
        const metadata = [
          `File: @source_${sample.line}.ts#L${sample.line + 1}`,
          `Cursor: line ${sample.line + 1}, column ${sample.character + 1}`,
          `Context lines: ${start + 1}-${end + 1}`,
        ].join("\n")
        const label = "Surrounding code (including any unsaved changes):"
        expect(prompt).toContain(`${policy[4]}\n\n${metadata}\n\n${label}\n`)
        assertCodeBlock(prompt, label, text, language)
      },
    ),
    { numRuns: 100 },
  )
})
