/*
 * @Description: 为所有引用 must.min.js 的页面补充 achievement.min.js（一次性脚本）
 */
const fs = require('node:fs');
const path = require('node:path');

const HTML_DIR = path.join(__dirname, '..', 'html');

const walk = (dir, list = []) => {
    fs.readdirSync(dir).forEach((name) => {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full, list);
        else if (name.endsWith('.html')) list.push(full);
    });
    return list;
};

walk(HTML_DIR).forEach((file) => {
    let text = fs.readFileSync(file, 'utf8');
    if (!text.includes('must.min.js')) return;
    if (text.includes('achievement.min.js')) return;

    const regex = /^.*<script src='\/js\/ref\/must\.min\.js\?v=replace'><\/script>.*$/m;
    if (!regex.test(text)) {
        console.log(`跳过（未匹配标签）: ${file}`);
        return;
    }

    text = text.replace(regex, (line) => `${line}\n    <script src='/js/ref/achievement.min.js?v=replace'></script>`);
    fs.writeFileSync(file, text);
    console.log(`已补充: ${path.relative(path.join(__dirname, '..'), file)}`);
});
