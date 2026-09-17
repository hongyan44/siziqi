#!/usr/bin/env python3
"""Exercise the real残局 challenge page through the Edge DevTools protocol."""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

from run_browser_smoke import DevToolsSocket, find_edge, free_port, get_json


URL = "http://127.0.0.1:9001/pages/endgame/challenge.html?smoke=endgame-v2"


def evaluate(devtools: DevToolsSocket, expression: str, await_promise: bool = False) -> object:
    message = devtools.command(
        "Runtime.evaluate",
        {"expression": expression, "returnByValue": True, "awaitPromise": await_promise},
    )
    response = message.get("result", {})
    if response.get("exceptionDetails"):
        raise RuntimeError(json.dumps(response["exceptionDetails"], ensure_ascii=False))
    return response.get("result", {}).get("value")


def wait_for(devtools: DevToolsSocket, expression: str, timeout: float, description: str) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if evaluate(devtools, expression):
            return
        time.sleep(0.2)
    raise TimeoutError(f"Timed out waiting for {description}")


def run() -> int:
    edge = find_edge()
    port = free_port()
    profile = Path(tempfile.mkdtemp(prefix="4ascend-edge-challenge-"))
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
            URL,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    devtools: DevToolsSocket | None = None
    try:
        deadline = time.monotonic() + 30
        page = None
        while time.monotonic() < deadline:
            try:
                targets = get_json(f"http://127.0.0.1:{port}/json/list")
                page = next(
                    (target for target in targets if target.get("type") == "page" and "challenge.html" in str(target.get("url"))),
                    None,
                )
                if page:
                    break
            except (OSError, ValueError):
                pass
            time.sleep(0.1)
        if not page:
            raise TimeoutError("Edge did not expose the challenge page")
        devtools = DevToolsSocket(str(page["webSocketDebuggerUrl"]))
        wait_for(devtools, "typeof aiReady !== 'undefined' && aiReady === true", 30, "endgame MCTS initialization")

        evaluate(devtools, "playBlack(4, 4)", await_promise=True)
        book_result = json.loads(str(evaluate(devtools, "JSON.stringify({moves, turnCount: state.turn_count, over: challengeOver})")))
        if book_result["turnCount"] != 2 or len(book_result["moves"]) != 2 or book_result["moves"][1]["source"] != "正着应手":
            raise AssertionError(f"Authored endgame line failed: {book_result}")
        book_sync = evaluate(
            devtools,
            "(async () => JSON.stringify(await aiWorker.ENDGAME_DEBUG_STATE()) === JSON.stringify(RulesRuntime.snapshot(game)))()",
            await_promise=True,
        )
        if not book_sync:
            raise AssertionError("Worker diverged after the authored endgame line")
        print("PASS: authored endgame response uses explicit synchronized commit")

        evaluate(devtools, "resetChallenge()", await_promise=True)
        wait_for(devtools, "aiReady === true", 30, "endgame MCTS reset")
        evaluate(devtools, "playBlack(0, 0)", await_promise=True)
        deviation_result = json.loads(str(evaluate(devtools, "JSON.stringify({moves, turnCount: state.turn_count, deviated})")))
        if deviation_result["turnCount"] != 2 or len(deviation_result["moves"]) != 2:
            raise AssertionError(f"Endgame deviation did not complete a reply: {deviation_result}")
        if not deviation_result["deviated"] or deviation_result["moves"][1]["source"] != "4zero MCTS":
            raise AssertionError(f"4zero MCTS did not take over after deviation: {deviation_result}")
        deviation_sync = evaluate(
            devtools,
            "(async () => JSON.stringify(await aiWorker.ENDGAME_DEBUG_STATE()) === JSON.stringify(RulesRuntime.snapshot(game)))()",
            await_promise=True,
        )
        if not deviation_sync:
            raise AssertionError("Worker diverged after the MCTS response")
        search = json.loads(str(evaluate(
            devtools,
            "(async () => JSON.stringify(await aiWorker.ENDGAME_DEBUG_SEARCH()))()",
            await_promise=True,
        )))
        if (search.get("engine") != "4zero-mcts"
                or search.get("requestedSimulations") != 888
                or search.get("simulations") != 888):
            raise AssertionError(f"Endgame takeover did not use 888-sim 4zero MCTS: {search}")
        print("PASS: deviation invokes 888-sim 4zero MCTS")
        print("PASS: challenge page and worker remain identical after both response paths")
        return 0
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
        if resolved_profile.parent == Path(tempfile.gettempdir()).resolve() and resolved_profile.name.startswith("4ascend-edge-challenge-"):
            shutil.rmtree(resolved_profile, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(run())
