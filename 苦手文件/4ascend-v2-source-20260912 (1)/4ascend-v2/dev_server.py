#!/usr/bin/env python3
"""Dependency-free local server for the generated 4ASCEND web application."""

from __future__ import annotations

import argparse
import io
import mimetypes
import posixpath
import sys
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit


APP_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = (APP_DIR / "root").resolve()
RESOURCE_AUDIO_DIR = (APP_DIR / "resource" / "audio").resolve()
DEBUG_AUTH_SCRIPT = (APP_DIR / "dev" / "debug_auth.js").resolve()
DEBUG_AUTH_ENDPOINT = "/__dev__/auth.js"


class DevelopmentHTTPServer(ThreadingHTTPServer):
    """Ignore routine browser disconnects while preserving unexpected tracebacks."""

    def handle_error(self, request: object, client_address: object) -> None:
        error = sys.exc_info()[1]
        if isinstance(error, (BrokenPipeError, ConnectionAbortedError, ConnectionResetError)):
            return
        super().handle_error(request, client_address)


class DevelopmentRequestHandler(SimpleHTTPRequestHandler):
    """Serve release assets with the isolation headers required by AI workers."""

    server_version = "4ASCEND-DevServer/1.0"

    def __init__(
        self,
        *args: object,
        debug_auth: bool = False,
        debug_user_level: int = 4,
        **kwargs: object,
    ) -> None:
        self.debug_auth = debug_auth
        self.debug_user_level = debug_user_level
        super().__init__(*args, **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
        self.send_header("Cache-Control", "no-store")
        if self.debug_auth:
            self.send_header("X-4ASCEND-Debug-Auth", "enabled")
        super().end_headers()

    def do_OPTIONS(self) -> None:  # noqa: N802 - stdlib handler API
        self.send_response(204)
        self.end_headers()

    def send_head(self) -> io.BufferedIOBase | io.BytesIO | None:
        request_path = urlsplit(self.path).path

        if self.debug_auth and request_path == DEBUG_AUTH_ENDPOINT:
            try:
                content = DEBUG_AUTH_SCRIPT.read_bytes()
            except OSError as error:
                self.send_error(500, f"Debug authentication script is unavailable: {error}")
                return None
            return self._send_memory_response(content, "text/javascript; charset=utf-8")

        translated_path = Path(self.translate_path(self.path))
        if translated_path.is_dir() and request_path.endswith("/"):
            for index_name in ("index.html", "index.htm"):
                index_path = translated_path / index_name
                if index_path.is_file():
                    translated_path = index_path
                    break

        if self.debug_auth and translated_path.is_file() and translated_path.suffix.lower() == ".html":
            try:
                content = translated_path.read_bytes()
            except OSError:
                return super().send_head()

            injection = (
                f'<script src="{DEBUG_AUTH_ENDPOINT}" '
                f'data-user-level="{self.debug_user_level}"></script>'
            ).encode("ascii")
            closing_head = b"</head>"
            if closing_head in content:
                content = content.replace(closing_head, injection + closing_head, 1)
            else:
                content = injection + content
            return self._send_memory_response(content, "text/html; charset=utf-8")

        return super().send_head()

    def _send_memory_response(self, content: bytes, content_type: str) -> io.BytesIO:
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        return io.BytesIO(content)

    def translate_path(self, request_path: str) -> str:
        """Map normal URLs to root/ and /audio/* to resource/audio/."""
        decoded_path = unquote(urlsplit(request_path).path)
        normalized_path = posixpath.normpath(decoded_path.replace("\\", "/"))

        if normalized_path == "/audio" or normalized_path.startswith("/audio/"):
            base_directory = RESOURCE_AUDIO_DIR
            relative_url = normalized_path.removeprefix("/audio").lstrip("/")
        else:
            base_directory = PUBLIC_DIR
            relative_url = normalized_path.lstrip("/")

        relative_parts = [
            part
            for part in PurePosixPath(relative_url).parts
            if part not in ("", ".", "..")
        ]
        candidate = (base_directory.joinpath(*relative_parts)).resolve()

        if candidate != base_directory and base_directory not in candidate.parents:
            return str(base_directory / "__invalid_path__")

        return str(candidate)

    def log_message(self, message_format: str, *args: object) -> None:
        print(f"[{self.log_date_time_string()}] {self.address_string()} {message_format % args}")


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the 4ASCEND local development server.")
    parser.add_argument("--host", default="127.0.0.1", help="Address to listen on")
    parser.add_argument("--port", type=int, default=9001, help="TCP port to listen on")
    browser_group = parser.add_mutually_exclusive_group()
    browser_group.add_argument(
        "--open",
        dest="open_browser",
        action="store_true",
        help="Open the site in the default browser",
    )
    browser_group.add_argument(
        "--no-open",
        dest="open_browser",
        action="store_false",
        help="Do not open the site in the default browser",
    )
    parser.set_defaults(open_browser=True)
    parser.add_argument(
        "--debug-auth",
        action="store_true",
        help="Inject a localhost-only browser identity without bypassing backend authorization",
    )
    parser.add_argument(
        "--debug-user-level",
        type=int,
        choices=range(1, 5),
        default=4,
        metavar="LEVEL",
        help="Frontend permission level used by --debug-auth (1-4; default: 4)",
    )
    return parser.parse_args()


def main() -> None:
    arguments = parse_arguments()

    if not PUBLIC_DIR.is_dir():
        raise SystemExit(f"Published site directory does not exist: {PUBLIC_DIR}")

    loopback_hosts = {"127.0.0.1", "localhost", "::1"}
    if arguments.debug_auth and arguments.host not in loopback_hosts:
        raise SystemExit(
            "Debug authentication may only be used with --host 127.0.0.1, localhost, or ::1."
        )

    if arguments.debug_auth and not DEBUG_AUTH_SCRIPT.is_file():
        raise SystemExit(f"Debug authentication script does not exist: {DEBUG_AUTH_SCRIPT}")

    mimetypes.add_type("application/wasm", ".wasm")
    mimetypes.add_type("text/javascript", ".mjs")
    mimetypes.add_type("application/octet-stream", ".onnx")
    handler = partial(
        DevelopmentRequestHandler,
        directory=str(PUBLIC_DIR),
        debug_auth=arguments.debug_auth,
        debug_user_level=arguments.debug_user_level,
    )

    try:
        server = DevelopmentHTTPServer((arguments.host, arguments.port), handler)
    except OSError as error:
        raise SystemExit(
            f"Could not listen on {arguments.host}:{arguments.port}: {error}"
        ) from error

    browser_host = "127.0.0.1" if arguments.host in ("0.0.0.0", "::") else arguments.host
    site_url = f"http://{browser_host}:{arguments.port}/"

    print(f"4ASCEND development server: {site_url}")
    print(f"Serving: {PUBLIC_DIR}")
    print("SharedArrayBuffer isolation headers: enabled")
    if arguments.debug_auth:
        print(f"WARNING: local debug authentication enabled at level {arguments.debug_user_level}")
        print("Backend authorization is unchanged; protected server writes still require real login.")
    print("Press Ctrl+C to stop.")

    if arguments.open_browser:
        threading.Timer(0.4, webbrowser.open, args=(site_url,)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
