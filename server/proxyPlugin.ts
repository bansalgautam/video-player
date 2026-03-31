import type { Plugin } from "vite";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

interface ProxySession {
  headers: Record<string, string>;
  createdAt: number;
}

const sessions = new Map<string, ProxySession>();

// Cleanup sessions older than 24 hours
setInterval(
  () => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [id, session] of sessions) {
      if (session.createdAt < cutoff) sessions.delete(id);
    }
  },
  60 * 60 * 1000,
).unref();

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

function rewriteM3u8(
  content: string,
  baseUrl: string,
  sessionId: string,
): string {
  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      // Rewrite URI="..." attributes in HLS tags
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/gi, (_: string, uri: string) => {
          const abs = resolveUrl(uri, baseUrl);
          return `URI="/api/proxy/${sessionId}?url=${encodeURIComponent(abs)}"`;
        });
      }

      // Preserve empty lines
      if (!trimmed) return line;

      // Segment or sub-playlist URL
      const abs = resolveUrl(trimmed, baseUrl);
      return `/api/proxy/${sessionId}?url=${encodeURIComponent(abs)}`;
    })
    .join("\n");
}

// Response headers safe to forward from upstream
const FORWARD_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "cache-control",
  "etag",
  "last-modified",
];

async function handleProxy(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const url = new URL(req.url!, `http://${req.headers.host}`);

  if (!url.pathname.startsWith("/api/proxy")) {
    next();
    return;
  }

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  // POST /api/proxy/session — create a new proxy session
  if (req.method === "POST" && url.pathname === "/api/proxy/session") {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body);
      if (!parsed.headers || typeof parsed.headers !== "object") {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "headers object required" }));
        return;
      }
      const id = randomUUID();
      sessions.set(id, { headers: parsed.headers, createdAt: Date.now() });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ sessionId: id }));
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Invalid request" }));
    }
    return;
  }

  // GET /api/proxy/:sessionId?url=<target> — proxy a request
  if (req.method === "GET") {
    const match = url.pathname.match(/^\/api\/proxy\/([a-f0-9-]+)$/);
    if (!match) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const sessionId = match[1];
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      res.statusCode = 400;
      res.end("Missing url parameter");
      return;
    }

    // Validate URL to prevent SSRF against internal networks
    try {
      const parsed = new URL(targetUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        res.statusCode = 400;
        res.end("Only http/https URLs allowed");
        return;
      }
    } catch {
      res.statusCode = 400;
      res.end("Invalid target URL");
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      res.statusCode = 404;
      res.end("Session not found or expired");
      return;
    }

    // Build request headers: session headers + Range forwarding
    const fetchHeaders: Record<string, string> = { ...session.headers };
    if (req.headers.range) {
      fetchHeaders["Range"] = req.headers.range;
    }

    try {
      const upstream = await fetch(targetUrl, {
        headers: fetchHeaders,
        redirect: "follow",
      });

      // Forward status code (important for 206 Partial Content)
      res.statusCode = upstream.status;

      // Forward safe response headers
      for (const name of FORWARD_HEADERS) {
        const value = upstream.headers.get(name);
        if (value) res.setHeader(name, value);
      }

      // Detect m3u8 response
      const ct = upstream.headers.get("content-type") || "";
      const isM3u8 =
        /\.m3u8($|\?|%3F)/i.test(targetUrl) ||
        ct.includes("mpegurl") ||
        ct.includes("m3u8");

      if (isM3u8) {
        const text = await upstream.text();
        const baseUrl = new URL(".", targetUrl).href;
        const rewritten = rewriteM3u8(text, baseUrl, sessionId);
        const buf = Buffer.from(rewritten);
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Content-Length", buf.length);
        res.end(buf);
      } else {
        // Stream binary response
        if (!upstream.body) {
          res.end();
          return;
        }
        const reader = upstream.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
        } catch {
          // Client disconnected or upstream error
        }
        res.end();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[proxy] Error fetching ${targetUrl}:`, message);
      if (!res.headersSent) {
        res.statusCode = 502;
        res.end(`Proxy error: ${message}`);
      }
    }
    return;
  }

  res.statusCode = 405;
  res.end("Method not allowed");
}

function proxyMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  handleProxy(req, res, next).catch((err) => {
    console.error("[proxy]", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal proxy error");
    }
  });
}

export function proxyPlugin(): Plugin {
  return {
    name: "video-proxy",
    configureServer(server) {
      server.middlewares.use(proxyMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(proxyMiddleware);
    },
  };
}
