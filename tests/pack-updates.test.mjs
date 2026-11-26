import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileStorage, localUsage } from "../server/local-usage.mjs";
import { PackUpdates, packUpdatesApi } from "../server/pack-updates.mjs";
import { adminApi, adminSession } from "../server/admin.mjs";
const origin = "https://example.test";
const request = (
  data,
  path = "/api/pack-updates",
  method = "POST",
  from = origin,
) =>
  new Request(origin + path, {
    method,
    headers: { Origin: from, "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(data) } : {}),
  });
async function setup(t) {
  const dir = await mkdtemp(join(tmpdir(), "bluff-updates-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "private.json");
  const storage = await fileStorage(path);
  return { list: new PackUpdates(storage), path, storage };
}
test("launch registration requires explicit consent, valid email, same origin and a rate budget", async (t) => {
  const { list } = await setup(t),
    deps = { list, budget: async () => true };
  for (const email of ["bad", "a@", "<script>@example.com", "a\n@example.com"])
    assert.equal(
      (await packUpdatesApi(request({ email, consent: true }), deps)).status,
      400,
    );
  assert.equal(
    (await packUpdatesApi(request({ email: "fake@example.test" }), deps))
      .status,
    400,
  );
  assert.equal(
    (
      await packUpdatesApi(
        request(
          { email: "fake@example.test", consent: true },
          undefined,
          undefined,
          "https://attacker.test",
        ),
        deps,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await packUpdatesApi(
        request({ email: "fake@example.test", consent: true }),
        { ...deps, budget: async () => false },
      )
    ).status,
    429,
  );
  assert.equal(
    (await packUpdatesApi(request(undefined, undefined, "GET"), deps)).status,
    405,
  );
  assert.equal(
    (
      await packUpdatesApi(
        request({ email: "fake@example.test", consent: true, website: "bot" }),
        deps,
      )
    ).status,
    200,
  );
  assert.equal((await list.list()).total, 0);
});
test("registrations are deduplicated, private, persistent, pending verification and removable without revealing membership", async (t) => {
  const { list, path, storage } = await setup(t),
    deps = { list, budget: async () => true };
  const one = await packUpdatesApi(
    request({ email: " Test@Example.test ", consent: true }),
    deps,
  );
  const two = await packUpdatesApi(
    request({ email: "test@example.test", consent: true }),
    deps,
  );
  assert.deepEqual(await one.json(), await two.json());
  assert.equal(one.headers.get("Cache-Control"), "no-store");
  let result = await list.list();
  assert.equal(result.total, 1);
  assert.equal(result.subscribers[0].status, "pending-verification");
  assert.equal(result.emailDeliveryConnected, false);
  const usage = await localUsage(path);
  assert(!JSON.stringify(await usage.report()).includes("test@example.test"));
  assert.equal(
    (await list.list()).total,
    1,
    "room cleanup does not erase explicitly opted-in launch registrations",
  );
  assert.equal(
    (await new PackUpdates(await fileStorage(path)).list()).total,
    1,
  );
  const secret = "synthetic-long-test-password";
  const sessionSecret = "synthetic-session-signing-key-long-enough";
  const adminDeps = {
    secret,
    username: "admin@example.test",
    sessionSecret,
    ledger: { registrations: () => list.list() },
    budget: async () => true,
  };
  assert.equal(
    (
      await adminApi(
        new Request(origin + "/api/admin/registrations"),
        adminDeps,
      )
    ).status,
    401,
  );
  const authorised = await adminApi(
    new Request(origin + "/api/admin/registrations", {
      headers: { Cookie: "bt_admin=" + adminSession(sessionSecret) },
    }),
    adminDeps,
  );
  assert.equal(authorised.status, 200);
  assert.equal((await authorised.json()).total, 1);
  const removed = await packUpdatesApi(
    request({ email: "test@example.test" }, "/api/pack-updates/unsubscribe"),
    deps,
  );
  const missing = await packUpdatesApi(
    request(
      { email: "not-signed-up@example.test" },
      "/api/pack-updates/unsubscribe",
    ),
    deps,
  );
  assert.deepEqual(await removed.json(), await missing.json());
  assert.equal((await list.list()).total, 0);
});
