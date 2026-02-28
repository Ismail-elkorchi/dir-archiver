import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const run = async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const packageLock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  const runtimeDependencies = Object.entries(packageJson.dependencies ?? {});

  if (runtimeDependencies.length === 0) {
    process.stdout.write('[deps:fresh] no direct runtime dependencies declared\n');
    return;
  }

  const violations = [];

  for (const [name, declaredRange] of runtimeDependencies) {
    const latest = await loadLatestVersion(name);
    const locked = loadLockedVersion(packageLock, name);

    if (!locked) {
      violations.push({
        name,
        declaredRange,
        latest,
        reason: 'missing lockfile entry'
      });
      continue;
    }

    if (locked !== latest) {
      violations.push({
        name,
        declaredRange,
        locked,
        latest,
        reason: 'outdated lockfile/runtime dependency'
      });
    }
  }

  if (violations.length > 0) {
    process.stderr.write('[deps:fresh] runtime dependency freshness check failed\n');
    for (const violation of violations) {
      const lockedPart = violation.locked ? ` locked=${violation.locked}` : '';
      process.stderr.write(
        `- ${violation.name}: range=${violation.declaredRange}${lockedPart} latest=${violation.latest} (${violation.reason})\n`
      );
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `[deps:fresh] ok ${runtimeDependencies.map(([name]) => name).join(', ')}\n`
  );
};

async function loadLatestVersion(packageName) {
  const { stdout } = await execFileAsync(
    'npm',
    ['view', packageName, 'version', '--json'],
    {
      encoding: 'utf8'
    }
  );
  const parsed = JSON.parse(stdout);
  if (typeof parsed === 'string') {
    return parsed;
  }
  if (Array.isArray(parsed)) {
    const last = parsed.at(-1);
    if (typeof last === 'string' && last.length > 0) {
      return last;
    }
  }
  throw new Error(`[deps:fresh] unable to parse latest version for ${packageName}`);
}

function loadLockedVersion(packageLock, packageName) {
  const packageEntryVersion =
    packageLock.packages?.[`node_modules/${packageName}`]?.version;
  if (typeof packageEntryVersion === 'string' && packageEntryVersion.length > 0) {
    return packageEntryVersion;
  }
  const dependencyEntryVersion = packageLock.dependencies?.[packageName]?.version;
  if (
    typeof dependencyEntryVersion === 'string' &&
    dependencyEntryVersion.length > 0
  ) {
    return dependencyEntryVersion;
  }
  return null;
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
