/**
 * Unit tests for KidQuest pure logic.
 *
 * Runs every helper in src/lib/* that does NOT depend on Firebase, DOM,
 * or React. If one of these breaks, a feature in the UI is broken too.
 *
 * Usage:
 *   node scripts/unit-tests.mjs
 *
 * Exits non-zero if any assertion fails.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';

// All modules under test
const achievements = await tsImport('../src/lib/achievements.ts', import.meta.url);
const categoryPref = await tsImport('../src/lib/categoryPreference.ts', import.meta.url);
const exportCsv   = await tsImport('../src/lib/exportCsv.ts', import.meta.url);
const reminders   = await tsImport('../src/lib/reminders.ts', import.meta.url);
const hash        = await tsImport('../src/lib/hash.ts', import.meta.url);

// Polyfill globals that some modules expect
globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
})();

// ============================================================
describe('achievements.ts — streak math', () => {
  const { nextStreak, localDateKey } = achievements;

  test('first-ever completion starts streak at 1', () => {
    const r = nextStreak(undefined, undefined, '2026-04-14');
    assert.equal(r.streak, 1);
    assert.equal(r.touched, true);
  });

  test('second completion same day does not increment', () => {
    const r = nextStreak(3, '2026-04-14', '2026-04-14');
    assert.equal(r.streak, 3);
    assert.equal(r.touched, false);
  });

  test('completion on consecutive day increments', () => {
    const r = nextStreak(3, '2026-04-13', '2026-04-14');
    assert.equal(r.streak, 4);
    assert.equal(r.touched, true);
  });

  test('gap of 2+ days resets to 1', () => {
    const r = nextStreak(10, '2026-04-10', '2026-04-14');
    assert.equal(r.streak, 1);
    assert.equal(r.touched, true);
  });

  test('gap across month boundary still counts as consecutive', () => {
    const r = nextStreak(5, '2026-03-31', '2026-04-01');
    assert.equal(r.streak, 6);
  });

  test('localDateKey formats as YYYY-MM-DD', () => {
    assert.match(localDateKey(new Date(2026, 3, 14)), /^2026-04-14$/);
  });
});

describe('achievements.ts — badge evaluation', () => {
  const { evaluateNewBadges, ACHIEVEMENTS } = achievements;

  test('first_step unlocks on first completion', () => {
    const newBadges = evaluateNewBadges(
      { totalCompleted: 1, streak: 1, longestStreak: 1, rewardsRedeemed: 0, totalPoints: 10 },
      []
    );
    assert.ok(newBadges.includes('first_step'));
  });

  test('already-unlocked badges are not returned again', () => {
    const newBadges = evaluateNewBadges(
      { totalCompleted: 5, streak: 2, longestStreak: 2, rewardsRedeemed: 0, totalPoints: 50 },
      ['first_step']
    );
    assert.ok(!newBadges.includes('first_step'));
  });

  test('streak_7 unlocks at longestStreak >= 7', () => {
    const newBadges = evaluateNewBadges(
      { totalCompleted: 20, streak: 7, longestStreak: 7, rewardsRedeemed: 0, totalPoints: 200 },
      []
    );
    assert.ok(newBadges.includes('streak_7'));
    assert.ok(newBadges.includes('streak_3')); // lower threshold also unlocks
  });

  test('point_1000 unlocks at exactly 1000 points', () => {
    const newBadges = evaluateNewBadges(
      { totalCompleted: 50, streak: 5, longestStreak: 5, rewardsRedeemed: 0, totalPoints: 1000 },
      []
    );
    assert.ok(newBadges.includes('point_1000'));
  });

  test('all badges have required fields', () => {
    for (const a of ACHIEVEMENTS) {
      assert.ok(a.id, 'missing id');
      assert.ok(a.title, 'missing title');
      assert.ok(a.icon, 'missing icon');
      assert.ok(a.color, 'missing color');
      assert.equal(typeof a.check, 'function', 'missing check fn');
    }
  });
});

// ============================================================
describe('categoryPreference.ts', () => {
  const { categoryCompletionCounts, topCategories } = categoryPref;

  const sampleHistory = [
    { id: '1', title: 'a', points: 10, category: 'homework', timestamp: '2026-04-14T10:00:00Z' },
    { id: '2', title: 'b', points: 10, category: 'homework', timestamp: '2026-04-14T11:00:00Z' },
    { id: '3', title: 'c', points: 10, category: 'chore',    timestamp: '2026-04-14T12:00:00Z' },
    { id: '4', title: 'd', points: -100, type: 'reward', title: 'r', timestamp: '2026-04-14T13:00:00Z' },
    { id: '5', title: 'e', points: 10, category: 'habit',    timestamp: '2026-04-14T14:00:00Z' },
  ];

  test('counts completions, excludes reward redemptions', () => {
    const counts = categoryCompletionCounts(sampleHistory);
    assert.equal(counts.homework, 2);
    assert.equal(counts.chore, 1);
    assert.equal(counts.habit, 1);
    assert.equal(counts.reward, undefined);
  });

  test('topCategories returns sorted by desc', () => {
    const top = topCategories(sampleHistory, 3);
    assert.equal(top[0], 'homework');
    assert.ok(top.length >= 3);
  });

  test('empty history returns empty array', () => {
    assert.deepEqual(topCategories([], 3), []);
  });
});

// ============================================================
describe('exportCsv.ts', () => {
  const { historyToCsv } = exportCsv;

  test('produces BOM + header + rows', () => {
    const csv = historyToCsv([
      { id: '1', title: '숙제', points: 10, category: 'homework', timestamp: '2026-04-14T10:00:00Z' },
    ]);
    assert.ok(csv.startsWith('\uFEFF'));
    assert.ok(csv.includes('날짜,시간,유형,제목,카테고리,포인트'));
    assert.ok(csv.includes('숙제'));
    assert.ok(csv.includes('10'));
  });

  test('handles reward rows distinctly', () => {
    const csv = historyToCsv([
      { id: '1', type: 'reward', title: '영화의 밤', points: -500, timestamp: '2026-04-14T10:00:00Z' },
    ]);
    assert.ok(csv.includes('특별 미션'));
  });

  test('escapes titles with commas and quotes', () => {
    const csv = historyToCsv([
      { id: '1', title: '1,000원 짜리 "선물"', points: 10, category: 'other', timestamp: '2026-04-14T10:00:00Z' },
    ]);
    assert.ok(csv.includes('"1,000원 짜리 ""선물"""'));
  });
});

// ============================================================
describe('reminders.ts', () => {
  const {
    DEFAULT_REMINDERS,
    loadReminderSettings,
    saveReminderSettings,
  } = reminders;

  test('default settings are disabled', () => {
    assert.equal(DEFAULT_REMINDERS.enabled, false);
  });

  test('save/load round-trip', () => {
    saveReminderSettings({ enabled: true, morningHour: 9, eveningHour: 21 });
    const loaded = loadReminderSettings();
    assert.equal(loaded.enabled, true);
    assert.equal(loaded.morningHour, 9);
    assert.equal(loaded.eveningHour, 21);
  });

  test('corrupt localStorage falls back to default', () => {
    globalThis.localStorage.setItem('kidquest_reminder_settings', '{not json');
    const loaded = loadReminderSettings();
    assert.deepEqual(loaded, DEFAULT_REMINDERS);
  });
});

// ============================================================
describe('hash.ts', () => {
  const { sha256, saltedHash, randomSalt } = hash;

  test('sha256 is deterministic', async () => {
    const a = await sha256('1234');
    const b = await sha256('1234');
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });

  test('different inputs produce different hashes', async () => {
    const a = await sha256('1234');
    const b = await sha256('12345');
    assert.notEqual(a, b);
  });

  test('saltedHash changes output when salt changes', async () => {
    const a = await saltedHash('1234', 'saltA');
    const b = await saltedHash('1234', 'saltB');
    assert.notEqual(a, b);
  });

  test('randomSalt produces unique values', () => {
    const a = randomSalt();
    const b = randomSalt();
    assert.notEqual(a, b);
    assert.match(a, /^[0-9a-f]{32}$/);
  });
});
