import { expect, mock, test } from "bun:test"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createTestRenderer } from "@opentui/core/testing"
import { Effect } from "effect"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { Global } from "@opencode-ai/core/global"
import { createTuiResolvedConfig } from "./fixture/tui-runtime"
import { createEventSource, createFetch, directory, json } from "./fixture/tui-sdk"

test("e2e: /group navigates the map and submits both explanation prompts", async () => {
  const setup = await createTestRenderer({ width: 100, height: 30, useThread: false })
  const core = await import("@opentui/core")
  mock.module("@opentui/core", () => ({ ...core, createCliRenderer: async () => setup.renderer }))
  const events = createEventSource()
  let api: TuiPluginApi | undefined
  let filesRequested = false
  const explanations: Array<{ agent: string; text: string }> = []
  const session = {
    id: "dummy",
    title: "Demo",
    slug: "dummy",
    projectID: "project",
    directory,
    version: "0.0.0-test",
    time: { created: 0, updated: 0 },
  }
  const calls = createFetch((url) => {
    if (url.pathname === "/config/providers")
      return json({
        providers: [{ id: "test", name: "Test", models: { model: { id: "model", name: "Model" } } }],
        default: { test: "model" },
      })
    if (url.pathname === "/agent") return json([{ name: "learn", mode: "primary" }])
    if (url.pathname === "/session") return json([session])
    if (url.pathname === "/session/dummy") return json(session)
    if (url.pathname === "/find/file") {
      filesRequested = true
      return json([
        ...Array.from({ length: 20 }, (_, i) => `packages/api/src/file-${i}.ts`),
        "packages/web/src/home.tsx",
      ])
    }
  })
  let namingAgent: string | undefined
  const server = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const route = new URL(request.url).pathname
    if (request.method === "POST" && route === "/session") return json({ id: "naming" })
    if (request.method === "POST" && route === "/session/naming/message") {
      namingAgent = (await request.json()).agent
      return json({ parts: [{ type: "text", text: '{"packages/api":"API files"}' }] })
    }
    if (request.method === "DELETE" && route === "/session/naming") return json({})
    if (request.method === "POST" && route === "/session/dummy/message") {
      const body = await request.json()
      explanations.push({ agent: body.agent, text: body.parts?.[0]?.text })
      return json({ parts: [] })
    }
    return calls.fetch(input, init)
  }) as typeof fetch
  let started!: () => void
  const ready = new Promise<void>((resolve) => (started = resolve))

  try {
    const { run } = await import("../src/app")
    const task = Effect.runPromise(
      run({
        url: "http://test",
        directory,
        config: createTuiResolvedConfig({ plugin_enabled: {} }),
        fetch: server,
        events: events.source,
        args: { continue: true },
        pluginHost: {
          async start(input) {
            input.runtime.setupSlots(input.api)
            api = input.api
            started()
          },
          async dispose() {},
        },
      }).pipe(Effect.provide(AppNodeBuilder.build(Global.node))),
    )
    await ready
    await setup.renderOnce()
    await setup.renderOnce()
    api?.keymap.dispatchCommand("session.references.group")
    for (let i = 0; i < 100 && !filesRequested; i++) await Bun.sleep(10)
    expect(filesRequested).toBe(true)
    expect(namingAgent).toBe("learn")
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Repository Learning Map")
    setup.mockInput.pressEnter()
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("EXPLAIN THIS FUNCTIONALITY")
    setup.mockInput.pressArrow("down")
    setup.mockInput.pressArrow("down")
    setup.mockInput.pressEnter()
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("EXPLAIN THIS SUBGROUP")
    expect(setup.captureCharFrame()).toContain("Next page")
    setup.mockInput.pressArrow("down")
    setup.mockInput.pressArrow("down")
    setup.mockInput.pressEnter()
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Previous page")
    setup.mockInput.pressArrow("down")
    setup.mockInput.pressEnter()
    for (let i = 0; i < 100 && explanations.length < 1; i++) await Bun.sleep(10)
    expect(explanations[0]?.agent).toBe("learn")
    expect(explanations[0]?.text).toContain("Area root: packages/api/src")
    expect(explanations[0]?.text).toContain("packages/api/src/file-0.ts")

    api?.keymap.dispatchCommand("session.references.group")
    for (let i = 0; i < 100; i++) {
      await setup.renderOnce()
      if (setup.captureCharFrame().includes("API files")) break
      await Bun.sleep(10)
    }
    expect(setup.captureCharFrame()).toContain("API files")
    setup.mockInput.pressEnter()
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("EXPLAIN THIS FUNCTIONALITY")
    setup.mockInput.pressArrow("down")
    setup.mockInput.pressEnter()
    for (let i = 0; i < 100 && explanations.length < 2; i++) await Bun.sleep(10)
    expect(explanations[1]?.agent).toBe("learn")
    expect(explanations[1]?.text).toContain("Area root: packages/api")
    expect(explanations[1]?.text).toContain("Do not invent relationships")
    expect(explanations[1]?.text).toContain("reading order")
    expect(explanations[1]?.text).toContain("one question")
    api?.keymap.dispatchCommand("app.exit")
    await task
  } finally {
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
    mock.restore()
  }
}, 15_000)
