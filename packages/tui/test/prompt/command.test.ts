import { expect, test } from "bun:test"
import { isGroupCommandVisible, isLearnMode, visibleCommands } from "../../src/prompt/command"

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

test("shows the repository group command only in Learn mode", () => {
  expect(isGroupCommandVisible("session", "build")).toBe(false)
  expect(isGroupCommandVisible("session", "learn")).toBe(true)
  expect(isGroupCommandVisible(undefined, "learn")).toBe(false)
})
