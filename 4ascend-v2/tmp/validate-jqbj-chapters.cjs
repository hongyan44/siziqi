/*
 * 校验 JQBJ 半成品 1-6 章剧本：
 *   node tmp/validate-jqbj-chapters.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '../js/global');
const cache = new Map();
function load(name) {
    const file = path.resolve(source, name);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const text = fs.readFileSync(file, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    new Function('require', 'module', 'exports', text)(
        (p) => (p.startsWith('.') ? load(path.resolve(path.dirname(file), p)) : require(p)),
        module,
        module.exports
    );
    return module.exports;
}

const { StoryScript } = load('story.cjs');
const dir = process.argv[2] || path.resolve(__dirname, '../../JQBJ半成品1-6章剧情中');
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.jqbj')).sort();
let failed = 0;
for (const name of files) {
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    const errors = StoryScript.validate(text);
    const parsed = StoryScript.parse(text);
    console.log(`\n=== ${name} ===`);
    console.log(`节点数: ${parsed.nodes.length}，标签: ${Object.keys(parsed.labels).join(' / ') || '(无)'}`);
    if (errors.length) {
        failed += 1;
        console.log('校验失败:');
        errors.forEach((error) => console.log('  - ' + error));
    } else {
        console.log('校验通过');
    }
}
console.log(`\n共 ${files.length} 个文件，失败 ${failed} 个`);
process.exitCode = failed ? 1 : 0;
