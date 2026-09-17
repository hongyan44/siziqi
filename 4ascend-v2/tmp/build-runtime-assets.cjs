const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'root');
const audioSource = path.join(__dirname, '..', 'resource', 'audio', 'game');
const audioOutput = path.join(root, 'audio', 'game');
const workerSource = path.join(__dirname, '..', 'js', 'worker');
const workerOutput = path.join(root, 'js', 'worker');

fs.mkdirSync(audioOutput, { recursive: true });
for (const name of fs.readdirSync(audioSource)) {
    const input = path.join(audioSource, name);
    if (fs.statSync(input).isFile()) fs.copyFileSync(input, path.join(audioOutput, name));
}
fs.mkdirSync(workerOutput, { recursive: true });
for (const name of fs.readdirSync(workerSource)) {
    const input = path.join(workerSource, name);
    if (fs.statSync(input).isFile()) {
        const outputName = name.replace(/\.cjs$/, '.min.js');
        fs.copyFileSync(input, path.join(workerOutput, outputName));
    }
}

