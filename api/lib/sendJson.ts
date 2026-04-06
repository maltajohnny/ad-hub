import type { ServerResponse } from "node:http";

const CT = "application/json; charset=utf-8";

/** Node `ServerResponse`: usar `statusCode` + `setHeader` + `end` (evita `writeHead` se cabeçalhos já existirem). */
export function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  if (res.writableEnded) return;
  const payload = JSON.stringify(body);
  if (!res.headersSent) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", CT);
  }
  res.end(payload);
}

export function sendNoContent(res: ServerResponse): void {
  if (res.writableEnded) return;
  if (!res.headersSent) {
    res.statusCode = 204;
  }
  res.end();
}
