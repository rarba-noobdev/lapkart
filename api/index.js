// Vercel Node serverless function wrapping the TanStack Start SSR server.
// `dist/server/index.js` exports `{ fetch(request, env, ctx) }`.
// We adapt Node IncomingMessage/ServerResponse to/from Web Request/Response.
import server from "../dist/server/index.js";

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
