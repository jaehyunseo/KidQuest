/**
 * Runs both Firestore and Storage rules test suites sequentially.
 * Invoked by `firebase emulators:exec` from npm `test:rules:all`.
 */
import { spawnSync } from 'node:child_process';

const scripts = [
  'scripts/test-rules.mjs',
  'scripts/test-storage-rules.mjs',
];

let failed = 0;
for (const s of scripts) {
  console.log(`\n====== ${s} ======\n`);
  const res = spawnSync(process.execPath, [s], { stdio: 'inherit' });
  if (res.status !== 0) failed++;
}

if (failed) {
  console.error(`\n${failed} suite(s) failed.`);
  process.exit(1);
}
console.log('\nAll rules test suites passed.');
