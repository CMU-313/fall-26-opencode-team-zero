# Traceability: Janna Lu jannaanl

**Target feature:** Generating code suggestions and explanations commands, and the main source files it lives in

[`sdks/vscode/src/explain.ts`](https://github.com/CMU-313/fall-26-opencode-team-zero/blob/main/sdks/vscode/src/test/explain.test.ts)

[`sdks/vscode/src/extension.ts`](https://github.com/CMU-313/fall-26-opencode-team-zero/blob/main/sdks/vscode/src/extension.ts)

[`sdks/vscode/src/test/explain.test.ts`](https://github.com/CMU-313/fall-26-opencode-team-zero/blob/main/sdks/vscode/src/test/explain.test.ts)

[`sdks/vscode/src/test/explain.e2e.test.ts`](https://github.com/CMU-313/fall-26-opencode-team-zero/blob/main/sdks/vscode/src/test/explain.e2e.test.ts)

[`sdks/vscode/src/test/explain.integration.test.ts`](https://github.com/CMU-313/fall-26-opencode-team-zero/blob/main/sdks/vscode/src/test/explain.integration.test.ts)

## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4? | Property (kind) | Test |
|---|---|---|---|---|---|---|
| R1 | C-4: "I would expect everything to be the same except for the variable name which would be changed to the new name.” S-4: “It [ Claude ] should give the same explanation as to how the code works, and should only change the referenced variable with the new name. “ | Explanations should accurately reflect the current version of the user’s code. | If a user renames a variable without changing the code’s behavior, the explanation should use the updated name but describe the same functionality. |Yes| Metamorphic| `explanations.property.test.ts`: “R1: explanation requests follow unsaved variable renames”; “R1: explanation requests preserve selected text verbatim”|
| R2 | S-1: “I put the whole file in so it could get all the context of previous functions”| Code explanations and suggestions should use relevant code as context. | If a selected function calls another function defined earlier in the same file, the explanation should describe the called function’s behavior. |No|Invariant|`explanations.property.test.ts`: “R2: explanation requests include earlier called function definitions”|
| R3 | C-2: “It should never .. change files I didn't ask it to change.” S-2: “It should only change what is visible and highlight the changes.” | Code suggestions should only suggest code based on where the user’s cursor is/what file the user’s on. | Given two open files, with the cursor in file A, requesting a code suggestion produces an edit for file A at the cursor location or within the selected code. No proposed edits target file B.|No|Invariant|`suggestions.property.test.ts`: “R3: suggestion requests identify the active file and exact cursor context” — partial coverage|
| R4 | S-6: “I would run the new code against tests, and if the new code is right then the tests should pass.”  O-5: “And run the code against written tests.” | Code suggestions should be tested and checked before being suggested in the output. | If a project has existing automated tests, the extension checks suggested code against the tests before outputting it. |Yes|Oracle|---|
| R5 | S-3: “CoPilot shouldn’t change any code without my permission. Only make changes when I approve it.”| Should not make any changes to the codebase.| All project files should remain unchanged. |No|Invariant|`suggestions.property.test.ts`: “R5: explanation and suggestion requests leave project files unchanged” — request-stage coverage|


Properties written or suggested by opencode or another AI tool: None

## Requirement changes

| ID | Original requirement (P3) | Revised requirement | Why it changed |
|---|---|---|---|
| R1 | Explanations should accurately reflect the current version of the user’s code. | When a user requests an explanation, the extension includes the currently selected code, including unsaved changes, in the explanation request. | The original wording was too broad and subjective to test reliably. The revision defines an observable behavior with clear pass/fail criteria. |
| R2 | Code explanations and suggestions should use relevant code as context. | The explanation request includes the selected code and the definitions of functions it calls that are declared earlier in the same file. | "Relevant code" is too subjective and checking whether the output correctly describes a called function also requires a defined expected answer. |
| R4 | Code suggestions should be tested and checked before being suggested in the output. | If a project has existing automated tests, the extension provides users with a way to run those tests after applying a code suggestion and displays whether the tests pass or fail. | Testing the original requirement would require applying suggestions and running existing tests in a temporary environment. The revision makes user-triggered testing and its results observable. |

## Hand written mutants

| ID | Requirement Targeted | Change | Predicted Killer | Actual Result |
|---|---|---|---|---|
| H1 | R3 |`sdks/vscode/src/explain.ts`, `buildCodeSuggestionPrompt`: change `${input.cursorLine + 1}` to `${input.cursorLine}` in the file reference. |“Suggestion requests identify the active file and exact cursor context” (R3)|Killed(✗ R3: suggestion requests identify the active file and exact cursor context)|
| H2 |R2|`sdks/vscode/src/extension.ts`: In the explanation command, change the context range’s starting line from `0` to `Math.max(0, selection.start.line - 30)`, omitting earlier code beyond 30 lines.|“Explanation requests include earlier called function definitions” (R2)|Killed (✗ R2: explanation requests include earlier called function definitions)|
| H3 |R3 |`sdks/vscode/src/extension.ts`: In the suggestion command’s endLine calculation, change `document.lineCount - 1` to `document.lineCount - 2`, excluding the document’s final line.|“Suggestion requests identify the active file and exact cursor context” (R3)|Killed (✗ R3: suggestion requests identify the active file and exact cursor context)|
| H4 |R5| `sdks/vscode/src/extension.ts`: In the explanation command, append `"\n"` to the active file using a filesystem operation before sending the request, modifying the file without approval.|“Explanation and suggestion requests leave project files unchanged” (R5)|Killed (✗ R5: explanation and suggestion requests leave project files unchanged)|
| H5 |R1|`sdks/vscode/src/explain.ts`: In `buildExplanationPrompt`, replace the highlighted-code entry `input.text` with `input.text.trim()`, removing selected leading and trailing whitespace.|“Explanation requests preserve selected text verbatim” (R1)|Killed (✗ R1: explanation requests preserve selected text verbatim )|