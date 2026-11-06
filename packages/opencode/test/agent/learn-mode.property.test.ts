import { afterEach, expect } from "bun:test"
import fc from "fast-check"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Auth } from "../../src/auth"
import { Config } from "../../src/config/config"
import { RuntimeFlags } from "../../src/effect/runtime-flags"
import { Permission } from "../../src/permission"
import { Plugin } from "../../src/plugin"
import { Provider } from "../../src/provider/provider"
import { Skill } from "../../src/skill"
import { disposeAllInstances } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const layer = LayerNode.compile(
  LayerNode.group([Agent.node, Plugin.node, Provider.node, Auth.node, Config.node, Skill.node, RuntimeFlags.node]),
  [[RuntimeFlags.node, RuntimeFlags.layer()]],
)

const it = testEffect(layer)
const allowedLearnPermissions = ["read", "glob", "grep", "webfetch", "websearch"]
const deniedLearnPermissions = ["edit", "write", "bash", "task", "todowrite", "patch", "execute"]

afterEach(async () => {
  await disposeAllInstances()
})

it.instance("R1: every mode switch applies its policy and restores Learn defaults", () =>
  Effect.gen(function* () {
    const agents = yield* Agent.Service
    const learn = yield* agents.get("learn")
    if (!learn) throw new Error("learn agent not found")
    const policy = (agent: Agent.Info) =>
      [...allowedLearnPermissions, ...deniedLearnPermissions].map((permission) =>
        Permission.evaluate(permission, "arbitrary/path", agent.permission).action,
      )
    const expected = policy(learn)
    const available = new Map((yield* agents.list()).map((agent) => [agent.name, agent]))

    // Generate long mode-switch histories and check every selection, not only the final mode.
    fc.assert(
      fc.property(fc.array(fc.constantFrom("build", "plan", "learn"), { minLength: 1, maxLength: 100 }), (switches) => {
        for (const name of switches) {
          const selected = available.get(name)
          expect(selected).toBeDefined()
          expect(Permission.evaluate("edit", "arbitrary/path", selected!.permission).action).toBe(
            name === "build" ? "allow" : "deny",
          )
          if (name === "learn") expect(policy(selected!)).toEqual(expected)
        }
      }),
    )
  }),
)

it.instance("R2: Learn denies shell execution for every command string", () =>
  Effect.gen(function* () {
    const learn = yield* (yield* Agent.Service).get("learn")
    if (!learn) throw new Error("learn agent not found")

    // Shell input can contain whitespace, quoting, paths, and metacharacters, so use arbitrary Unicode strings.
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (command) => {
        expect(Permission.evaluate("bash", command, learn.permission).action).toBe("deny")
      }),
    )
  }),
)

it.instance("R3: Learn exposes exactly the read-only permission set", () =>
  Effect.gen(function* () {
    const learn = yield* (yield* Agent.Service).get("learn")
    if (!learn) throw new Error("learn agent not found")

    // Paths are arbitrary because the Learn policy must not become mutable for a specially shaped path.
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), fc.constantFrom(...allowedLearnPermissions), (path, permission) => {
        expect(Permission.evaluate(permission, path, learn.permission).action).toBe("allow")
      }),
    )
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), fc.constantFrom(...deniedLearnPermissions), (path, permission) => {
        expect(Permission.evaluate(permission, path, learn.permission).action).toBe("deny")
      }),
    )
  }),
)

it.instance("R4: selected primary mode determines its permission policy", () =>
  Effect.gen(function* () {
    const agents = yield* Agent.Service
    const available = new Map((yield* agents.list()).map((agent) => [agent.name, agent]))

    // The model is intentionally small: Build may edit, Plan and Learn may not.
    fc.assert(
      fc.property(fc.array(fc.constantFrom("build", "plan", "learn"), { minLength: 1, maxLength: 100 }), (switches) => {
        const selected = available.get(switches.at(-1)!)
        expect(selected).toBeDefined()
        const expected = selected!.name === "build" ? "allow" : "deny"
        expect(Permission.evaluate("edit", "arbitrary/path", selected!.permission).action).toBe(expected)
      }),
    )
  }),
)
