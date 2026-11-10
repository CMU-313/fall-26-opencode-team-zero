# Traceability: Nathan Peters (npeters)

**Target feature:** permission rules for the AI agent. It lives in
main/packages/opencode/src/permission (folder)
main/packages/opencode/src/util/wildcard.ts
main/packages/opencode/test/permission/properties.test.ts

## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4? | Property (kind) | Test | Mutants it Kills |
|---|---|---|---|---|---|---|---|
| R1 | C-2, S-2: “Anything that edits anything outside of the code space, like if it somehow got access to your local computer file system” | The agent should only be able to inspect, modify, or delete things from within the environment.| With rule {“edit”: “allow”, “external_directory”: “deny”} the agent should only be allowed to change the environment| No | conditional | packages/opencode/test/permission/properties.test.ts:38 | None |
| R2 | C-9, C-10, S-10: “There should still, even if it's always allowed, there should always be some kind of heads up, like, even just, like, a pop-up that's like, hey, something happened.”| For every generated valid command evaluated as allow, executing it emits at least one notification/audit event identifying that command | With rules {“*”: “allow”} there should be a record printed to the terminal if any command is run | yes | Conditional | packages/opencode/test/permission/properties.test.ts:52 | H3 |
| R3 | S-14, C-1: “the user should be king”, “should be anytime any actual files are being edited or changed in any way” | When a command is asked for the first time, it should default to asking the user for permission | The default should be {“*”: “ask”} and any subsequent call should specify from this state. | No | N/A | N/A | None |
| R4 | S-4: “ I think you should explain what it's doing before it asks me for those permissions” | For every generated command evaluated as ask, the permission request contains the complete command and a nonempty explanation | With rules {“*”: “ask”}, any command should provide the command and a short summary when run. | no | conditional | N/A | None |
| R5 | O-12, O-13, S-12: “It should give some kind of acknowledgement and then not do whatever it was meant to”| For every generated command evaluated as deny, execution does not occur and a denial event containing the complete command is emitted | With {“git *”: ”deny”} if git add . is tried by the LLM, The full command is written to the terminal. | No | invariant | packages/opencode/test/permission/properties.test.ts:90 | H2 |
| R6 | O-9: “I think the previous permissions still, Should still stand unless like, The new permissions overriding older one or an existing one” | Newer permissions should override older ones | With rules {“edit”: {“*”:”deny”, “src/*”:”allow”}} editing src/app.ts is allowed, but editing README.md is not | No | metamorphic | packages/opencode/test/permission/properties.test.ts:141 | H1 |

Properties written or suggested by opencode or another AI tool:
R1: I used codex to implement the property.
R2: I used codex to adjust the requirements and implement the property.
R4: I used codex to adjust the requirements.
R5: I used codex to adjust the requirements and implement the property.
R6: I used codex to implement the property.

## Requirement changes

| ID | Original requirement (P3) | Revised requirement | Why it changed |
|---|---|---|---|
|R2| When an allowed command is given, the user should be notified. | For every generated valid command evaluated as allow, executing it emits at least one notification/audit event identifying that command| The original requirement was a little vague and hard to make deterministic |
|R4| There should be an explanation with the command when it asks you if you accept it. |For every generated command evaluated as ask, the permission request contains the complete command and a nonempty explanation | The original requirement was a little vague and hard to make deterministic |
|R5| When a command is denied, there should be an acknowledgement from the agent of the denial and what was denied | For every generated command evaluated as deny, execution does not occur and a denial event containing the complete command is emitted | The original requirement was a little vague and hard to make deterministic|

## Hand-written mutants

| ID | Requirement targeted | Change | Predicted killer | Actual result |
|---|---|---|---|---|
| [H1](../mutants/npeters/H1.patch) | R6 | permission/index.ts takes the first matching rule. | R6. When both rules match and their actions differ, the older action wins. | Killed by R6. With older `allow` and newer `ask`, the mutant returned `allow` for `src/app.ts`. |
| [H2](../mutants/npeters/H2.patch) | R5 | permission/index.ts skips the evaluation log for denials. | R5. The request still fails with DeniedError, but the test cannot find the command in the log. | Killed by R5. The generated pattern `git A` was denied, but its evaluation log was missing. |
| [H3](../mutants/npeters/H3.patch) | R2 | permission/index.ts skips the evaluation log for commands already allowed by a rule. | R2. The request succeeds, but the test cannot find the command in the log. | Killed by R2. The generated pattern `git _` was allowed, but its evaluation log was missing. |
| [H4](../mutants/npeters/H4.patch) | R2 | permission/index.ts publishes a reply event for rejection. | None. R2 uses an existing allow rule and never replies to a pending request. | Survived. All four properties passed. None sends an approval reply. |
| [H5](../mutants/npeters/H5.patch) | R1 | tool/external-directory.ts checks edit permission for an outside path, so allowing edits can bypass an external directory denial. | None. R1 evaluates both permission names directly and never calls the directory guard. | Survived. All four properties passed. None calls the external directory guard. |

Each patch was applied individually and tested from `packages/opencode` with `bun test test/permission/properties.test.ts --timeout 30000`, then reversed. All four properties passed before the first mutation and after the last reversal.
