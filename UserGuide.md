# User Documentation (5)

## Vlad - X

## Jay - X

## Cathy - Repository Learning Map (`/group`)

Open an OpenCode session in a repository, select **Learn** mode, and enter `/group`. The map lists functionality groups. Select one to browse subgroups and files; use **Next page** or **Previous page** on long file lists. Choose **EXPLAIN THIS FUNCTIONALITY** or **EXPLAIN THIS SUBGROUP** to ask for a focused, read-only guide. The answer should cite files, explain relationships to other areas, suggest a reading order, and ask a check-your-understanding question.

To see session-aware ordering, ask Learn to read a file, then run `/group` in the same session. Groups containing files read in this session are prioritized. If model-generated names are unavailable, directory-based names remain. The file inventory is capped at 10,000 paths, so very large repositories can show a partial map. Naming and explanations use model tokens.

To user-test the feature, run `/group` in a repository containing `src/`, `test/`, or `packages/` files. Open a group and a subgroup, page through files, and request both explanations. Read a file and reopen the map to inspect its new ordering. In an empty repository, the command should show an informational message without crashing. The current mode should remain Learn throughout; use Build if you want OpenCode to modify files.

Automated tests: [`packages/tui/test/util/repository-functionality.test.ts`](packages/tui/test/util/repository-functionality.test.ts) covers repository layouts, empty and generated-only inventories, 30-group and 20-subgroup limits, reference prioritization, prompt bounds, naming fallback, and path normalization. [`packages/tui/test/util/referenced-file.test.ts`](packages/tui/test/util/referenced-file.test.ts) covers completed reads, excluded results, de-duplication, and `/group` registration. These tests cover the issue's grouping, limit, relevance, and fallback criteria. The dialog and generated answer also need the manual checks above, because these unit tests do not exercise the complete TUI or model. From `packages/tui`, run `bun test test/util/repository-functionality.test.ts test/util/referenced-file.test.ts` and `bun typecheck`.


## Janna - X

## Nate - X
