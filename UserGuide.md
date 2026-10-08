# User Documentation (5)

## Vlad - X

## Jay - X

## Cathy - Repository Learning Map (`/group`)

Open an OpenCode session in a repository, select **Learn** mode, and enter `/group`. The map lists functionality groups. Select one to browse subgroups and files; use **Next page** or **Previous page** on long file lists. Choose **EXPLAIN THIS FUNCTIONALITY** or **EXPLAIN THIS SUBGROUP** to ask for a focused, read-only guide. The answer should cite files, explain relationships to other areas, suggest a reading order, and ask a check-your-understanding question.

To see session-aware ordering, ask Learn to read a file, then run `/group` in the same session. Groups containing files read in this session are prioritized. If model-generated names are unavailable, directory-based names remain. The file inventory is capped at 10,000 paths, so very large repositories can show a partial map. Naming and explanations use model tokens.

**End-to-end test (manual):** In Learn mode, run `/group` in a repository containing `src/`, `test/`, or `packages/` files. Open a group and subgroup, page through files, and request both explanations. The answers should name real files, describe evidence-backed relationships, give a reading order, and ask a learning question. Ask Learn to read a file, reopen `/group`, and confirm its group moves toward the top. In an empty repository, `/group` should show an informational message without crashing. Learn should remain selected throughout. This manual test covers the complete TUI and model workflow; the automated tests below do not launch the full application.

**Unit tests (automated):** [`packages/tui/test/util/repository-functionality.test.ts`](packages/tui/test/util/repository-functionality.test.ts) covers repository layouts, empty inventories, 30-group and 20-subgroup limits, overflow preservation, priority, prompt bounds, and naming fallback. [`packages/tui/test/util/referenced-file.test.ts`](packages/tui/test/util/referenced-file.test.ts) covers completed reads, excluded results, absolute and relative paths, de-duplication, and `/group` registration.

**Integration test (automated):** [`packages/tui/test/integration/repository-map.test.ts`](packages/tui/test/integration/repository-map.test.ts) passes completed read records through path collection, repository grouping, and both naming and explanation prompts. It verifies that a real session path remains prioritized and appears as evidence in the resulting guides. From `packages/tui`, run `bun test test/util/repository-functionality.test.ts test/util/referenced-file.test.ts test/integration/repository-map.test.ts` and `bun typecheck`.


## Janna - X

## Nate - X
