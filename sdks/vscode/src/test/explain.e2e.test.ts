/// <reference types="mocha" />

import * as assert from "node:assert/strict"
import * as vscode from "vscode"

suite("E2E: code explanation and suggestion", () => {
  test("Explain Selected Code can be invoked from an editor", async () => {
    const document = await vscode.workspace.openTextDocument({
      language: "typescript",
      content: "const answer = 42\n",
    })

    const editor = await vscode.window.showTextDocument(document)

    editor.selection = new vscode.Selection(
      new vscode.Position(0, 0),
      new vscode.Position(0, 17),
    )

    const commands = await vscode.commands.getCommands(true)

    assert.ok(commands.includes("opencode.explainSelection"))
    assert.equal(editor.document.getText(editor.selection), "const answer = 42")
  })

  test("Suggest Code can be invoked with a cursor position", async () => {
    const document = await vscode.workspace.openTextDocument({
      language: "typescript",
      content: "function add(a: number, b: number) {\n  \n}\n",
    })

    const editor = await vscode.window.showTextDocument(document)

    editor.selection = new vscode.Selection(
      new vscode.Position(1, 2),
      new vscode.Position(1, 2),
    )

    const commands = await vscode.commands.getCommands(true)

    assert.ok(commands.includes("opencode.suggestCode"))
    assert.equal(editor.selection.active.line, 1)
    assert.equal(editor.selection.active.character, 2)
  })
})