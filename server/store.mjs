import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { GameError } from "./engine.mjs";

// The same game engine is used locally and in AWS. No game rules live in the UI.
export class FileStore {
  constructor(path) {
    this.path = path;
    this.rooms = new Map();
    this.limits = new Map();
    this.pending = Promise.resolve();
  }
  async load() {
    try {
      const data = JSON.parse(await readFile(this.path, "utf8"));
      for (const room of data)
        if (room.expiresAt > Date.now()) this.rooms.set(room.code, room);
      if (data.length !== this.rooms.size) await this.persist();
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    return this;
  }
  async locked(fn) {
    const work = this.pending.then(fn);
    this.pending = work.catch(() => {});
    return work;
  }
  async persist() {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(
      this.path + ".tmp",
      JSON.stringify(
        [...this.rooms.values()].filter((r) => r.expiresAt > Date.now()),
      ),
      { mode: 0o600 },
    );
    await rename(this.path + ".tmp", this.path);
  }
  async create(room) {
    return this.locked(async () => {
      if (this.rooms.has(room.code)) return false;
      this.rooms.set(room.code, structuredClone(room));
      await this.persist();
      return true;
    });
  }
  async mutate(code, fn) {
    return this.locked(async () => {
      const source = this.rooms.get(code);
      if (!source || source.expiresAt <= Date.now()) {
        if (this.rooms.delete(code)) await this.persist();
        throw new GameError(
          "Room not found or expired. Check the code with your host.",
          404,
        );
      }
      const room = structuredClone(source),
        before = JSON.stringify(room),
        value = await fn(room);
      if (before !== JSON.stringify(room)) {
        this.rooms.set(code, room);
        await this.persist();
      }
      return value;
    });
  }
  async cleanup(now = Date.now()) {
    return this.locked(async () => {
      let removed = 0;
      for (const [code, room] of this.rooms)
        if (room.expiresAt <= now) {
          this.rooms.delete(code);
          removed++;
        }
      if (removed) await this.persist();
      return removed;
    });
  }
  async budget(key, limit, seconds) {
    const now = Date.now(),
      bucket = this.limits.get(key);
    if (!bucket || bucket.end <= now) {
      this.limits.set(key, { count: 1, end: now + seconds * 1000 });
    } else if (++bucket.count > limit)
      throw new GameError(
        "Too many attempts. Please wait a moment and try again.",
        429,
      );
    if (this.limits.size > 5000)
      for (const [k, v] of this.limits) if (v.end <= now) this.limits.delete(k);
  }
}

export class DynamoStore {
  constructor(client, sdk, table) {
    this.client = client;
    this.sdk = sdk;
    this.table = table;
  }
  async create(room) {
    const { PutItemCommand } = this.sdk;
    try {
      await this.client.send(
        new PutItemCommand({
          TableName: this.table,
          Item: {
            pk: { S: "ROOM#" + room.code },
            payload: { S: JSON.stringify(room) },
            revision: { N: "0" },
            expires: { N: String(Math.floor(room.expiresAt / 1000)) },
          },
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );
      return true;
    } catch (e) {
      if (e.name === "ConditionalCheckFailedException") return false;
      throw e;
    }
  }
  async mutate(code, fn) {
    const { GetItemCommand, PutItemCommand } = this.sdk;
    for (let attempt = 0; attempt < 12; attempt++) {
      const response = await this.client.send(
        new GetItemCommand({
          TableName: this.table,
          Key: { pk: { S: "ROOM#" + code } },
          ConsistentRead: true,
        }),
      );
      if (!response.Item)
        throw new GameError(
          "Room not found or expired. Check the code with your host.",
          404,
        );
      const room = JSON.parse(response.Item.payload.S);
      if (room.expiresAt <= Date.now())
        throw new GameError("This room has expired. Create a new game.", 404);
      const before = JSON.stringify(room),
        value = await fn(room);
      if (before === JSON.stringify(room)) return value;
      const revision = Number(response.Item.revision.N);
      try {
        await this.client.send(
          new PutItemCommand({
            TableName: this.table,
            Item: {
              pk: { S: "ROOM#" + code },
              payload: { S: JSON.stringify(room) },
              revision: { N: String(revision + 1) },
              expires: { N: String(Math.floor(room.expiresAt / 1000)) },
            },
            ConditionExpression: "revision = :revision",
            ExpressionAttributeValues: { ":revision": { N: String(revision) } },
          }),
        );
        return value;
      } catch (e) {
        if (e.name !== "ConditionalCheckFailedException") throw e;
      }
    }
    throw new GameError("The room is busy. Please try again.", 409);
  }
  async budget(key, limit, seconds) {
    const { UpdateItemCommand } = this.sdk,
      window = Math.floor(Date.now() / (seconds * 1000));
    try {
      await this.client.send(
        new UpdateItemCommand({
          TableName: this.table,
          Key: { pk: { S: `LIMIT#${key}#${window}` } },
          UpdateExpression: "SET expires = :expiry ADD attempts :one",
          ConditionExpression:
            "attribute_not_exists(attempts) OR attempts < :maximum",
          ExpressionAttributeValues: {
            ":expiry": { N: String((window + 2) * seconds) },
            ":one": { N: "1" },
            ":maximum": { N: String(limit) },
          },
        }),
      );
    } catch (e) {
      if (e.name === "ConditionalCheckFailedException")
        throw new GameError(
          "Too many attempts. Please wait a moment and try again.",
          429,
        );
      throw e;
    }
  }
}
