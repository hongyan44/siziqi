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
    const data = await call('/story/level_query', { level: 99 });
    const result = data && data.result;
    console.log('keys:', result && Object.keys(result));
    console.log('title:', result && result.title);
    console.log('script:');
    console.log(String((result && result.script) || '').slice(0, 2000));
    fs.writeFileSync(path.join(process.env.TEMP, 'story-level-99.txt'), String((result && result.script) || ''));
})();
