/**
 * Build base64 payloads used by agent-browser eval during the replay check.
 */
const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const code = fs.readFileSync(path.join(dir, 'replay-archive-code.txt'), 'utf8');

const scripts = {
    'fill.b64': `
        const el = document.getElementById('input_archive_text');
        el.value = ${JSON.stringify(code)};
        'filled:' + el.value.length;
    `,
    'load.b64': `
        document.getElementById('button_archive_play').click();
        'clicked';
    `
};

for (const [file, script] of Object.entries(scripts)) {
    fs.writeFileSync(path.join(dir, file), Buffer.from(script, 'utf8').toString('base64'), 'utf8');
    console.log(file, 'ok');
}
