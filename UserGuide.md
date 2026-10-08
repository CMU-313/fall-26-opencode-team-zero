# User Documentation (5)

## Vlad - X

## Jay - X

## Cathy - Repository Learning Map (`/group`)

In an OpenCode repository session, select **Learn** and run `/group`. Open a functionality group to browse its subgroups and files (18 per page), or select **EXPLAIN THIS FUNCTIONALITY** / **EXPLAIN THIS SUBGROUP** for file-based guidance, relationships, a reading order, and a learning question. If Learn has read a file in this session, rerun `/group` to prioritize its group. Structural names remain if model naming fails; inventories over 10,000 files may be partial.

**Manual end-to-end check:** Browse a group and subgroup, change pages, and request both explanations. Check that the answers cite real files and that a newly read file moves its group up. An empty repository should show a message without crashing. This checks the live model response.

**Automated tests:** [Unit grouping](packages/tui/test/util/repository-functionality.test.ts) covers layouts, limits, prioritization, prompts, and fallback; [unit read collection](packages/tui/test/util/referenced-file.test.ts) covers completed reads, paths, and `/group` registration. The [integration test](packages/tui/test/integration/repository-map.test.ts) traces a read through grouping and explanation prompts. The [TUI E2E test](packages/tui/test/group-map.e2e.test.ts) uses a mock server to open `/group` and navigate groups, subgroups, and pages. Together these cover #12's acceptance criteria; the manual check covers live model output. From `packages/tui`, run `bun test` and `bun typecheck`.


## Janna - X

## Nate - X
