#!/usr/bin/env node
/**
 * Run any command with Microsoft OpenJDK 21 injected into PATH.
 *
 * Why: the machine has a broken Oracle javapath entry at the front of
 * System PATH that Windows can't override from user-level settings,
 * so `java` fails in fresh terminals even with JAVA_HOME set. Rather
 * than require admin elevation to clean up the system PATH, this
 * wrapper prepends the JDK bin directory to PATH only for the child
 * process — surgical, idempotent, admin-free.
 *
 * Usage:
 *   node scripts/with-java.mjs <command> [...args]
 *
 * Example (from package.json):
 *   "test:rules:ci": "node scripts/with-java.mjs firebase emulators:exec ..."
 *
 * The wrapper auto-detects the JDK install under
 *   C:\\Program Files\\Microsoft\\jdk-*-hotspot
 * so it keeps working if the user upgrades the JDK.
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function findJdkBin() {
  // 1) JAVA_HOME wins if set
  if (process.env.JAVA_HOME) {
    const bin = join(process.env.JAVA_HOME, 'bin');
    if (existsSync(join(bin, 'java.exe')) || existsSync(join(bin, 'java'))) return bin;
  }
  // 2) Scan standard Microsoft OpenJDK install location
  const msRoot = 'C:\\Program Files\\Microsoft';
  if (existsSync(msRoot)) {
    const candidates = readdirSync(msRoot)
      .filter((d) => /^jdk-\d+.*-hotspot$/.test(d))
      .sort()
      .reverse();
    for (const dir of candidates) {
      const bin = join(msRoot, dir, 'bin');
      if (existsSync(join(bin, 'java.exe'))) return bin;
    }
  }
  // 3) Other common locations
  const commonPaths = [
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Java',
  ];
  for (const root of commonPaths) {
    if (!existsSync(root)) continue;
    const dirs = readdirSync(root)
      .map((d) => join(root, d, 'bin'))
      .filter((bin) => existsSync(join(bin, 'java.exe')));
    if (dirs.length) return dirs[0];
  }
  return null;
}

const jdkBin = findJdkBin();
if (!jdkBin) {
  console.error('[with-java] ERROR: could not locate a Java JDK install.');
  console.error('[with-java] Install with: winget install Microsoft.OpenJDK.21');
  process.exit(1);
}

const env = { ...process.env };
env.PATH = `${jdkBin};${env.PATH || env.Path || ''}`;
if (!env.JAVA_HOME) env.JAVA_HOME = jdkBin.replace(/[\\/]bin$/i, '');

const [, , cmd, ...args] = process.argv;
if (!cmd) {
  console.error('[with-java] Usage: node scripts/with-java.mjs <command> [...args]');
  process.exit(2);
}

console.log(`[with-java] using ${jdkBin}`);
// When spawning with shell: true, Node joins argv with spaces which
// destroys any pre-existing quoting. Re-quote any arg that contains
// whitespace or shell metacharacters so nested commands survive.
const shellQuote = (a) => (/[\s"'&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
const shellCmd = [cmd, ...args.map(shellQuote)].join(' ');
const child = spawn(shellCmd, { env, stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (err) => {
  console.error('[with-java] spawn error:', err.message);
  process.exit(1);
});
