/// <reference types="mocha" />

import * as assert from "node:assert/strict"
import {
  buildCodeSuggestionPrompt,
  buildExplanationPrompt,
  selectedLineRange,
} from "../explain"

suite("Unit: explanation prompt helpers", () => {
  test("calculates the selected line range", () => {
    assert.deepEqual(
      selectedLineRange({
        startLine: 3,
        endLine: 5,
        endCharacter: 8,
      }),
      { start: 4, end: 6 },
    )
  })

  test("builds an explanation prompt with selected code", () => {
    const prompt = buildExplanationPrompt({
      relativePath: "src/example.ts",
      languageId: "typescript",
      text: "const answer = 42",
      startLine: 6,
      endLine: 6,
      endCharacter: 17,
    })

    assert.match(prompt, /@src\/example\.ts#L7/)
    assert.match(prompt, /const answer = 42/)
    assert.match(prompt, /beginner-friendly/)
    assert.match(prompt, /Do not modify any files/)
  })

  test("builds a suggestion prompt with cursor context", () => {
    const prompt = buildCodeSuggestionPrompt({
      relativePath: "src/example.ts",
      languageId: "typescript",
      text: "function total(values: number[]) {\n  \n}",
      startLine: 9,
      endLine: 11,
      cursorLine: 10,
      cursorCharacter: 2,
    })

    assert.match(prompt, /@src\/example\.ts#L11/)
    assert.match(prompt, /Cursor: line 11, column 3/)
    assert.match(prompt, /function total/)
    assert.match(prompt, /Do not modify any files/)
  })
})