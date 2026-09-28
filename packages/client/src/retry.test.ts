import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { withRetry, isTransientError, DEFAULT_RETRY_POLICY } from "./retry.js";
import { SdkEventEmitter, type SdkEvent } from "./events.js";

describe("isTransientError", () => {
  it("recognises HTTP 429 / 5xx and timeout language", () => {
    assert.equal(isTransientError(new Error("HTTP 429 Too Many Requests")), true);
    assert.equal(isTransientError(new Error("503 Service Unavailable")), true);
    assert.equal(isTransientError(new Error("request timeout")), true);
    assert.equal(isTransientError(new Error("InvalidProof")), false);
  });
});

describe("withRetry observability (#294 / #560)", () => {
  it("emits rpc:retry when a transient failure is retried", async () => {
    const events: SdkEvent[] = [];
    const emitter = new SdkEventEmitter((e) => events.push(e));
    let calls = 0;

    const result = await withRetry(
      async () => {
        calls++;
        if (calls === 1) throw new Error("429 rate limited");
        return "ok";
      },
      { maxRetries: 2, baseDelayMs: 1 },
      emitter,
    );

    assert.equal(result, "ok");
    assert.ok(events.some((e) => e.type === "rpc:attempt"));
    const retry = events.find((e) => e.type === "rpc:retry");
    assert.ok(retry && retry.type === "rpc:retry");
    assert.equal(retry.attempt, 1);
    assert.ok(typeof retry.delay === "number" && retry.delay >= 0);
    assert.ok(events.some((e) => e.type === "rpc:success"));
  });

  it("emits rpc:failure when retries are exhausted on a transient RPC error", async () => {
    const events: SdkEvent[] = [];
    const emitter = new SdkEventEmitter((e) => events.push(e));

    await assert.rejects(
      () =>
        withRetry(
          async () => {
            throw new Error("429 Too Many Requests");
          },
          { maxRetries: 1, baseDelayMs: 1 },
          emitter,
        ),
      /429/,
    );

    assert.ok(events.some((e) => e.type === "rpc:retry"));
    const failure = events.find((e) => e.type === "rpc:failure");
    assert.ok(failure && failure.type === "rpc:failure");
    assert.ok(failure.attempt >= 1);
  });

  it("emits rpc:failure immediately for non-transient errors (no retry)", async () => {
    const events: SdkEvent[] = [];
    const emitter = new SdkEventEmitter((e) => events.push(e));

    await assert.rejects(
      () =>
        withRetry(
          async () => {
            throw new Error("ContractError: AlreadyClaimed");
          },
          DEFAULT_RETRY_POLICY,
          emitter,
        ),
      /AlreadyClaimed/,
    );

    assert.ok(!events.some((e) => e.type === "rpc:retry"));
    assert.ok(events.some((e) => e.type === "rpc:failure"));
  });
});
