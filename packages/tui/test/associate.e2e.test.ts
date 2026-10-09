import { expect, mock, test } from "bun:test"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { Global } from "@opencode-ai/core/global"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { GlobalEvent } from "@opencode-ai/sdk/v2"
import { createTestRenderer } from "@opentui/core/testing"
import { Effect } from "effect"
import { createEventSource, createFetch, directory, json } from "./fixture/tui-sdk"
import { createTuiResolvedConfig } from "./fixture/tui-runtime"

test("e2e: /associate submits the source path and renders the association report", async () => {
  const setup = await createTestRenderer({ width: 120, height: 30, useThread: false })
  const core = await import("@opentui/core")
  mock.module("@opentui/core", () => ({ ...core, createCliRenderer: async () => setup.renderer }))
  const events = createEventSource()
  let api: TuiPluginApi | undefined
  let command: Record<string, unknown> | undefined
  const session = {
    id: "dummy",
    title: "Associate demo",
    slug: "dummy",
    projectID: "project",
    directory,
    version: "0.0.0-test",
    time: { created: 0, updated: 0 },
  }
  const report = [
    "| Function | Source | Test(s) | Association |",
    "| --- | --- | --- | --- |",
    "| add | src/math.ts:1 | test/math.test.ts:5 | direct — called by the test |",
    "| subtract | src/math.ts:2 | — | untested — no matching test found |",
    "",
    "## Coverage gaps",
    "",
    "- subtract has no associated test.",
  ].join("\n")
  const calls = createFetch((url) => {
    if (url.pathname === "/config/providers")
      return json({
        providers: [{ id: "test", name: "Test", models: { model: { id: "model", name: "Model" } } }],
        default: { test: "model" },
      })
    if (url.pathname === "/agent") return json([{ name: "learn", mode: "primary" }])
    if (url.pathname === "/command")
      return json([
        {
          name: "associate",
          description: "associate functions in a file with their tests",
          agent: "learn",
          source: "command",
          template: "",
          hints: ["$ARGUMENTS"],
        },
      ])
    if (url.pathname === "/session") return json([session])
    if (url.pathname === "/session/dummy") return json(session)
    if (url.pathname === "/session/dummy/message") return json([])
    if (url.pathname === "/session/dummy/todo" || url.pathname === "/session/dummy/diff") return json([])
  })
  const server = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    if (request.method === "POST" && new URL(request.url).pathname === "/session/dummy/command") {
      command = await request.json()
      const assistant = {
        id: "msg_associate",
        sessionID: session.id,
        role: "assistant" as const,
        agent: "learn",
        modelID: "model",
        providerID: "test",
        mode: "build",
        parentID: "msg_user",
        path: { cwd: directory, root: directory },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        time: { created: 1, completed: 2 },
      }
      const global = (payload: GlobalEvent["payload"]): GlobalEvent => ({
        directory,
        project: session.projectID,
        payload,
      })
      events.emit(
        global({
          id: "evt_associate_message",
          type: "message.updated",
          properties: { sessionID: session.id, info: assistant },
        }),
      )
      events.emit(
        global({
          id: "evt_associate_part",
          type: "message.part.updated",
          properties: {
            sessionID: session.id,
            time: 2,
            part: {
              id: "prt_associate",
              sessionID: session.id,
              messageID: assistant.id,
              type: "text",
              text: report,
            },
          },
        }),
      )
      return json({ info: assistant, parts: [] })
    }
    return calls.fetch(input, init)
  }) as typeof fetch
  let started!: () => void
  const ready = new Promise<void>((resolve) => {
    started = resolve
  })

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

    "/associate src/math.ts".split("").forEach((key) => setup.mockInput.pressKey(key))
    await setup.renderOnce()
    setup.mockInput.pressEnter()
    for (let index = 0; index < 100 && !command; index++) await Bun.sleep(10)

    expect(command).toMatchObject({ command: "associate", arguments: "src/math.ts", agent: "learn" })
    for (let index = 0; index < 100; index++) {
      await setup.renderOnce()
      if (setup.captureCharFrame().includes("subtract")) break
      await Bun.sleep(10)
    }
    expect(setup.captureCharFrame()).toContain("subtract")
    expect(setup.captureCharFrame()).toContain("untested")
    expect(setup.captureCharFrame()).toContain("Coverage gaps")

    api?.keymap.dispatchCommand("app.exit")
    await task
  } finally {
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
    mock.restore()
  }
}, 30_000)
