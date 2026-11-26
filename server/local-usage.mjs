import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { UsageLedger } from "./usage.mjs";

export async function localUsage(path) {
  let data = new Map();
  try {
    data = new Map(JSON.parse(await readFile(path, "utf8")));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  let pending = Promise.resolve();
  const storage = {
    transaction(fn) {
      const work = pending.then(async () => {
        const next = structuredClone(data);
        const result = await fn({
          get: async (key) => structuredClone(next.get(key)),
          put: async (key, value) => next.set(key, structuredClone(value)),
          delete: async (key) => next.delete(key),
          list: async () => structuredClone(next),
          getAlarm: async () => null,
          setAlarm: async () => {},
        });
        if (JSON.stringify([...data]) !== JSON.stringify([...next])) {
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path + ".tmp", JSON.stringify([...next]), {
            mode: 0o600,
          });
          await rename(path + ".tmp", path);
          data = next;
        }
        return result;
      });
      pending = work.catch(() => {});
      return work;
    },
  };
  const ledger = new UsageLedger(storage);
  await ledger.cleanup();
  return ledger;
}
