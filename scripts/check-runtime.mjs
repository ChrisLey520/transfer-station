const supportedNodeMajors = new Set([24, 25]);
const requiredPnpmMajor = 11;

const nodeMajor = Number(process.versions.node.split('.')[0]);
const userAgent = process.env.npm_config_user_agent || '';
const pnpmMatch = userAgent.match(/pnpm\/(\d+)\./);
const isPnpm = userAgent.startsWith('pnpm/');
const pnpmMajor = pnpmMatch ? Number(pnpmMatch[1]) : null;

if (!supportedNodeMajors.has(nodeMajor)) {
  console.error(
    `This project must run on Node 24.x or 25.x. Current runtime is Node ${process.versions.node}.\n` +
      'Run `nvm use` in this folder, then reinstall dependencies with `pnpm install`.'
  );
  process.exit(1);
}

if (!isPnpm || pnpmMajor !== requiredPnpmMajor) {
  console.error(
    `This project must use pnpm ${requiredPnpmMajor}.x. Current package runner is ${userAgent || 'unknown'}.\n` +
      'Use `pnpm install` and `pnpm run dev` for this project.'
  );
  process.exit(1);
}
