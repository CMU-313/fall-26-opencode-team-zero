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

If a single valid file is included, the LLM will be queried. If there are more than one file included, it will throw an error. If no files are included, the user will be prompted for a file path. If the file is not valid, the command throws an error and does not send the LLM a request.

### User testing

1. Run `/associate [file path]` and confirm that .
2. 
3. Check that the response uses Markdown tables and references files that exist in the repository.
4. 

### Automated tests

- [`packages/opencode/test/session/prompt.test.ts`](packages/opencode/test/session/prompt.test.ts) has 18 tests. 
They cover valid inputs, response structure, potential errors, and meta data.
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
