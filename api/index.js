// Vercel Edge function wrapping the TanStack Start SSR server.
// Imports the built worker entry (dist/server/server.js) which exports
// `{ fetch(request, env, ctx) }`. Vercel Edge runtime supports Web Fetch.
import server from "../dist/server/server.js";

export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  try {
    return await server.fetch(request, {}, {});
  } catch (err) {
    console.error("[vercel/edge] SSR error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
