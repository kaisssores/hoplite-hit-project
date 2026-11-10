import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * Serves the built web client from `root`, falling back to index.html for client-side routes.
 * Returns `null` when there is no build, so the caller can answer with the JSON pointer instead.
 */
export async function serveClient(dir: string, pathname: string): Promise<Response | null> {
  const root = resolve(dir);
  const index = join(root, "index.html");
  if (!(await isFile(index))) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const target = normalize(join(root, decoded));
  if (target !== root && !target.startsWith(root + sep)) return null;

  const type = TYPES[extname(target)];
  if (await isFile(target)) {
    const immutable = decoded.startsWith("/assets/");
    return new Response(new Uint8Array(await readFile(target)), {
      headers: { "content-type": type ?? "application/octet-stream", "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache" },
    });
  }
  // A path with an extension is a missing asset, not a client route.
  if (extname(decoded)) return null;
  return new Response(new Uint8Array(await readFile(index)), { headers: { "content-type": TYPES[".html"]!, "cache-control": "no-cache" } });
}
