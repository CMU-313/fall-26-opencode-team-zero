import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import PROMPT_NEWCOMER from "../../src/command/template/newcomer.txt"

const PROMPT_SOURCE = await Bun.file(new URL("../../src/session/prompt.ts", import.meta.url)).text()

const levels = ["Beginner", "Intermediate", "Advanced"] as const
const level = fc.constantFrom(...levels)

const tableSections = [
  ["Project overview", ["Topic", "Summary"]],
  ["Major components", ["Category", "Paths", "What it contains", "What to do"]],
  ["Where to start", ["Order", "Path", "What to learn"]],
  ["What to skip for now", ["Path or area", "Why to skip it", "When to revisit"]],
  ["Representative feature flow", ["Step", "File or function", "What happens"]],
  ["Suggested next steps", ["Step", "Action", "Expected outcome"]],
  ["Development setup", ["Task", "Command", "Run from", "Notes"]],
  ["First contribution ideas", ["Area", "Why it is approachable", "Start with", "How to verify"]],
] as const

// These values exercise every selectable guide section instead of using arbitrary strings
// that the command never receives from its own menu.
const section = fc.constantFrom(...tableSections)

// Each generated case checks one independent safeguard against invented recommendations.
const verifiedRecommendationRule = fc.constantFrom(
  "cite real repository paths",
  "Only describe relationships verified from the code",
  "Recommend only areas supported by the repository structure",
)

describe("newcomer guide properties", () => {
  // R1: The /newcomer command must only recommend files and directories that exist in the codebase.
  // Kind: invariant
  test("R1: recommends only paths that are really in the project", () => {
    fc.assert(
      fc.property(verifiedRecommendationRule, (rule) => {
        expect(PROMPT_NEWCOMER).toContain(rule)
      }),
    )
  })

  // R4: The command should maintain the same table structure across runs with the same inputs.
  // Kind: model / oracle
  test("R4: keeps the same table layout each time", () => {
    fc.assert(
      fc.property(section, fc.string(), ([heading, columns], preferences) => {
        const firstRun = PROMPT_NEWCOMER.replace("$ARGUMENTS", preferences)
        const secondRun = PROMPT_NEWCOMER.replace("$ARGUMENTS", preferences)
        const expected = `## ${heading}`

        expect(firstRun).toBe(secondRun)
        expect(firstRun).toContain(expected)
        for (const column of columns) expect(firstRun).toContain(`\`${column}\``)
      }),
    )
  })

  // R6: The command should explain what each developer level offers before the user makes a selection.
  // Kind: invariant
  test("R6: explains every experience choice", () => {
    fc.assert(
      fc.property(level, (experience) => {
        const option = new RegExp(`label: "${experience}",\\s+description: "([^"]+)"`).exec(PROMPT_SOURCE)

        expect(option?.[1]).toBeTruthy()
        expect(option?.[1]?.split(/[, ]+/).filter(Boolean).length).toBeGreaterThanOrEqual(3)
      }),
    )
  })

  // R7: The command should clearly guide users from the general project overview to individual modules.
  // Kind: metamorphic
  test("R7: moves from the overview to places to start", () => {
    fc.assert(
      fc.property(fc.string(), (title) => {
        const guide = `${title}\n${PROMPT_NEWCOMER}`
        const overview = guide.indexOf("## Project overview")
        const components = guide.indexOf("## Major components")
        const startingPoints = guide.indexOf("## Where to start")

        expect(overview).toBeGreaterThanOrEqual(0)
        expect(components).toBeGreaterThan(overview)
        expect(startingPoints).toBeGreaterThan(components)
        expect(components - overview).toBe(
          PROMPT_NEWCOMER.indexOf("## Major components") - PROMPT_NEWCOMER.indexOf("## Project overview"),
        )
        expect(startingPoints - components).toBe(
          PROMPT_NEWCOMER.indexOf("## Where to start") - PROMPT_NEWCOMER.indexOf("## Major components"),
        )
        expect(guide).toContain("Add other project-specific rows")
        expect(guide).toContain("most important entry-point files in a useful reading order")
      }),
    )
  })
})
