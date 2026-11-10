import { expect, test } from "bun:test"
import fc from "fast-check"
import { Command } from "../../src/command"

fc.configureGlobal({ seed: 30 })

test("R6 (agent): experience matching", () => {
  const level = fc.constantFrom(...Command.NewcomerExperience.map((item) => item.label))
  const whitespace = fc.stringMatching(/^[ \t\n]{0,3}$/)

  fc.assert(
    fc.property(level, fc.mixedCase(level), whitespace, whitespace, (expected, typed, before, after) => {
      expect(Command.newcomerExperience(`${before}${expected}${after}`)).toBe(expected.toLowerCase())
      expect(Command.newcomerExperience(`${before}${typed}${after}`)).toBe(typed.toLowerCase())
    }),
  )

  // Strengthened: anything that is not a real level, including empty input, must not skip the menu.
  fc.assert(
    fc.property(fc.oneof(whitespace, fc.string()), (typed) => {
      fc.pre(!Command.NewcomerExperience.some((item) => item.label.toLowerCase() === typed.trim().toLowerCase()))
      expect(Command.newcomerExperience(typed)).toBeUndefined()
    }),
  )
})
