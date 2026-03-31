import type { VercelRequest, VercelResponse } from "@vercel/node";

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
  headersB64: string,
): string {
  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      // Rewrite URI="..." attributes in HLS tags
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/gi, (_: string, uri: string) => {
          const abs = resolveUrl(uri, baseUrl);
          return `URI="/api/proxy?url=${encodeURIComponent(abs)}&h=${encodeURIComponent(headersB64)}"`;
        });
      }

      // Preserve empty lines
      if (!trimmed) return line;

      // Segment or sub-playlist URL
      const abs = resolveUrl(trimmed, baseUrl);
      return `/api/proxy?url=${encodeURIComponent(abs)}&h=${encodeURIComponent(headersB64)}`;
    })
    .join("\n");
}

const FORWARD_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "cache-control",
  "etag",
  "last-modified",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).end("Method not allowed");
  }

  // Parse URL ourselves using WHATWG URL API to avoid url.parse() encoding bugs
  // (Vercel's req.query uses deprecated url.parse() which corrupts + chars in base64)
  const parsedUrl = new URL(req.url!, `https://${req.headers.host}`);
  const targetUrl = parsedUrl.searchParams.get("url");
  const headersB64 = parsedUrl.searchParams.get("h");

  if (!targetUrl) {
    return res.status(400).end("Missing url parameter");
  }

  // Validate URL to prevent SSRF
  let targetOrigin: string;
  try {
    const parsed = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res.status(400).end("Only http/https URLs allowed");
    }
    targetOrigin = parsed.origin;
  } catch {
    return res.status(400).end("Invalid target URL");
  }

  // Decode headers from base64
  let customHeaders: Record<string, string> = {};
  if (headersB64) {
    try {
      customHeaders = JSON.parse(
        Buffer.from(headersB64, "base64").toString("utf-8"),
      );
    } catch {
      return res.status(400).end("Invalid headers parameter");
    }
  }

  // Build fetch headers
  const fetchHeaders: Record<string, string> = { ...customHeaders };

  // Forward the client's real IP so upstream CDNs that validate
  // tokens against IP can still work
  const clientIp =
    (req.headers["x-real-ip"] as string) ||
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim();
  if (clientIp) {
    fetchHeaders["X-Forwarded-For"] = clientIp;
    fetchHeaders["True-Client-IP"] = clientIp;
  }

  // Ensure Referer/Origin point to the target domain (some CDNs check these)
  if (!fetchHeaders["Referer"] && !fetchHeaders["referer"]) {
    fetchHeaders["Referer"] = targetOrigin + "/";
  }
  if (!fetchHeaders["Origin"] && !fetchHeaders["origin"]) {
    fetchHeaders["Origin"] = targetOrigin;
  }

  if (req.headers.range) {
    fetchHeaders["Range"] = req.headers.range as string;
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: fetchHeaders,
      redirect: "follow",
    });

    // Forward status
    res.status(upstream.status);

    // If upstream returned an error, forward the body for debugging
    if (!upstream.ok) {
      const errorBody = await upstream.text();
      console.error(
        `[proxy] Upstream returned ${upstream.status} for ${targetUrl}: ${errorBody.slice(0, 500)}`,
      );
      return res.end(errorBody);
    }

    // Forward safe response headers
    for (const name of FORWARD_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }

    // Detect m3u8
    const ct = upstream.headers.get("content-type") || "";
    const isM3u8 =
      /\.m3u8($|\?|%3F)/i.test(targetUrl) ||
      ct.includes("mpegurl") ||
      ct.includes("m3u8");

    if (isM3u8 && headersB64) {
      const text = await upstream.text();
      const baseUrl = new URL(".", targetUrl).href;
      const rewritten = rewriteM3u8(text, baseUrl, headersB64);
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res.send(rewritten);
    }

    // Stream binary response
    const arrayBuf = await upstream.arrayBuffer();
    return res.send(Buffer.from(arrayBuf));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[proxy] Error fetching ${targetUrl}:`, message);
    if (!res.headersSent) {
      return res.status(502).end(`Proxy error: ${message}`);
    }
  }
}
