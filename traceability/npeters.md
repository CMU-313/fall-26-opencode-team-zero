# Traceability: Nathan Peters (npeters)

**Target feature:** permission rules for the AI agent. It lives in
main/packages/opencode/src/permission (folder)
main/packages/opencode/src/util/wildcard.ts
main/packages/opencode/test/permission/properties.test.ts

The mutants live in
mutants/npeters

Agent Failure case lives in
main/packages/opencode/test/permission/properties-opencode.test.ts

## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4? | Property (kind) | Test | Mutants it Kills |
|---|---|---|---|---|---|---|---|
| R1 | C-2, S-2: “Anything that edits anything outside of the code space, like if it somehow got access to your local computer file system” | The agent should only be able to inspect, modify, or delete things from within the environment.| With rule {“edit”: “allow”, “external_directory”: “deny”} the agent should only be allowed to change the environment| No | conditional | packages/opencode/test/permission/properties.test.ts:42 | H5 |
| R2 | C-9, C-10, S-10: “There should still, even if it's always allowed, there should always be some kind of heads up, like, even just, like, a pop-up that's like, hey, something happened.”| For every generated valid command evaluated as allow, executing it emits at least one notification/audit event identifying that command | With rules {“*”: “allow”} there should be a record printed to the terminal if any command is run | yes | Conditional | packages/opencode/test/permission/properties.test.ts:82, :208 | H3, H4 |
| R3 | S-14, C-1: “the user should be king”, “should be anytime any actual files are being edited or changed in any way” | When a command is asked for the first time, it should default to asking the user for permission | The default should be {“*”: “ask”} and any subsequent call should specify from this state. | No | invariant / conditional | packages/opencode/test/permission/properties.test.ts:196, :208 | Default-rule and skipped-ask mutants |
| R4 | S-4: “ I think you should explain what it's doing before it asks me for those permissions” | For every generated command evaluated as ask, the permission request contains the complete command and a nonempty explanation | With rules {“*”: “ask”}, any command should provide the command and a short summary when run. | no | conditional (partial coverage) | packages/opencode/test/permission/properties.test.ts:208 | See Strengthening for coverage limits |
| R5 | O-12, O-13, S-12: “It should give some kind of acknowledgement and then not do whatever it was meant to”| For every generated command evaluated as deny, execution does not occur and a denial event containing the complete command is emitted | With {“git *”: ”deny”} if git add . is tried by the LLM, The full command is written to the terminal. | No | invariant | packages/opencode/test/permission/properties.test.ts:121 | H2 |
| R6 | O-9: “I think the previous permissions still, Should still stand unless like, The new permissions overriding older one or an existing one” | Newer permissions should override older ones | With rules {“edit”: {“*”:”deny”, “src/*”:”allow”}} editing src/app.ts is allowed, but editing README.md is not | No | metamorphic | packages/opencode/test/permission/properties.test.ts:182, :284 | H1 |

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

These are the initial results, before strengthening. Each patch was applied individually and tested from `packages/opencode` with `bun test test/permission/properties.test.ts --timeout 30000`, then reversed. All four original properties passed before the first mutation and after the last reversal. The strengthened suite kills all five patches; see Strengthening below.

## Stryker comparison

- fast-check seed: 42
- Initial mutation score: 70% (28 out of 40 mutants killed, 12 survived).
- After strengthening: Stryker reports 100% (37 killed, 3 timed out, 0 survived out of 40). All 12 original survivors were killed by test failures.

**1) Which of your hand-written mutants did Stryker never generate? Why not?**
Stryker never generated any of my handwritten mutants. H4 and H5 were not generated because they were outside of the scope stryker was given. H1 was not generated because it did not generate a complete reversal of precedence, only removed the rules entirely or how they were evaluated like && to ||. H2 was not generated because stryker removed logging entirely while h2 only suppressed denials. H3 had a similar issue to H2 in that allows was specifically tested rather than logging in general.

**2)Which Stryker survivors would you never have thought of? Are any of them bugs a real developer might plausibly write?**
I would never have thought of adding "stryker was here" into an empty array when it was initialized and setting an if statement to always true. They are bugs a developer might plausibly write because sometimes they might not work methodically when writing code at every moment. They might have to stop and come back at a later time. They could also leave artifacts on accident due to fast typing. The string is just a more obvious example.

**3)What does each approach find that the other doesn't?**
The handwritten approach will often find mistakes in the implementation at the boundaries and can test expected behaviors thoroughly. Stryker will cast a wider net to help find the unexpected behaviors. These can provide jumping off points for finding more properties to test.

## Strengthening

- R1 now generates outside file and directory paths and calls `assertExternalDirectoryEffect` with the real permission service. The original property only evaluated permission names independently. H5 is now killed: changing the guard to request `edit` allows the operation, violating the denial assertion.
- R2 and R5 clear captured audit logs before each generated command, so records from earlier cases cannot satisfy later assertions. R5 also checks the complete `DeniedError.ruleset`, including a matching wildcard permission and excluding an unrelated permission.
- A new R3 property compares the complete fallback rule for generated permission names and commands, with both empty and nonmatching rulesets.
- A new R3/R4/R2 property generates commands, nonempty descriptions, explicit/default ask rules, and `once`, `always`, or `reject` replies. It waits for an observable pending request, verifies that execution has not occurred, checks the complete request and asked event, and then checks the reply event, result, and pending-request cleanup. H4 is now killed when an approval reply omits its acknowledgement.
- R4 coverage here verifies preservation of a caller-supplied explanation. It does not establish that every tool produces an explanation or that the UI displays it.
- A new R6 configuration property generates unique nested patterns, actions, and relative/home-prefixed paths. It compares the complete converted ruleset in insertion order, including fallback and expanded paths, detecting missing, altered, or extra rules.

All additions use fast-check properties; no example-based tests were added. Codex assisted with these changes, including the new R3 and R4 coverage.

## Ignored
No mutants were ignored or excluded as equivalent.

## Agent Failure Case
- Transcript Excerpt:
    - Prompt: add a fast-check property test for agent permissions in traceability/npeters.md R2. Put the new property test in a new file main/packages/opencode/test/permission/properties-opencode.test.ts
    - Response: /workspaces/fall-26-opencode-team-zero/traceability/npeters-opencode-gen.png
I was unable to copy the session to clipboard possibly because I use a mac.

- surviving mutant:
- why the property was too weak:
- strengthened version and evidence: