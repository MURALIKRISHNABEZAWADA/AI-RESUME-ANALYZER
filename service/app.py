"""HTTP service entry point for ATS resume optimization."""

from __future__ import annotations

import argparse
import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from service.ats_service import optimize_resume
from service.job_agent import build_application_plan


class ATSRequestHandler(BaseHTTPRequestHandler):
    server_version = "ATSResumeService/1.0"

    def log_message(self, format: str, *args: object) -> None:
        return

    def do_OPTIONS(self) -> None:
        self._send_response(HTTPStatus.NO_CONTENT, None)

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send_response(HTTPStatus.OK, {"status": "ok"})
            return
        self._send_response(HTTPStatus.NOT_FOUND, {"error": "Not found"})

    def do_POST(self) -> None:
        if self.path == "/optimize":
            self._handle_optimize()
            return
        if self.path == "/apply/plan":
            self._handle_application_plan()
            return
        self._send_response(HTTPStatus.NOT_FOUND, {"error": "Not found"})

    def _handle_optimize(self) -> None:
        try:
            payload = self._read_json()
            result = optimize_resume(
                master_resume=str(payload.get("master_resume", "")),
                job_description=str(payload.get("job_description", "")),
                include_pdf=bool(payload.get("include_pdf", True)),
                keyword_limit=int(payload.get("keyword_limit", 32)),
            )
        except ValueError as error:
            self._send_response(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        except (TypeError, json.JSONDecodeError):
            self._send_response(HTTPStatus.BAD_REQUEST, {"error": "Request body must be valid JSON."})
            return

        self._send_response(HTTPStatus.OK, result)

    def _handle_application_plan(self) -> None:
        try:
            payload = self._read_json()
            result = build_application_plan(
                master_resume=str(payload.get("master_resume", "")),
                job_description=str(payload.get("job_description", "")),
                job_url=str(payload.get("job_url", "")),
                company_name=str(payload.get("company_name", "")),
                role_title=str(payload.get("role_title", "")),
                applicant_notes=str(payload.get("applicant_notes", "")),
            )
        except ValueError as error:
            self._send_response(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        except (TypeError, json.JSONDecodeError):
            self._send_response(HTTPStatus.BAD_REQUEST, {"error": "Request body must be valid JSON."})
            return

        self._send_response(HTTPStatus.OK, result)

    def _read_json(self) -> dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)
        if not raw_body:
            raise ValueError("Request body must be valid JSON.")
        parsed = json.loads(raw_body.decode("utf-8"))
        if not isinstance(parsed, dict):
            raise ValueError("Request body must be a JSON object.")
        return parsed

    def _send_response(self, status: HTTPStatus, body: dict[str, Any] | None) -> None:
        response = b"" if body is None else json.dumps(body, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if body is not None:
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        if response:
            self.wfile.write(response)


def run(host: str = "127.0.0.1", port: int = 8000) -> None:
    server = ThreadingHTTPServer((host, port), ATSRequestHandler)
    print(f"ATS resume service listening on http://{host}:{port}")
    server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the ATS resume optimization service.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    args = parser.parse_args()
    run(args.host, args.port)


if __name__ == "__main__":
    main()

