import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const command = isWindows
  ? (process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe')
  : 'npm';

const workspaces = ['@academy/api', '@academy/admin-web'];

const children = workspaces.map((workspace) => {
  const args = isWindows
    ? ['/d', '/s', '/c', `npm.cmd run dev -w ${workspace}`]
    : ['run', 'dev', '-w', workspace];

  return spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
  });
});

let stopping = false;

const stop = () => {
  if (stopping) return;

  stopping = true;

  for (const child of children) {
    child.kill('SIGTERM');
  }
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

for (const child of children) {
  child.on('error', (error) => {
    console.error('No se pudo iniciar un proceso:', error);
    stop();
    process.exitCode = 1;
  });

  child.on('exit', (code) => {
    if (!stopping && code && code !== 0) {
      stop();
      process.exitCode = code;
    }
  });
}

await Promise.all(
  children.map(
    (child) => new Promise((resolve) => child.on('exit', resolve)),
  ),
);