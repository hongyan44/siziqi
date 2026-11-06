const fs = require('node:fs');
const path = require('node:path');
const msgpack = require('msgpack-lite');

global.window = {};
// verf() 的防篡改分支在 Node 中会把 S_BOX[2] 破坏成数字，导致加解密结果变成垃圾；浏览器中因 document.all 特性会直接 return。
// 这里仅在探测脚本中去掉该调用，保持与浏览器实际行为一致。
const apiSrc = fs.readFileSync(path.resolve(__dirname, '..', 'risk', 'api.cjs'), 'utf8').replace(/\r?\nverf\(\);\r?\n/, '\n');
new Function('window', apiSrc)(global.window);
const { encrypt, decrypt } = global.window.RiskExports.Api;

const call = async (host, route, params) => {
    const body = new Uint8Array(encrypt(Array.from(msgpack.encode(params))));
    const response = await fetch(`https://${host}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body
    });
    const raw = Array.from(new Uint8Array(await response.arrayBuffer()));
    console.log('status:', response.status, 'len:', raw.length);
    const plain = decrypt(raw);
    console.log('raw:', raw.slice(0, 16), 'plain:', plain.slice(0, 32));
    try { return msgpack.decode(plain); } catch (error) { console.log('plain decode failed, try raw:', msgpack.decode(raw)); return null; }
};

(async () => {
    const result = await call('online.siziqi.net', '/story/character_query', {});
    const out = path.join(process.env.TEMP, 'story-faces-probe');
    fs.mkdirSync(out, { recursive: true });
    const characters = (result && result.result && result.result.characters) || [];
    console.log('characters:', characters.map((c) => c.name).join(', '));
    for (const character of characters) {
        const images = [{ kind: 'rep', name: 'rep', url: character.rep }].concat((character.expressions || []).map((e) => ({ kind: 'expr', name: e.name, url: e.image })));
        for (const item of images) {
            const url = String(item.url || '');
            const head = url.slice(0, 30);
            const match = /^data:image\/([a-z]+);base64,(.*)$/i.exec(url);
            let file = '';
            if (match) {
                const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
                const safe = `${character.name}_${item.kind}_${item.name}`.replace(/[\\/:*?"<>|]/g, '_');
                file = path.join(out, `${safe}.${ext}`);
                fs.writeFileSync(file, Buffer.from(match[2], 'base64'));
            }
            console.log(`${character.name} | ${item.kind} | ${item.name} | ${head} | ${file}`);
        }
    }
    console.log('saved:', out);
})();
