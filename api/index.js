// Vercel Node serverless function wrapping the TanStack Start SSR server.
// `dist/server/index.js` exports `{ fetch(request, env, ctx) }`.
// We adapt Node IncomingMessage/ServerResponse to/from Web Request/Response.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import server from "../dist/server/index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, "..");
const clientDir = path.resolve(rootDir, "dist/client");
const publicDir = path.resolve(rootDir, "public");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".txt", "text/plain; charset=utf-8"],
]);

function getContentType(filePath) {
  return contentTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

async function tryServeStatic(pathname, res) {
  const candidatePaths = [];

  if (pathname.startsWith("/assets/")) {
    candidatePaths.push(path.resolve(clientDir, `.${pathname}`));
  }

  if (pathname.startsWith("/fonts/")) {
    candidatePaths.push(path.resolve(publicDir, `.${pathname}`));
  }

  if (pathname === "/favicon.ico" || pathname === "/robots.txt") {
    candidatePaths.push(path.resolve(publicDir, `.${pathname}`));
  }

  for (const candidatePath of candidatePaths) {
    if (!candidatePath.startsWith(clientDir) && !candidatePath.startsWith(publicDir)) continue;
    try {
      const data = await readFile(candidatePath);
      res.statusCode = 200;
      res.setHeader("content-type", getContentType(candidatePath));
      res.setHeader("cache-control", pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600");
      res.end(data);
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

function buildRequest(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const url = `${proto}://${host}${req.url}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
    else headers.set(k, v);
  }

  const method = req.method || "GET";
  const hasBody = !["GET", "HEAD"].includes(method);

  return new Request(url, {
    method,
    headers,
    body: hasBody ? req : undefined,
    duplex: "half",
  });
}

async function writeResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}

export default async function handler(req, res) {
  try {
    const url = new URL(`${req.headers["x-forwarded-proto"] || "https"}://${req.headers["x-forwarded-host"] || req.headers.host || "localhost"}${req.url || "/"}`);
    if (await tryServeStatic(url.pathname, res)) return;

    const request = buildRequest(req);
    const response = await server.fetch(request, {}, {});
    await writeResponse(res, response);
  } catch (err) {
    console.error("[vercel/node] SSR error:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain");
    res.end("Internal Server Error");
  }
}
