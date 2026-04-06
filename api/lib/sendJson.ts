import type { ServerResponse } from "node:http";

const JSON_HDR = { "Content-Type": "application/json; charset=utf-8" } as const;

/** Resposta JSON compatível com `http.ServerResponse` nativo (sem helpers Express em `res.status` / `res.json`). */
export function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, JSON_HDR);
  res.end(JSON.stringify(body));
}

export function sendNoContent(res: ServerResponse): void {
  res.writeHead(204);
  res.end();
}
