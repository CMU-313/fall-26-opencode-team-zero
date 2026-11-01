# Traceability: Jay Yip (jayy)

**Target feature:** /newcomer command feature that provides guided paths to newcomers to a codebase. It lives in 

- https://github.com/CMU-313/fall-26-opencode-team-zero/blob/38733a62faf4efa2ee17aa70a929b0e432c09abc/packages/opencode/src/command/template/newcomer.txt
- https://github.com/CMU-313/fall-26-opencode-team-zero/blob/38733a62faf4efa2ee17aa70a929b0e432c09abc/packages/opencode/src/command/index.ts
- https://github.com/CMU-313/fall-26-opencode-team-zero/blob/38733a62faf4efa2ee17aa70a929b0e432c09abc/packages/opencode/src/session/prompt.ts
- https://github.com/CMU-313/fall-26-opencode-team-zero/blob/38733a62faf4efa2ee17aa70a929b0e432c09abc/packages/opencode/test/effect/runner.test.ts

## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4? | Property (kind) | Test |
|---|---|---|---|---|---|---|
| R1 |C-2, S-4, O-4: “Something that should never happen is my feature misleading the user.”  |The /newcomer command must only recommend files and directories that exist in the codebase. |If the command recommends for example src/index.ts, that file must exist in the current codebase.  |No | | |
| R2 |C-4, S-5: “With minimal experience, it should incrementally understand the codebase”  |The command should provide simple explanations and terminology for beginner developers.  |When a beginner runs the /newcomer command, the output uses simple explanations and introduces important files without overwhelming technical details |Yes | | |
| R3 |C-5, C-6: “I would also hope to see greater technical terminology (and thus more specific details).” |The command should provide more technical details to more experienced developers.  |When an advanced developer runs the /newcomer command, the output includes more specific information about the codebase’s architecture and functions.  |Yes | | |
| R4 |C-3, S-3: “It should always be a table and then should have relatively same output on two same runs”  |The command should produce consistently formatted results when given the same inputs.  |Running /newcomer twice with the same developer level and codebase produces tables with similar structure and generally similar recommendations, including the same major entry points.  |Yes | | |
| R5 |C-7, S-6, O-7: “In a smaller codebase, the modules should be broken down more in-depth and more specific |The command should adjust the level of detail based on the size of the codebase.  |When run on a small codebase, the command highlights specific files and functions. On a large codebase, however, it provides a broader overview of major directories and modules.  |Yes | | |
| R6 |C-11, C-12: “You can provide quick summaries on the difference you should expect”  |The command should explain what each developer level offers before the user makes a selection  |When the developer level selection appears, each option includes a short description explaining what kind of guidance the user will receive. |No | | |
| R7 |O-9: “One thing I would change about my feature is moving from overview to each different module more clearly”  |The command should clearly guide users from the general project overview to individual modules.  |After presenting the project overview, the command identifies major modules and explains where the user should begin exploring each one.  |No | | |

Properties written or suggested by opencode or another AI tool: None

## Requirement changes

| ID | Original requirement (P3) | Revised requirement | Why it changed |
|---|---|---|---|
