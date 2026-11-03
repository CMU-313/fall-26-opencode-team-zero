# Traceability: Nathan Peters (npeters)

**Target feature:** permission rules for the AI agent. It lives in
main/packages/opencode/src/permission
main/packages/opencode/src/util/wildcard.ts

## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4? | Property (kind) | Test |
|---|---|---|---|---|---|---|
| R1 | C-2, S-2: “Anything that edits anything outside of the code space, like if it somehow got access to your local computer file system” | The agent should only be able to inspect, modify, or delete things from within the environment.| With rule {“edit”: “allow”, “external_directory”: “deny”} the agent should only be allowed to change the environment| No | conditional | N/A |

| R2 | C-9, C-10, S-10: “There should still, even if it's always allowed, there should always be some kind of heads up, like, even just, like, a pop-up that's like, hey, something happened.”| When an allowed command is given, the user should be notified. | With rules {“*”: “allow”} there should be a record printed to the terminal if any command is run | yes | Conditional |  |

| R3 | S-14, C-1: “the user should be king”, “should be anytime any actual files are being edited or changed in any way” | When a command is asked for the first time, it should default to asking the user for permission | The default should be {“*”: “ask”} and any subsequent call should specify from this state. | No | N/A | N/A |

| R4 | S-4: “ I think you should explain what it's doing before it asks me for those permissions” | There should be an explanation with the command when it asks you if you accept it. | With rules {“*”: “ask”}, any command should provide the command and a short summary when run. | no | conditional | |

| R5 | O-12, O-13, S-12: “It should give some kind of acknowledgement and then not do whatever it was meant to”| When a command is denied, there should be an acknowledgement from the agent of the denial and what was denied | With {“git *”: ”deny”} if git add . is tried by the LLM, The full command is written to the terminal. | No | invariant | |

| R6 | O-9: “I think the previous permissions still, Should still stand unless like, The new permissions overriding older one or an existing one” | Newer permissions should override older ones | With rules {“edit”: {“*”:”deny”, “src/*”:”allow”}} editing src/app.ts is allowed, but editing README.md is not | No | metamorphic | |

Properties written or suggested by opencode or another AI tool:
R1: I used codex to implement the property.
R2: I used codex to adjust the requirements and implement the property.
R3: I used codex to implement the property.
R4: I used codex to adjust the requirements and implement the property.
R5: I used codex to adjust the requirements and implement the property.
R6: I used codex to implement the property.

## Requirement changes

| ID | Original requirement (P3) | Revised requirement | Why it changed |
|R2| When an allowed command is given, the user should be notified. |For every generated valid command evaluated as allow, executing it emits at least one notification/audit event identifying that command| The original requirement was a little vague and hard to make deterministic |
|R4| There should be an explanation with the command when it asks you if you accept it. |For every generated command evaluated as ask, the permission request contains the complete command and a nonempty explanation | The original requirement was a little vague and hard to make deterministic |
|R5| When a command is denied, there should be an acknowledgement from the agent of the denial and what was denied |For every generated command evaluated as deny, execution does not occur and a denial event containing the complete command is emitted | The original requirement was a little vague and hard to make deterministic |