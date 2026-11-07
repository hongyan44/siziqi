// 临时探针：读取线上 story 文档，统计各关卡剧本中的旧分组框语法
const fs = require('node:fs');
const path = require('node:path');
const msgpack = require('msgpack-lite');

global.window = {};
const apiSrc = fs.readFileSync(path.resolve(__dirname, '..', 'risk', 'api.cjs'), 'utf8').replace(/\r?\nverf\(\);\r?\n/, '\n');
new Function('window', apiSrc)(global.window);
const { encrypt, decrypt } = global.window.RiskExports.Api;

const call = async (route, params) => {
    const body = new Uint8Array(encrypt(Array.from(msgpack.encode(params))));
    const response = await fetch(`https://online.siziqi.net${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body
    });
    const raw = Array.from(new Uint8Array(await response.arrayBuffer()));
    return msgpack.decode(decrypt(raw));
};

(async () => {
    const data = await call('/docs/query', { key: 'story' });
    const raw = data && data.result && data.result.data;
    if (!raw) {
        console.log('no story doc:', JSON.stringify(data).slice(0, 300));
        return;
    }
    fs.writeFileSync(path.join(process.env.TEMP, 'story-doc-raw.json'), raw);
    const doc = JSON.parse(raw);
    const levels = Array.isArray(doc.levels) ? doc.levels : [];
    console.log('version:', doc.version, 'levels:', levels.length);
    levels.forEach((level) => {
        const script = String(level.script || '');
        const boxes = (script.match(/^\s*(?:\{[^{}]*|\{|\}|框(?:\s|$)|结束框)/gm) || []).length;
        if (boxes) console.log(`level ${level.level} "${level.title}" box-lines=${boxes}`);
    });
})();
