import { PermissionV1 } from "@opencode-ai/core/v1/permission"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { expect, test } from "bun:test"
import fc from "fast-check"
import { Cause, Effect, Exit, Fiber, Layer, Logger } from "effect"
import os from "os"
import { EffectBridge } from "../../src/effect/bridge"
import { EventV2Bridge } from "../../src/event-v2-bridge"
import { Permission } from "../../src/permission"
import { InstanceBootstrap } from "../../src/project/bootstrap"
import { InstanceStore } from "../../src/project/instance-store"
import { MessageID, SessionID } from "../../src/session/schema"
import { assertExternalDirectoryEffect } from "../../src/tool/external-directory"
import { pollWithTimeout, testEffect } from "../lib/effect"

fc.configureGlobal({ seed: 42 })

//creates tokens randomly with git to test
const commands = fc
  .array(fc.stringMatching(/^[a-zA-Z0-9._/-]+$/), { minLength: 1, maxLength: 5 })
  .map((tokens) => ["git", ...tokens].join(" "))
//creates random paths outside the project
const paths = fc
  .array(fc.stringMatching(/^[a-zA-Z0-9_-]+$/), { minLength: 1, maxLength: 5 })
  .map((segments) => `/outside/${segments.join("/")}`)
//sets the permissions to allow, ask or deny
const actions = fc.constantFrom<PermissionV1.Action>("allow", "ask", "deny")
//creates a log for mocking output
const logs: unknown[] = []
const logger = Logger.make((options) => logs.push(options.message))
const noopBootstrap = Layer.succeed(InstanceBootstrap.Service, InstanceBootstrap.Service.of({ run: Effect.void }))
const env = AppNodeBuilder.build(
  LayerNode.group([Permission.node, EventV2Bridge.node, CrossSpawnSpawner.node, InstanceStore.node]),
  [[InstanceStore.bootstrapNode, noopBootstrap]],
).pipe(Layer.provideMerge(Logger.layer([logger])))
const it = testEffect(env)

// external directories are never allowed to be accessed by opencode
//kind: invariant
it.instance("R1: the external directory guard rejects generated outside paths", () =>
  Effect.gen(function* () {
    const permission = yield* Permission.Service
    const bridge = yield* EffectBridge.make()
    yield* Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(paths, fc.constantFrom("file" as const, "directory" as const), async (target, kind) => {
          const exit = await bridge.promise(
            assertExternalDirectoryEffect(
              {
                sessionID: SessionID.make("session_property_external"),
                messageID: MessageID.make("msg_property_external"),
                agent: "build",
                abort: new AbortController().signal,
                messages: [],
                metadata: () => Effect.void,
                ask: (input) =>
                  permission
                    .ask({
                      ...input,
                      sessionID: SessionID.make("session_property_external"),
                      ruleset: Permission.fromConfig({ edit: "allow", external_directory: "deny" }),
                    })
                    .pipe(Effect.orDie),
              },
              target,
              { kind },
            ).pipe(Effect.exit),
          )
          expect(Exit.isFailure(exit)).toBe(true)
          if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBeInstanceOf(PermissionV1.DeniedError)
        }),
      ),
    )
  }),
)

//there will be a record if a command is allowed
//kind: conditional
it.instance(
  "R2: allowed commands emit an audit record identifying the command",
  () =>
    Effect.gen(function* () {
      logs.length = 0
      const permission = yield* Permission.Service
      const bridge = yield* EffectBridge.make()

      yield* Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(commands, async (command) => {
            logs.length = 0
            await bridge.promise(
              permission.ask({
                sessionID: SessionID.make("session_property_allow"),
                permission: "bash",
                patterns: [command],
                metadata: { command },
                always: [],
                ruleset: [{ permission: "bash", pattern: "*", action: "allow" }],
              }),
            )
            expect(logs).toContainEqual([
              "evaluated",
              {
                permission: "bash",
                pattern: command,
                action: { permission: "bash", pattern: "*", action: "allow" },
              },
            ])
          }),
        ),
      )
    }),
  { git: true },
)

//for every denied command, execution cannot occur and a record must be emitted.
//kind: invariant
it.instance(
  "R5: denied commands do not execute and emit an audit record identifying the command",
  () =>
    Effect.gen(function* () {
      logs.length = 0
      const permission = yield* Permission.Service
      const bridge = yield* EffectBridge.make()
      const executed: string[] = []

      yield* Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(commands, async (command) => {
            logs.length = 0
            const ruleset: PermissionV1.Ruleset = [
              { permission: "edit", pattern: "*", action: "allow" },
              { permission: "*", pattern: "unrelated", action: "ask" },
              { permission: "bash", pattern: "git *", action: "deny" },
            ]
            const exit = await bridge.promise(
              permission
                .ask({
                  sessionID: SessionID.make("session_property_deny"),
                  permission: "bash",
                  patterns: [command],
                  metadata: { command },
                  always: [],
                  ruleset,
                })
                .pipe(
                  Effect.andThen(
                    Effect.sync(() => {
                      executed.push(command)
                    }),
                  ),
                  Effect.exit,
                ),
            )

            expect(Exit.isFailure(exit)).toBe(true)
            if (Exit.isFailure(exit)) {
              const error = Cause.squash(exit.cause)
              expect(error).toBeInstanceOf(PermissionV1.DeniedError)
              if (error instanceof PermissionV1.DeniedError) expect(error.ruleset).toEqual(ruleset.slice(1))
            }
            expect(executed).toEqual([])
            expect(logs).toContainEqual([
              "evaluated",
              {
                permission: "bash",
                pattern: command,
                action: { permission: "bash", pattern: "git *", action: "deny" },
              },
            ])
          }),
        ),
      )
    }),
  { git: true },
)

