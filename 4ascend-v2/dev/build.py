#!/usr/bin/env python3
"""Build the JS rules/AI bundles without requiring Node or Bun.

The upstream project mixes CommonJS require() with `export { ... }`. This
small bundler intentionally supports only that project-local pattern; the
normal Bun/esbuild workflow remains available for full production builds.
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path


APP_DIR = Path(__file__).resolve().parents[1]
REQUIRE_RE = re.compile(r"require\(\s*(['\"])([^'\"]+)\1\s*\)")
EXPORT_RE = re.compile(r"^\s*export\s*\{([^}]+)\};?\s*$", re.MULTILINE)


class CommonJsBundle:
    def __init__(self) -> None:
        self.modules: list[Path] = []
        self.ids: dict[Path, int] = {}

    def resolve(self, parent: Path, request: str) -> Path:
        if request == "jsbi":
            return (APP_DIR / "node_modules/jsbi/dist/jsbi-cjs.js").resolve()
        if not request.startswith("."):
            raise RuntimeError(f"Unsupported external module in dev bundler: {request}")
        candidate = (parent.parent / request).resolve()
        if candidate.is_file():
            return candidate
        if candidate.with_suffix(".cjs").is_file():
            return candidate.with_suffix(".cjs")
        raise FileNotFoundError(f"Cannot resolve {request!r} from {parent}")

    def collect(self, path: Path) -> int:
        path = path.resolve()
        if path in self.ids:
            return self.ids[path]
        module_id = len(self.modules)
        self.ids[path] = module_id
        self.modules.append(path)
        source = path.read_text(encoding="utf-8")
        for match in REQUIRE_RE.finditer(source):
            self.collect(self.resolve(path, match.group(2)))
        return module_id

    def transform(self, path: Path) -> str:
        source = path.read_text(encoding="utf-8")

        def replace_require(match: re.Match[str]) -> str:
            target = self.resolve(path, match.group(2))
            return f"__require({self.ids[target]})"

        def replace_export(match: re.Match[str]) -> str:
            names = ", ".join(name.strip() for name in match.group(1).split(","))
            return f"module.exports = {{ {names} }};"

        source = REQUIRE_RE.sub(replace_require, source)
        return EXPORT_RE.sub(replace_export, source)

    def render(self, entry: Path) -> str:
        entry_id = self.collect(entry)
        functions = []
        for module_id, path in enumerate(self.modules):
            relative = path.relative_to(APP_DIR).as_posix()
            # Generated bundles should be diff-clean even though a few legacy
            # source comments still contain end-of-line spaces.
            body = "\n".join(line.rstrip() for line in self.transform(path).splitlines())
            functions.append(
                f"{module_id}: function(module, exports, __require) {{\n"
                f"// {relative}\n{body}\n}}"
            )
        joined = ",\n".join(functions)
        return (
            "(() => {\n'use strict';\n"
            f"const __modules = {{\n{joined}\n}};\n"
            "const __cache = {};\n"
            "const __require = (id) => {\n"
            "  if (__cache[id]) return __cache[id].exports;\n"
            "  const module = { exports: {} };\n"
            "  __cache[id] = module;\n"
            "  __modules[id](module, module.exports, __require);\n"
            "  return module.exports;\n"
            "};\n"
            f"__require({entry_id});\n"
            "})();\n"
        )


def build_bundle(entry: str, output: str) -> None:
    bundler = CommonJsBundle()
    content = bundler.render(APP_DIR / entry)
    destination = APP_DIR / output
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(content, encoding="utf-8", newline="\n")
    print(f"built {destination.relative_to(APP_DIR)} ({len(content):,} bytes)")


def copy_file(source: str, destination: str) -> None:
    source_path = APP_DIR / source
    destination_path = APP_DIR / destination
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_path, destination_path)
    print(f"copied {destination_path.relative_to(APP_DIR)}")


def main() -> None:
    build_bundle("js/global/fascend/build.cjs", "root/js/global/fascend.min.js")
    build_bundle("js/ai/build.cjs", "root/js/ai.min.js")
    # These bundles carry the selected simulation count and RNG visibility.
    # Rebuild them here so the portable build cannot publish stale page code.
    build_bundle("js/core/ai.cjs", "root/js/core/ai.min.js")
    build_bundle("js/main/ai.cjs", "root/js/main/ai.min.js")
    copy_file("js/worker/ai.cjs", "root/js/worker/ai.cjs")
    copy_file("js/worker/ai.cjs", "root/js/worker/ai.min.js")
    copy_file("html/local/ai.html", "root/pages/local/ai.html")
    copy_file("html/endgame/challenge.html", "root/pages/endgame/challenge.html")
    copy_file("tests/browser_smoke.html", "root/dev/browser_smoke.html")
    copy_file("tests/benchmark_parity.html", "root/dev/benchmark_parity.html")

    for name in (
        "ort.wasm.min.js",
        "ort-wasm-simd-threaded.mjs",
        "ort-wasm-simd-threaded.wasm",
        "LICENSE",
    ):
        copy_file(f"vendor/onnxruntime-web/{name}", f"root/vendor/onnxruntime-web/{name}")
    copy_file("model/4ascend-zero.onnx", "root/model/4ascend-zero.onnx")
    copy_file("model/4ascend-zero.json", "root/model/4ascend-zero.json")
    copy_file("vendor/comlink/comlink.min.js", "root/vendor/comlink/comlink.min.js")
    copy_file("vendor/comlink/LICENSE", "root/vendor/comlink/LICENSE")


if __name__ == "__main__":
    main()
