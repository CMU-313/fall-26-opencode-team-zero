# User Documentation (5)

## Vlad - X

## Jay - X

## Cathy - X

## Janna - X

## Nate - Finding related tests of a given file (`/associate`).

The `/associate` command gives developers the ability to select files in the current codebase and explore how the functions within are being tested.

### How to use it

Run `/associate [file path]`

Some examples of correct :

/associate
/associate
/associate

If a valid file is included, only the scope question appears. If the file is not valid, the command throws an error and does not send the LLM a request. If the 

### User testing

1. Run `/associate` and confirm that the experience and scope questions appear.
2. Try beginner and advanced levels and check that the amount of technical detail changes.
3. Try a built-in scope and a custom scope and check that the response stays on that topic.
4. Check that the response uses Markdown tables and references files that exist in the repository.
5. Dismiss the questions and confirm that no guide is generated.

### Automated tests

- [`packages/opencode/test/session/prompt.test.ts`](packages/opencode/test/session/prompt.test.ts) has 20 focused tests and 10 integration tests. They cover all experience levels and built-in scopes, invalid and custom input, prompt creation, saved messages, cancellation, and concurrent sessions.
- [`packages/opencode/test/cli/serve/serve-process.test.ts`](packages/opencode/test/cli/serve/serve-process.test.ts) has three end-to-end tests using a real `opencode serve` process and production HTTP routes. They cover a normal run, an advanced user with a custom scope, and cancellation without saving a prompt or contacting the model. The tests also confirm that the question reply and rejection routes acknowledge each action before the workflow continues.

Run them from `packages/opencode`:

```bash
bun test test/session/prompt.test.ts --test-name-pattern associate
bun test test/
bun typecheck
```

These tests cover the main input choices, the connection between the command, question, session, and model services, and the full workflow through the server. They also cover failure cases such as invalid input. Checking the route acknowledgement, saved messages, and model calls verifies both the visible result and the cleanup behind it.