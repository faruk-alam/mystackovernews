const { spawn } = require('node:child_process');

const builders = [
  spawn(process.execPath, ['build.js', '--watch'], { stdio: 'inherit' }),
  spawn('tailwindcss', ['-i', './src/input.css', '-o', './dist/style.css', '--minify', '--watch'], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
];

for (const child of builders) {
  child.on('exit', code => {
    for (const process of builders) if (process !== child && !process.killed) process.kill();
    process.exit(code ?? 0);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  for (const child of builders) if (!child.killed) child.kill(signal);
});
