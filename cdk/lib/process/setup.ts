import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';

export function buildAssets() {
  ['../agent'].forEach((f) => {
    fs.readdirSync(`${process.cwd()}/${f}`, {
      withFileTypes: true,
    })
      .filter((p) => p.isFile() && (p.name.endsWith('.js') || p.name.endsWith('.d.ts')))
      .map((p) => `${process.cwd()}/${f}/${p.name}`)
      .forEach((file) => {
        if (fs.existsSync(file)) {
          fs.rmSync(file, {
            recursive: true,
          });
        }
      });

    const basePath = `${process.cwd()}/${f}`;

    if (fs.existsSync(`${basePath}/.agentcore-staging`)) {
      fs.rmdirSync(`${basePath}/.agentcore-staging`, {
        recursive: true,
      });
    }

    ['pnpm install', 'pnpm build'].forEach((cmd) => {
      childProcess.execSync(cmd, {
        cwd: `${basePath}/`,
        stdio: ['ignore', 'inherit', 'inherit'],
        env: {
          ...process.env,
        },
        shell: process.env.SHELL || 'bash',
      });
    });
  });

  ['../frontend'].forEach((f) => {
    fs.readdirSync(`${process.cwd()}/${f}`, {
      withFileTypes: true,
    })
      .filter((p) => p.isFile() && (p.name.endsWith('.js') || p.name.endsWith('.d.ts')))
      .map((p) => `${process.cwd()}/${f}/${p.name}`)
      .forEach((file) => {
        if (fs.existsSync(file)) {
          fs.rmSync(file, {
            recursive: true,
          });
        }
      });
    ['pnpm build'].forEach((cmd) => {
      childProcess.execSync(cmd, {
        cwd: `${process.cwd()}/${f}/`,
        stdio: ['ignore', 'inherit', 'inherit'],
        env: {
          ...process.env,
        },
        shell: process.env.SHELL || 'bash',
      });
    });
  });
}
