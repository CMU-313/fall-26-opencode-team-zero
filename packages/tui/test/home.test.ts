import { expect, test } from "bun:test"
import { homePromptPlaceholders } from "../src/routes/home"

test("uses the Learn placeholder only while Learn is selected", () => {
  expect(homePromptPlaceholders("learn").normal).toEqual([
    "Tell me about Copilot integration...",
    "Explain how this codebase is organized",
    "Where should I start reading this project?",
  ])
  expect(homePromptPlaceholders("plan").normal).toContain("Fix broken tests")
  expect(homePromptPlaceholders("build").normal).toContain("Fix broken tests")
})
