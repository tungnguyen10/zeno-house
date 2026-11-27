import { execFileSync } from 'node:child_process';

function readAt(commit, path) {
  const json = execFileSync('git', ['show', `${commit}:${path}`], { encoding: 'utf8' });
  return JSON.parse(json);
}

function parseVersion(version) {
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`Invalid stable app version: ${version}`);
  }

  return version.split('.').map(part => BigInt(part));
}

try {
  const current = readAt('HEAD', 'package.json').version;
  const parent = readAt('HEAD^', 'package.json').version;
  const lock = readAt('HEAD', 'package-lock.json');

  if (lock.version !== current || lock.packages?.['']?.version !== current) {
    throw new Error('The package and lockfile versions differ.');
  }

  const previousVersion = parseVersion(parent);
  const nextVersion = parseVersion(current);
  const firstChange = nextVersion.findIndex((part, index) => part !== previousVersion[index]);

  if (firstChange >= 0 && nextVersion[firstChange] > previousVersion[firstChange]) {
    process.stdout.write(`Build the production version ${current}.` + "\n");
    // Vercel continues the build when the ignored-build command exits with 1.
    process.exitCode = 1;
  } else {
    process.stdout.write(`Skip production build. Version ${current} does not advance ${parent}.` + "\n");
  }
} catch (error) {
  console.error(`Skip production build. ${error.message}`);
}
