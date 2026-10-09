# User Documentation (5)

## Vlad - X

## Jay - X

## Cathy - X

## Janna - X

## Nate - Finding related tests of a given file (`/associate`).

The `/associate` command gives developers the ability to choose specific files in the current codebase and explore how the functions within are being tested.

### How to use it

In an Opencode repository session, run `/associate [file path]`. The LLM will run a structured prompt based on the file given by the user. The LLM will then return a markdown file specifying the functions, their locations, the locations of their tests, and the way it tests the model. The response will also note functions that are not tested.

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
