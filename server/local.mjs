import { MAX_REQUEST_LENGTH } from "../public/audio-format.js";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { FileStore } from "./store.mjs";
import { api, SECURITY_HEADERS } from "./api.mjs";
const root = fileURLToPath(new URL("../public/", import.meta.url));
const store = await new FileStore(
  fileURLToPath(new URL("../.local/rooms.json", import.meta.url)),
).load();
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/config" && req.method === "GET") {
      const addresses = Object.values(networkInterfaces())
        .flat()
        .filter((net) => net?.family === "IPv4" && !net.internal);
      const address =
        addresses.find((net) =>
          /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(net.address),
        ) ?? addresses[0];
      res.writeHead(200, SECURITY_HEADERS);
      res.end(
        JSON.stringify({
          inviteOrigin: address ? `http://${address.address}:${port}` : null,
        }),
      );
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > MAX_REQUEST_LENGTH) {
          res.writeHead(413, SECURITY_HEADERS);
          res.end(JSON.stringify({ error: "Submission too large." }));
          return;
        }
      }
      const result = await api(
        {
          path: url.pathname,
          method: req.method,
          body,
          token: (req.headers.authorization ?? "").replace(/^Bearer /, ""),
          ip: req.socket.remoteAddress,
        },
        store,
      );
      res.writeHead(result.status, SECURITY_HEADERS);
      res.end(JSON.stringify(result.data));
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1),
      path = resolve(root, name);
    if (!path.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const content = await readFile(path);
    res.writeHead(200, {
      "Content-Type": types[extname(path)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch (e) {
    res.writeHead(e.code === "ENOENT" ? 404 : 500, {
      "Content-Type": "text/plain",
    });
    res.end(
      e.code === "ENOENT" ? "Page not found." : "Unable to serve this page.",
    );
  }
});
const port = Number(process.env.PORT ?? 4317);
server.listen(port, "0.0.0.0", () => {
  console.log(`Bluff & Tell: http://localhost:${port}`);
  for (const values of Object.values(networkInterfaces()))
    for (const net of values ?? [])
      if (net.family === "IPv4" && !net.internal)
        console.log(`Phones on your Wi-Fi: http://${net.address}:${port}`);
});
