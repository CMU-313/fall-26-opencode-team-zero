import { PermissionV1 } from "@opencode-ai/core/v1/permission"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { expect, test } from "bun:test"
import fc from "fast-check"
import { Cause, Effect, Exit, Layer, Logger } from "effect"
import { EffectBridge } from "../../src/effect/bridge"
import { EventV2Bridge } from "../../src/event-v2-bridge"
import { Permission } from "../../src/permission"
import { InstanceBootstrap } from "../../src/project/bootstrap"
import { InstanceStore } from "../../src/project/instance-store"
import { SessionID } from "../../src/session/schema"
import { testEffect } from "../lib/effect"

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
test("R1: external paths are denied even when edits are allowed", () => {
  const ruleset = Permission.fromConfig({ edit: "allow", external_directory: "deny" })

  fc.assert(
    fc.property(paths, (target) => {
      expect(Permission.evaluate("edit", target, ruleset).action).toBe("allow")
      expect(Permission.evaluate("external_directory", target, ruleset).action).toBe("deny")
    }),
  )
})

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
            const exit = await bridge.promise(
              permission
                .ask({
                  sessionID: SessionID.make("session_property_deny"),
                  permission: "bash",
                  patterns: [command],
                  metadata: { command },
                  always: [],
                  ruleset: [{ permission: "bash", pattern: "git *", action: "deny" }],
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
            if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBeInstanceOf(PermissionV1.DeniedError)
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
