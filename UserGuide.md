# User Documentation (5)

## Vlad - Learn Mode and Learning Commands

Learn is OpenCode's read-only mode for understanding a repository without changing it. Select **Learn** from the agent selector before starting a learning workflow. Learn can inspect files, search the repository, and use web research tools, but it cannot edit files, run shell commands, or delegate tasks that could change the project.

### Learn-only commands

The following teammate-built learning workflows are available only while Learn is selected:

- `/newcomer` creates a codebase orientation guide tailored to the user's experience level and chosen topic.
- `/associate <file>` examines one source file and reports which tests exercise its functions. Omit the file to have Learn ask for one. The path must identify one readable file inside the current project.
- `/group` opens the repository learning map for the current session. It groups repository files by functionality, prioritizes files Learn has already read in that session, and can generate explanations for a group or subgroup.

`/newcomer` and `/associate` are server-backed slash commands. `/group` is a session command because it needs the session's read history, so it is available only after opening a session. In an active Learn session, type `/n`, `/a`, or `/g` to filter the slash-command autocomplete and select the desired command.

### How the restriction works

The command list carries an agent requirement for `/newcomer` and `/associate`. The TUI hides commands with a Learn requirement unless Learn is the active agent. The session service repeats that check before it creates a prompt, so manually sending one of those commands from Build or another mode is rejected before it reaches the model.

`/group` remains registered during a session so it becomes available immediately when a user switches to Learn. Its autocomplete entry is hidden outside Learn, and its action checks the active agent again before loading repository files or creating a learning prompt. This prevents stale UI state or direct keymap dispatch from starting the workflow outside Learn.

These command checks complement Learn's existing read-only enforcement: mutation-capable tools are not exposed to Learn, and direct shell execution is rejected. Switching back to Build restores the normal editing workflow, but the learning commands remain hidden there.

### User testing

1. Open a session in Build and type `/g`; `/group` should not appear.
2. Switch that same session to Learn and type `/g`; **Explore repository groups** should appear without reopening the session.
3. In Learn, run `/newcomer`, `/associate path/to/file`, and `/group`; confirm each workflow starts normally.
4. Switch to Build and confirm `/newcomer`, `/associate`, and `/group` are absent from autocomplete.
5. Attempt `/associate` from Build through a direct client request; it should fail before a model request is made.

### Automated tests

- [`packages/opencode/test/session/prompt.test.ts`](packages/opencode/test/session/prompt.test.ts) verifies Learn-only command metadata, successful Learn execution, and rejection from another mode before model execution.
- [`packages/tui/test/prompt/command.test.ts`](packages/tui/test/prompt/command.test.ts) verifies visibility rules for server-backed Learn commands and `/group`.
- [`packages/tui/test/associate.e2e.test.ts`](packages/tui/test/associate.e2e.test.ts) verifies `/associate` submits through Learn.
- [`packages/tui/test/group-map.e2e.test.ts`](packages/tui/test/group-map.e2e.test.ts) verifies the repository-map workflow in Learn.

Run the focused checks from the package directories:

```bash
cd packages/opencode && bun test test/session/prompt.test.ts && bun typecheck
cd packages/tui && bun test test/prompt/command.test.ts test/associate.e2e.test.ts test/group-map.e2e.test.ts && bun typecheck
```

## Jay - Guided Codebase Exploration as a Newcomer (`/newcomer`)

The `/newcomer` command gives new developers a guide to the current codebase based on their experience level and the topic they want to explore. Beginner responses use simpler explanations, while advanced responses include more architecture and control-flow details.

### How to use it

Run `/newcomer`, choose a level, and then choose an area such as entry points, configuration, tests, documentation, or development setup. You can also select all areas or enter a custom area. The result is shown as Markdown tables with real paths and verified commands from the repository.

The level can be included in the command:

```text
/newcomer beginner
/newcomer intermediate
/newcomer advanced
```

If a valid level is included, only the scope question appears. If the level is not recognized, the command asks the user to choose one.

### User testing

1. Run `/newcomer` and confirm that the experience and scope questions appear.
2. Try beginner and advanced levels and check that the amount of technical detail changes.
3. Try a built-in scope and a custom scope and check that the response stays on that topic.
4. Check that the response uses Markdown tables and references files that exist in the repository.
5. Dismiss the questions and confirm that no guide is generated.

### Automated tests

- [`packages/opencode/test/session/prompt.test.ts`](packages/opencode/test/session/prompt.test.ts) has 20 focused tests and 10 integration tests. They cover all experience levels and built-in scopes, invalid and custom input, prompt creation, saved messages, cancellation, and concurrent sessions.
- [`packages/opencode/test/cli/serve/serve-process.test.ts`](packages/opencode/test/cli/serve/serve-process.test.ts) has three end-to-end tests using a real `opencode serve` process and production HTTP routes. They cover a normal run, an advanced user with a custom scope, and cancellation without saving a prompt or contacting the model. The tests also confirm that the question reply and rejection routes acknowledge each action before the workflow continues.

Run them from `packages/opencode`:

```bash
bun test test/session/prompt.test.ts --test-name-pattern newcomer
bun test test/cli/serve/serve-process.test.ts --test-name-pattern newcomer
bun typecheck
```

These tests cover the main input choices, the connection between the command, question, session, and model services, and the full workflow through the server. They also cover failure cases such as invalid input and cancellation. Checking the route acknowledgement, saved messages, and model calls verifies both the visible result and the cleanup behind it.

