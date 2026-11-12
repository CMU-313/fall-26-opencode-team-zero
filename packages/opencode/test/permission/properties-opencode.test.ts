import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { expect } from "bun:test"
import fc from "fast-check"
import { Effect, Layer, Logger } from "effect"
import { EffectBridge } from "../../src/effect/bridge"
import { EventV2Bridge } from "../../src/event-v2-bridge"
import { Permission } from "../../src/permission"
import { InstanceBootstrap } from "../../src/project/bootstrap"
import { InstanceStore } from "../../src/project/instance-store"
import { SessionID } from "../../src/session/schema"
import { testEffect } from "../lib/effect"

const commands = fc
  .array(fc.stringMatching(/^[a-zA-Z0-9._/-]+$/), { minLength: 1, maxLength: 5 })
  .map((tokens) => tokens.join(" "))
const logs: unknown[] = []
const logger = Logger.make((options) => logs.push(options.message))
const noopBootstrap = Layer.succeed(InstanceBootstrap.Service, InstanceBootstrap.Service.of({ run: Effect.void }))
const env = AppNodeBuilder.build(
  LayerNode.group([Permission.node, EventV2Bridge.node, CrossSpawnSpawner.node, InstanceStore.node]),
  [[InstanceStore.bootstrapNode, noopBootstrap]],
).pipe(Layer.provideMerge(Logger.layer([logger])))
const it = testEffect(env)

it.instance(
  "R2: every allowed command emits an audit record identifying it",
  () =>
    Effect.gen(function* () {
      const permission = yield* Permission.Service
      const bridge = yield* EffectBridge.make()
      const ruleset = Permission.fromConfig({ "*": "allow" })

      yield* Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(commands, async (command) => {
            logs.length = 0
            expect(Permission.evaluate("bash", command, ruleset).action).toBe("allow")

            await bridge.promise(
              permission.ask({
                sessionID: SessionID.make("session_property_opencode_allow"),
                permission: "bash",
                patterns: [command],
                metadata: { command },
                always: [],
                ruleset,
              }),
            )

            expect(logs).toContainEqual([
              "evaluated",
              {
                permission: "bash",
                pattern: command,
                action: { permission: "*", pattern: "*", action: "allow" },
              },
            ])
          }),
        ),
      )
    }),
  { git: true },
)