//adding a newer rule changes will result in changes to the locations affected. Locations outside of the scope remain unaffected.
//kind: metamorphic
test("R6: a newer matching permission overrides an older permission", () => {
  fc.assert(
    fc.property(actions, actions, (older, newer) => {
      const ruleset: PermissionV1.Ruleset = [
        { permission: "edit", pattern: "*", action: older },
        { permission: "edit", pattern: "src/*", action: newer },
      ]

      expect(Permission.evaluate("edit", "src/app.ts", ruleset).action).toBe(newer)
      expect(Permission.evaluate("edit", "README.md", ruleset).action).toBe(older)
    }),
  )
})

test("R3: unmatched permissions default to asking", () => {
  fc.assert(
    fc.property(commands, fc.stringMatching(/^[a-z]+$/), (command, name) => {
      const expected = { permission: name, pattern: "*", action: "ask" as const }
      expect(Permission.evaluate(name, command, [])).toEqual(expected)
      expect(
        Permission.evaluate(name, command, [{ permission: `other_${name}`, pattern: "*", action: "allow" }]),
      ).toEqual(expected)
    }),
  )
})

it.instance("R3/R4/R2: asking preserves command context and replies emit acknowledgements", () =>
  Effect.gen(function* () {
    const permission = yield* Permission.Service
    const events = yield* EventV2Bridge.Service
    const bridge = yield* EffectBridge.make()
    yield* Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(
          commands,
          fc.string({ minLength: 1 }).filter((text) => text.trim().length > 0),
          fc.constantFrom("once" as const, "always" as const, "reject" as const),
          fc.boolean(),
          async (command, description, reply, explicit) => {
            await bridge.promise(
              Effect.gen(function* () {
                const seen: unknown[] = []
                const unsubscribe = yield* events.listen((event) => {
                  if (event.type === Permission.Event.Asked.type || event.type === Permission.Event.Replied.type)
                    seen.push({ type: event.type, data: event.data })
                  return Effect.void
                })
                yield* Effect.addFinalizer(() => unsubscribe)
                const id = PermissionV1.ID.ascending()
                const sessionID = SessionID.make("session_property_ask")
                const request = {
                  id,
                  sessionID,
                  permission: "bash",
                  patterns: [command],
                  metadata: { command, description },
                  always: [],
                }
                const executed: string[] = []
                const fiber = yield* permission
                  .ask({ ...request, ruleset: explicit ? [{ permission: "bash", pattern: "*", action: "ask" }] : [] })
                  .pipe(
                    Effect.andThen(
                      Effect.sync(() => {
                        executed.push(command)
                      }),
                    ),
                    Effect.exit,
                    Effect.forkScoped,
                  )
                yield* pollWithTimeout(
                  permission.list().pipe(Effect.map((pending) => pending.find((entry) => entry.id === id))),
                  "permission request never became pending",
                  "1 second",
                )
                expect(executed).toEqual([])
                expect(yield* permission.list()).toEqual([request])
                expect(seen).toContainEqual({ type: Permission.Event.Asked.type, data: request })
                yield* permission.reply({ requestID: id, reply })
                const exit = yield* Fiber.join(fiber)
                expect(seen).toContainEqual({
                  type: Permission.Event.Replied.type,
                  data: { sessionID, requestID: id, reply },
                })
                expect(yield* permission.list()).toEqual([])
                if (reply === "reject") {
                  expect(Exit.isFailure(exit)).toBe(true)
                  if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBeInstanceOf(PermissionV1.RejectedError)
                  expect(executed).toEqual([])
                  return
                }
                expect(Exit.isSuccess(exit)).toBe(true)
                expect(executed).toEqual([command])
              }).pipe(Effect.scoped),
            )
          },
        ),
      ),
    )
  }),
)

test("R6: nested configuration preserves every generated rule in order", () => {
  fc.assert(
    fc.property(
      fc.uniqueArray(
        fc.tuple(fc.stringMatching(/^[a-zA-Z0-9_-]+$/), fc.constantFrom("relative/", "~/", "$HOME/"), actions),
        { selector: (entry) => entry[0], minLength: 1, maxLength: 8 },
      ),
      actions,
      (entries, fallback) => {
        const patterns = entries.map(([name, prefix, action]) => [`${prefix}${name}/*`, action] as const)
        expect(Permission.fromConfig({ edit: { "*": fallback, ...Object.fromEntries(patterns) } })).toEqual([
          { permission: "edit", pattern: "*", action: fallback },
          ...entries.map(([name, prefix, action]) => ({
            permission: "edit",
            pattern: `${prefix === "relative/" ? prefix : `${os.homedir()}/`}${name}/*`,
            action,
          })),
        ])
      },
    ),
  )
})
