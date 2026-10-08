# User Documentation (5)

## Vlad - X

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


## Janna - X

## Nate - X
