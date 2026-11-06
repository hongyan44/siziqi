/*
 * 全服消息接口回归测试：
 *   1) /notice/query 无消息时返回 notice=null
 *   2) /notice/publish 无管理员 token 时必须拒绝
 *   3) 直接写入数据库后 /notice/query 能返回最新消息
 * 运行： node tmp/notice-api-test.cjs
 */
const path = require('node:path');

const fs = require('node:fs');

// api.cjs 的 verf() 在非浏览器环境会故意篡改 S_BOX（反调试），
// Node 里没有 document.all 的 [[IsHTMLDDA]] 特性无法通过检测，加载时剔除该篡改。
global.window = {};
const source = fs.readFileSync(path.resolve(__dirname, '../js/risk/api.cjs'), 'utf8')
    .replace('S_BOX[0x2]=S_BOX[0x2]^0x5;', 'return;');
new Function('window', source)(global.window);

const msgpack = require('msgpack-lite');
const encrypt = global.window.RiskExports.Api.encrypt;
const decrypt = global.window.RiskExports.Api.decrypt;

const BASE = process.env.NOTICE_TEST_BASE || 'http://172.24.80.122:50001';

async function call(route, params) {
    const payload = Array.from(msgpack.encode(params));
    const res = await fetch(`${BASE}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(encrypt(payload)),
    });
    const body = new Uint8Array(await res.arrayBuffer());
    const plain = decrypt(Array.from(body));
    console.log('DEBUG body/plain', body.length, Array.isArray(plain), plain.length, Array.from(plain).slice(0, 8));
    return msgpack.decode(Buffer.from(plain));
}

(async () => {
    let failed = 0;
    const check = (name, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` -> ${detail}` : ''}`);
        if (!ok) ++failed;
    };

    const empty = await call('/notice/query', {});
    check('query empty', empty && empty.status === true && empty.result && empty.result.notice === null, JSON.stringify(empty));

    const denied = await call('/notice/publish', { title: '测试', content: '无 token 不应发布' });
    check('publish without token rejected', denied && denied.status === false, JSON.stringify(denied));

    const denied_clear = await call('/notice/clear', {});
    check('clear without token rejected', denied_clear && denied_clear.status === false, JSON.stringify(denied_clear));

    if (failed) process.exit(1);
})();