## Cathy - Repository Learning Map (`/group`)

In an OpenCode repository session, select **Learn** and run `/group`. Open a functionality group to browse its subgroups and files (18 per page), or select **EXPLAIN THIS FUNCTIONALITY** / **EXPLAIN THIS SUBGROUP** for file-based guidance, relationships, a reading order, and a learning question. If Learn has read a file in this session, rerun `/group` to prioritize its group. Structural names remain if model naming fails; inventories over 10,000 files may be partial.

**Manual end-to-end check:** Browse a group and subgroup, change pages, and request both explanations. Check that the answers cite real files and that a newly read file moves its group up. An empty repository should show a message without crashing. This checks the live model response.

**Automated tests:** [Unit grouping](packages/tui/test/util/repository-functionality.test.ts) covers layouts, limits, prioritization, prompts, and fallback; [unit read collection](packages/tui/test/util/referenced-file.test.ts) covers completed reads, paths, and `/group` registration. The [integration test](packages/tui/test/integration/repository-map.test.ts) traces a read through grouping and explanation prompts. The [TUI E2E test](packages/tui/test/group-map.e2e.test.ts) uses a mock server to open `/group`, navigate files, and submit both explanation prompts in Learn. Together these cover #12's acceptance criteria; the manual check covers live model output. From `packages/tui`, run `bun test` and `bun typecheck`.


## Janna - Code Explanations and Suggestions

This feature adds two learning-focused commands to the VS Code extension:
- Explain Selected Code — allows a user to highlight code in the editor and ask OpenCode for a short, beginner-friendly explanation of what the selected code does, why it works, and any important inputs, outputs, or side effects.
- Suggest Code at Cursor — allows a user to request a code suggestion based on the current cursor position and surrounding code. The response includes the suggested code followed by a short explanation of what the code does and why it works.

How to use:
In an OpenCode repository session, run OpenCode's extension development host and open any file. To explain any selected code, highlight the code you want help with and run the shortcut ⌘⌥E.
To use Suggest Code at Cursor, open a code file and place your cursor where you want to get code suggestions. The run the shortcut ⌘⌥G. In both instances, an Opencode terminal will generate a relevant suggestion and/or explanation.

Automated Tests:
[`sdks/vscode/src/test/explain.unit.test.ts`](sdks/vscode/src/test/explain.unit.test.ts) contains unit tests for the helper functions used by the explanation and suggestion features. These tests verify that selected line ranges are calculated correctly, explanation prompts include the selected code and file reference, suggestion prompts include the correct cursor position and surrounding code, and both prompts explicitly instruct OpenCode not to modify files.

[`sdks/vscode/src/test/explain.integration.test.ts`](sdks/vscode/src/test/explain.integration.test.ts) contains integration tests that activate the VS Code extension and confirm that the opencode.explainSelection and opencode.suggestCode commands are registered correctly. These tests verify that the feature is connected to the extension command system and is available to users after activation.

[`sdks/vscode/src/test/explain.e2e.test.ts`](sdks/vscode/src/test/explain.e2e.test.ts) contains end-to-end extension-host tests using a real VS Code editor environment. The tests open a TypeScript document, create a code selection or cursor position, and verify that the corresponding explanation or suggestion workflow is available from the editor. This checks the feature from the user-facing editor level without requiring a live external OpenCode server.


These tests cover the main behavior of the feature at three levels: the prompt-building logic, the integration between the commands and the VS Code extension, and the user-facing editor workflow

## Nate - Finding related tests of a given file (`/associate`).

The `/associate` command gives developers the ability to choose specific files in the current codebase and explore how the functions within are being tested.

### How to use it

In an Opencode repository session, switch to learn mode, then run `/associate [file path]`. The LLM will run a structured prompt based on the file given by the user. The LLM will then return a markdown file specifying the functions, their locations, the locations of their tests, and the way it tests the model. The response will also note functions that are not tested.

Some examples of correct command call:

/associate src/math.ts
/associate ./src/math.ts
/associate "src/files with spaces/math.ts"
/associate 'src/files with spaces/math.ts'
/associate 'absolute/path/to/current-project/src/math.ts
/associate src/link-to-math.ts
/associate

If a single valid file is included, the LLM will be queried.
- a valid file is inside the project and readable

### User testing

1. Start Opencode and ensure a model is configured. Then open a session rooted in the repository that needs inspecting.
2. Run `/associate [file path]` and confirm that it is accepted.
3. Verify that a markdown table is shared in the terminal separated into columns of Function, Source, Test(s), and association.
4. Check that the information for each function is correct including file location and line number. Association is split into direct, indirect, or untested. Manually verify that the claimed relationships are real.

### Automated tests

- [`packages/opencode/test/session/prompt.test.ts`](packages/opencode/test/session/prompt.test.ts) has 18 tests. 
They cover valid inputs, response structure, potential errors, and exposed meta data.
- [`packages/tui/test/associate.e2e.test.ts`](packages/tui/test/associate.e2e.test.ts) has one end-to-end TUI test using a mock llm and mocked event transports. It covers a normal flow of a /associate call including simulating user inputs, server responses, and ensuring the TUI updates to asynchronous events. The test confirms that the command is recognized and parsed into parts and the response becomes visible in the terminal UI.


From Packages/opencode run:
```bash
bun test test/session/prompt.test.ts --test-name-pattern associate
bun typecheck
```
From packages/tui run:
```bash
bun test test/associate.e2e.test.ts
bun typecheck
```

