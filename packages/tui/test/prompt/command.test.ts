import { expect, test } from "bun:test"
import { isLearnMode, visibleCommands } from "../../src/prompt/command"

test("shows Learn-only commands only while Learn is selected", () => {
  const commands = [
    { name: "init" },
    { name: "associate", agent: "learn" },
    { name: "newcomer", agent: "learn" },
  ]

  expect(visibleCommands(commands, "build").map((command) => command.name)).toEqual(["init"])
  expect(visibleCommands(commands, "learn").map((command) => command.name)).toEqual([
    "init",
    "associate",
    "newcomer",
  ])
})

test("recognizes only Learn as Learn mode", () => {
  expect(isLearnMode("learn")).toBe(true)
  expect(isLearnMode("build")).toBe(false)
})
