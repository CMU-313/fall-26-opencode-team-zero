# User Documentation (5)

## Vlad - X

## Jay - X

## Cathy - X

## Janna - Code Explanations and Suggestions

This feature adds two learning-focused commands to the VS Code extension:
- Explain Selected Code — allows a user to highlight code in the editor and ask OpenCode for a short, beginner-friendly explanation of what the selected code does, why it works, and any important inputs, outputs, or side effects.
- Suggest Code at Cursor — allows a user to request a code suggestion based on the current cursor position and surrounding code. The response includes the suggested code followed by a short explanation of what the code does and why it works.

Automated Tests:
[`sdks/vscode/src/test/explain.unit.test.ts`](sdks/vscode/src/test/explain.unit.test.ts) contains unit tests for the helper functions used by the explanation and suggestion features. These tests verify that selected line ranges are calculated correctly, explanation prompts include the selected code and file reference, suggestion prompts include the correct cursor position and surrounding code, and both prompts explicitly instruct OpenCode not to modify files.

[`sdks/vscode/src/test/explain.integration.test.ts`](sdks/vscode/src/test/explain.integration.test.ts) contains integration tests that activate the VS Code extension and confirm that the opencode.explainSelection and opencode.suggestCode commands are registered correctly. These tests verify that the feature is connected to the extension command system and is available to users after activation.

[`sdks/vscode/src/test/explain.e2e.test.ts`](sdks/vscode/src/test/explain.e2e.test.ts) contains end-to-end extension-host tests using a real VS Code editor environment. The tests open a TypeScript document, create a code selection or cursor position, and verify that the corresponding explanation or suggestion workflow is available from the editor. This checks the feature from the user-facing editor level without requiring a live external OpenCode server.


These tests cover the main behavior of the feature at three levels: the prompt-building logic, the integration between the commands and the VS Code extension, and the user-facing editor workflow

## Nate - X
