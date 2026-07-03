import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';

export function buildFrontend({
  userPoolId,
  clientId,
  region,
  runtimeArn,
}: {
  userPoolId: string;
  clientId: string;
  region: string;
  runtimeArn: string;
}) {

  const endpoint = `https://bedrock-agentcore.${region}.amazonaws.com`;
  const escapedArn = encodeURIComponent(runtimeArn);
  const url = `${endpoint}/runtimes/${escapedArn}/invocations?qualifier=DEFAULT`;


  ['../frontend'].forEach((f) => {
    fs.readdirSync(`${process.cwd()}/${f}`, {
      withFileTypes: true,
    })
      .filter(
        (p) =>
          p.isFile() && (p.name.endsWith('.js') || p.name.endsWith('.d.ts')),
      )
      .map((p) => `${process.cwd()}/${f}/${p.name}`)
      .forEach((file) => {
        if (fs.existsSync(file)) {
          fs.rmSync(file, {
            recursive: true,
          });
        }
      });
    ['pnpm install', 'pnpm build'].forEach((cmd) => {
      childProcess.execSync(cmd, {
        cwd: `${process.cwd()}/${f}/`,
        stdio: ['ignore', 'inherit', 'inherit'],
        env: {
          ...process.env,
          VITE_AWS_COGNITO_USER_POOL_ID: userPoolId,
          VITE_AWS_WEB_CLIENT_ID: clientId,
          VITE_AGENT_ENDPOINT: url,
        },
        shell: process.env.SHELL || 'bash',
      });
    });
  });
};
