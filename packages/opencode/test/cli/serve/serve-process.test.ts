// Subprocess integration tests for `opencode serve`. Spawns the real CLI in
// headless mode and exercises it over HTTP — this is the only test tier that
// catches bugs spanning argv → server boot → routing → instance loading.
//
// `serve` is long-lived: the harness returns a handle (url/port/kill/exited)
// and kills the process when the test scope closes. The OS-assigned port is
// parsed off the "listening on http://..." line.
import { describe, expect } from "bun:test"
import { Effect, Fiber } from "effect"
import { HttpClient } from "effect/unstable/http"
import { cliIt } from "../../lib/cli-process"
import { pollWithTimeout } from "../../lib/effect"

const json = Effect.fn("test.json")(function* <A>(url: string, directory: string, init?: RequestInit) {
  const response = yield* Effect.promise(() =>
    fetch(url, {
      ...init,
      headers: { "content-type": "application/json", "x-opencode-directory": directory, ...init?.headers },
    }),
  )
  return { body: (yield* Effect.promise(() => response.json())) as A, status: response.status }
})

const pendingNewcomer = Effect.fn("test.pendingNewcomerE2E")(function* (input: {
  url: string
  directory: string
  arguments: string
}) {
  const session = yield* json<{ id: string }>(`${input.url}/session`, input.directory, {
    method: "POST",
    body: JSON.stringify({ title: "Newcomer E2E" }),
  })
  const command = yield* json<unknown>(`${input.url}/session/${session.body.id}/command`, input.directory, {
    method: "POST",
    body: JSON.stringify({ command: "newcomer", arguments: input.arguments, model: "test/test-model" }),
  }).pipe(Effect.forkChild)
  const question = yield* pollWithTimeout(
    json<Array<{ id: string; questions: Array<{ header: string }> }>>(`${input.url}/question`, input.directory).pipe(
      Effect.map((response) => response.body[0]),
    ),
    "newcomer question did not reach the HTTP API",
    "20 seconds",
  )
  return { command, question, session: session.body }
})

describe("opencode serve (subprocess)", () => {
  // Smoke test: server starts, binds a port, and /global/health responds.
  // If this fails, all other serve tests likely will too — debug here first.
  cliIt.live(
    "starts, binds a port, and serves /global/health",
    ({ opencode }) =>
      Effect.gen(function* () {
        const server = yield* opencode.serve()
        expect(server.port).toBeGreaterThan(0)
        expect(server.url).toMatch(/^http:\/\//)

        const client = yield* HttpClient.HttpClient
        const res = yield* client.get(`${server.url}/global/health`)
        expect(res.status).toBe(200)
        // GlobalHealth schema is { success: true, ... } | { success: false, error }.
        // We don't lock in further shape here — any 200 with parseable JSON is
        // enough proof the routing + auth-bypass + instance loading is alive.
        const body = yield* res.json
        expect(body).toBeDefined()
      }),
    60_000,
  )

  // The scope-close finalizer must actually terminate the child. Without this
  // test a regression in the kill path (e.g. a future refactor that forgets
  // to wire the finalizer) would leak processes on every test run.
  cliIt.live(
    "kills the subprocess on scope close",
    ({ opencode }) =>
      Effect.gen(function* () {
        // Inner scope so we can observe `.exited` resolving after it closes.
        const exitedPromise = yield* Effect.scoped(
          Effect.gen(function* () {
            const server = yield* opencode.serve()
            // Capture the Promise, not the resolved value — scope closes after
            // this gen returns, at which point the finalizer kills the child.
            return server.exited
          }),
        )
        // After scope close: finalizer fired, process must have exited.
        const code = yield* Effect.promise(() => exitedPromise)
        // Bun reports the exit code; SIGTERM-killed processes return non-null
        // (typically 143 on POSIX). We just require resolution within a sane
        // window — anything else means the kill didn't take.
        expect(typeof code === "number" || code === null).toBe(true)
      }),
    60_000,
  )

  ;[
    { name: "guided selection", arguments: "", scope: "Entry points", answers: [["Beginner"], ["Entry points"]] },
    { name: "custom scope", arguments: "advanced", scope: "Authentication & sessions", answers: [["Authentication & sessions"]] },
  ].forEach((scenario) =>
    cliIt.live(
      `completes the newcomer ${scenario.name} end to end`,
      ({ home, llm, opencode }) =>
        Effect.gen(function* () {
          const server = yield* opencode.serve()
          yield* llm.text("generated guide")
          const test = yield* pendingNewcomer({ url: server.url, directory: home, arguments: scenario.arguments })
          expect(test.question.questions.map((question) => question.header)).toEqual(
            scenario.arguments ? ["Scope"] : ["Experience", "Scope"],
          )
          expect(
            (
              yield* json<boolean>(`${server.url}/question/${test.question.id}/reply`, home, {
                method: "POST",
                body: JSON.stringify({ answers: scenario.answers }),
              })
            ).body,
          ).toBe(true)
          expect((yield* Fiber.join(test.command)).status).toBe(200)
          const messages = yield* json<Array<{ info: { role: string } }>>(
            `${server.url}/session/${test.session.id}/message`,
            home,
          )
          expect(messages.body.map((message) => message.info.role)).toEqual(["user", "assistant"])
          expect(JSON.stringify(yield* llm.inputs)).toContain(scenario.scope)
        }),
      90_000,
    ),
  )

  cliIt.live(
    "rejects the newcomer flow end to end without persistence",
    ({ home, llm, opencode }) =>
      Effect.gen(function* () {
        const server = yield* opencode.serve()
        const test = yield* pendingNewcomer({ url: server.url, directory: home, arguments: "beginner" })
        expect(
          (yield* json<boolean>(`${server.url}/question/${test.question.id}/reject`, home, { method: "POST" })).body,
        ).toBe(true)
        expect((yield* Fiber.join(test.command)).status).toBeGreaterThanOrEqual(400)
        expect((yield* json<unknown[]>(`${server.url}/session/${test.session.id}/message`, home)).body).toEqual([])
        expect(yield* llm.calls).toBe(0)
      }),
    90_000,
  )
})
