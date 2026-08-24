#!/usr/bin/env python3
"""Needle 2 sidecar for Quillsmith.

A tiny stdlib HTTP service that wraps Cactus Compute's Needle 2 tool-calling
model. The Next.js app posts a natural-language description of the next action
plus the JSON tool schemas; Needle turns that description into a concrete tool
call, which the app then executes in TypeScript.

Endpoints
  GET  /health   -> {"ok": true, "loaded": <bool>}
  POST /complete -> body: {"tools": [ {name, description, parameters} ], "text": str, "system"?: str}
                    returns: {"type": "call"|"respond", "function_calls": [...],
                              "confidence": float|null, "reasoning": str}

Run: python3 services/needle/server.py   (PORT via NEEDLE_PORT, default 8787)

Needle is pure-local: the engine is fetched once from Hugging Face and cached
under ~/.cache/cactus-needle; inference never touches the network afterwards.
"""

import json
import os
import hashlib
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("NEEDLE_PORT", "8787"))

# Needle keeps model weights loaded for the process and is not thread-safe, so
# serialize every inference behind one lock and cache one agent per toolset.
_lock = threading.Lock()
_agents: dict[str, object] = {}
_needle = None


def _get_needle():
    global _needle
    if _needle is None:
        import needle  # imported lazily so /health works before the model loads

        _needle = needle
    return _needle


def _agent_for(tools: list[dict], system: str | None):
    key = hashlib.sha1(
        (json.dumps(tools, sort_keys=True) + "|" + (system or "")).encode()
    ).hexdigest()
    agent = _agents.get(key)
    if agent is None:
        nd = _get_needle()
        agent = nd.Needle(tools=tools, system=system or None)
        _agents[key] = agent
    return agent


def _complete(tools: list[dict], text: str, system: str | None) -> dict:
    with _lock:
        agent = _agent_for(tools, system)
        agent.reset()  # each request is an independent single-turn description
        # Raise the output budget so longer arguments (e.g. a 2-sentence
        # chapter summary) aren't truncated ("token budget exhausted").
        resp = agent.complete(text, max_new_tokens=1024)
    return {
        "type": resp.get("type"),
        "success": resp.get("success"),
        "function_calls": resp.get("function_calls") or [],
        "confidence": resp.get("confidence"),
        "reasoning": resp.get("reasoning"),
        "error": resp.get("error"),
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass  # keep the terminal quiet

    def _send(self, code: int, payload: dict):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.rstrip("/") == "/health":
            self._send(200, {"ok": True, "loaded": _needle is not None})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path.rstrip("/") != "/complete":
            self._send(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length) or b"{}")
            tools = body.get("tools") or []
            text = body.get("text") or ""
            system = body.get("system")
            if not tools or not text:
                self._send(400, {"error": "tools and text are required"})
                return
            self._send(200, _complete(tools, text, system))
        except Exception as e:  # noqa: BLE001 - surface any failure as JSON
            self._send(500, {"error": str(e)})


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"[needle] sidecar listening on http://127.0.0.1:{PORT}", flush=True)
    # Warm the model so the first real request is fast.
    try:
        _complete(
            [
                {
                    "name": "noop",
                    "description": "warmup",
                    "parameters": {
                        "type": "object",
                        "properties": {"x": {"type": "string"}},
                    },
                }
            ],
            "warm up",
            None,
        )
        print("[needle] model warmed", flush=True)
    except Exception as e:  # noqa: BLE001
        print(f"[needle] warmup skipped: {e}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
