#!/usr/bin/env python3
"""Run the browser smoke page in installed Edge without Selenium/Node."""

from __future__ import annotations

import argparse
import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlparse


EDGE_PATHS = (
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
)


def find_edge() -> Path:
    for path in EDGE_PATHS:
        if path.is_file():
            return path
    discovered = shutil.which("msedge")
    if discovered:
        return Path(discovered)
    raise FileNotFoundError("Microsoft Edge was not found")


def free_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return int(listener.getsockname()[1])


def get_json(url: str) -> object:
    with urllib.request.urlopen(url, timeout=2) as response:
        return json.loads(response.read().decode("utf-8"))


class DevToolsSocket:
    def __init__(self, url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme != "ws" or not parsed.hostname or not parsed.port:
            raise ValueError(f"Unsupported DevTools WebSocket URL: {url}")
        self.socket = socket.create_connection((parsed.hostname, parsed.port), timeout=10)
        self.socket.settimeout(10)
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        path = parsed.path + (f"?{parsed.query}" if parsed.query else "")
        request = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {parsed.hostname}:{parsed.port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            "Origin: http://127.0.0.1\r\n\r\n"
        )
        self.socket.sendall(request.encode("ascii"))
        header = bytearray()
        while b"\r\n\r\n" not in header:
            chunk = self.socket.recv(4096)
            if not chunk:
                raise ConnectionError("DevTools closed during WebSocket handshake")
            header.extend(chunk)
        if not bytes(header).startswith(b"HTTP/1.1 101"):
            raise ConnectionError(bytes(header).decode("latin-1", errors="replace"))
        self.next_id = 1

    def read_exact(self, length: int) -> bytes:
        result = bytearray()
        while len(result) < length:
            chunk = self.socket.recv(length - len(result))
            if not chunk:
                raise ConnectionError("DevTools WebSocket closed")
            result.extend(chunk)
        return bytes(result)

    def send_frame(self, payload: bytes, opcode: int = 1) -> None:
        mask = os.urandom(4)
        length = len(payload)
        header = bytearray([0x80 | opcode])
        if length < 126:
            header.append(0x80 | length)
        elif length <= 0xFFFF:
            header.append(0x80 | 126)
            header.extend(struct.pack("!H", length))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack("!Q", length))
        header.extend(mask)
        masked = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
        self.socket.sendall(bytes(header) + masked)

    def receive_frame(self) -> tuple[int, bytes]:
        first, second = self.read_exact(2)
        opcode = first & 0x0F
        length = second & 0x7F
        if length == 126:
            length = struct.unpack("!H", self.read_exact(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self.read_exact(8))[0]
        mask = self.read_exact(4) if second & 0x80 else None
        payload = self.read_exact(length)
        if mask:
            payload = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
        return opcode, payload

    def command(self, method: str, params: dict[str, object] | None = None) -> dict[str, object]:
        command_id = self.next_id
        self.next_id += 1
        self.send_frame(json.dumps({"id": command_id, "method": method, "params": params or {}}).encode("utf-8"))
        fragments = bytearray()
        while True:
            opcode, payload = self.receive_frame()
            if opcode == 8:
                raise ConnectionError("DevTools WebSocket closed")
            if opcode == 9:
                self.send_frame(payload, opcode=10)
                continue
            if opcode in (1, 2):
                fragments = bytearray(payload)
            elif opcode == 0:
                fragments.extend(payload)
            else:
                continue
            try:
                message = json.loads(fragments.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
            if message.get("id") == command_id:
                return message

    def close(self) -> None:
        try:
            self.send_frame(b"", opcode=8)
        except OSError:
            pass
        self.socket.close()


def run(url: str, timeout: float) -> int:
    edge = find_edge()
    port = free_port()
    profile = Path(tempfile.mkdtemp(prefix="4ascend-edge-smoke-"))
    process = subprocess.Popen(
        [
            str(edge),
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--disable-background-networking",
            "--remote-allow-origins=*",
            f"--remote-debugging-port={port}",
            f"--user-data-dir={profile}",
            url,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    devtools: DevToolsSocket | None = None
    try:
        deadline = time.monotonic() + timeout
        page: dict[str, object] | None = None
        while time.monotonic() < deadline:
            try:
                targets = get_json(f"http://127.0.0.1:{port}/json/list")
                page = next(
                    (target for target in targets if target.get("type") == "page" and "browser_smoke.html" in str(target.get("url"))),
                    None,
                )
                if page:
                    break
            except (OSError, ValueError):
                pass
            time.sleep(0.1)
        if not page:
            raise TimeoutError("Edge did not expose the smoke-test page")

        devtools = DevToolsSocket(str(page["webSocketDebuggerUrl"]))
        expression = "document.getElementById('result') && document.getElementById('result').textContent"
        last_result = "RUNNING"
        while time.monotonic() < deadline:
            message = devtools.command("Runtime.evaluate", {"expression": expression, "returnByValue": True})
            last_result = str(
                message.get("result", {})
                .get("result", {})
                .get("value", "")
            )
            if last_result and last_result != "RUNNING":
                print(last_result)
                return 0 if "ALL TESTS PASSED" in last_result else 1
            time.sleep(0.25)
        print(last_result)
        raise TimeoutError(f"Browser smoke test did not finish within {timeout:g}s")
    finally:
        if devtools:
            try:
                devtools.command("Browser.close")
            except (OSError, ConnectionError, TimeoutError):
                pass
            devtools.close()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.terminate()
            process.wait(timeout=5)
        resolved_profile = profile.resolve()
        if resolved_profile.parent == Path(tempfile.gettempdir()).resolve() and resolved_profile.name.startswith("4ascend-edge-smoke-"):
            shutil.rmtree(resolved_profile, ignore_errors=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:9001/dev/browser_smoke.html")
    parser.add_argument("--timeout", type=float, default=120)
    args = parser.parse_args()
    raise SystemExit(run(args.url, args.timeout))


if __name__ == "__main__":
    main()
