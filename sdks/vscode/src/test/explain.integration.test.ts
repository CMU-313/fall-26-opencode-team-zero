/// <reference types="mocha" />

import * as assert from "node:assert/strict"
import * as vscode from "vscode"

suite("Integration: explanation extension commands", () => {
  test("registers Explain Selected Code command", async () => {
    const extension = vscode.extensions.getExtension("sst-dev.opencode")

    assert.ok(extension)

    await extension.activate()

    const commands = await vscode.commands.getCommands(true)

    assert.ok(commands.includes("opencode.explainSelection"))
  })

  test("registers Suggest Code command", async () => {
    const extension = vscode.extensions.getExtension("sst-dev.opencode")

    assert.ok(extension)

    await extension.activate()

    const commands = await vscode.commands.getCommands(true)

    assert.ok(commands.includes("opencode.suggestCode"))
  })
})