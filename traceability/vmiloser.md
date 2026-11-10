# Traceability: Vlad Miloserdov (vmiloser)

**Target feature:** Learn Mode

The relevant files are as follows:
- packages/opencode/src/agent/agent.ts — defines the learn agent and its allow/deny permission rules.
- packages/opencode/src/session/tools.ts — marks Learn tool resolution as read-only and excludes MCP resource tools.
- packages/opencode/src/tool/registry.ts — enforces the read-only tool allowlist: read, glob, grep, webfetch, and websearch.
- packages/opencode/src/session/prompt.ts — blocks direct shell commands and disallowed slash commands in Learn.
- packages/opencode/src/session/reminders.ts — adds the Learn-mode behavioral reminder to the conversation.
- packages/opencode/src/agent/prompt/learn.txt — the natural-language system instruction for Learn.



## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4? | Property (kind) | Test |
|---|---|---|---|---|---|---|
| R1 | C-11, O-8:<br>- "I expect everything to go back to default settings, because I could forget what I switched"<br>- "I would like it to be reset to default. … when you switch to something, everything should go back to default." | Each primary-mode selection applies that mode's policy, and every return to Learn restores Learn's fixed default policy. | For every generated sequence of Build, Plan, and Learn selections, each step has the expected edit decision; every Learn step has the initial Learn policy. | Yes | Round-trip | `packages/opencode/test/agent/learn-mode.property.test.ts` — R1 |
| R2 | O-15, S-11, C-17:<br>- "Human should be able to run things."<br>- "Yes, it seems strange that humans cannot change the code" | Learn rejects agent shell execution for every command; a human can still use their normal terminal outside the agent. | Every generated shell command string evaluates to `deny` for Learn's `bash` permission. | Yes | Invariant | `packages/opencode/test/agent/learn-mode.property.test.ts` — R2 |
| R3 | C-7, O-4:<br>- "No, because then I do not see the point of Learn mode"<br>- "… feel like it should only read, and I would not want it to change anything…" | The agent should not be allowed to change anything in the codebase while in Learn Mode. | For every generated path, `read`, `glob`, `grep`, `webfetch`, and `websearch` are allowed; mutation, shell, task, and execution permissions are denied. Session tool resolution also excludes custom and MCP resource tools. | No | Invariant | `packages/opencode/test/agent/learn-mode.property.test.ts` — R3 |
| R4 | C-1, S-1:<br>- "I have never used both modes in one session chat, because I prefer to have different chats for different issues."<br>- "Yes, I used a little bit of both. One session, sometimes." | A selected primary mode supplies its own permission policy without changing session content. | For every generated selection sequence, the final mode's edit permission matches the policy model: Build allows it; Plan and Learn deny it. | Yes | Model / oracle | `packages/opencode/test/agent/learn-mode.property.test.ts` — R4 |
| R5 | S-21, C-22:<br>- "I would use git diff to check"<br>- "I would use git status" | The interface makes version-control status available when a user requests it. | The existing session interface continues to expose VCS status; automatic `git status` after every model response is not part of Learn Mode. | Yes | Not property-tested (out of scope) | N/A |

Properties written or suggested by Codex: R1, R2, R3, and R4. I reviewed the generated inputs, oracle, and assertions against the Learn-mode implementation.

## Requirement changes

| ID | Original requirement (P3) | Revised requirement | Why it changed |
|---|---|---|---|
| R1 | Learn permissions reset after a user changes permissions and switches modes. | Each selection applies its mode policy, and returning to Learn restores its fixed default policy. | Learn has no per-session editable permission state; its native policy is defined by the Learn agent and is selected again when the user returns. |
| R2 | Users can run any Learn shell command, including file-changing commands. | Learn rejects agent shell execution; people can still run commands in their own terminal. | The implemented read-only safety boundary intentionally blocks the agent shell, including commands with side effects. |
| R4 | Mode switching changes permissions and preserves session content. | The selected primary mode determines its own permission policy. | Permission selection is enforceable in the agent configuration; preserving all session-content behavior is covered by session tests rather than the Learn policy unit. |
| R5 | The agent runs and displays `git status` after every response. | The interface exposes VCS status when requested. | Automatically running `git status` on every response was not implemented by Learn Mode and would add unrelated provider-turn behavior. |


## Hand-written mutants
| ID | 	Requirement targeted | Change | Predicted Killer | Actual Result |
|---|---|---|---|---|
| H1 | R1 | `src/agent/agent.ts`: in Learn’s permission config, add `edit: "allow"` after `"*": "deny"` which would let Learn edit files. | R1 and R3, R1 checks consistent permissions, R3 checks specifically `edit`. | X | 
| H2 | R2 | `src/agent/agent.ts` add `bash: "allow"` to Learn’s permissions, simulating the develop changing something for convenience. | R2, because it checks all bash commands. | X | 
| H3 | R3 | `src/agent/agent.ts`: change `websearch: "allow"` to `websearch: "deny"`, which could happen if someone wanted to make a lame attempt at 'sandboxing' the agent | R3, because that is the one that checks read-only ability. | X | 
| H4 | R4 | `src/agent/agent.ts`: change the `"*" : deny` to `"*" : allow`| R4 and R1, because both check for editing. | X |
| H5 | R3 | `src/tool/registry.ts:` add WriteTool.id to the readonly set in tools(), exposing the write tool in Learn’s resolved tool catalog even though Learn’s permission policy denies it at execution.| R1, that is the one the checks that nothing could be edited. | X |