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
const materializer = await tsImport('../src/lib/questMaterializer.ts', import.meta.url);
const pastWindow  = await tsImport('../src/lib/pastWindow.ts', import.meta.url);

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
    assert.ok(csv.includes('보상 받기'));
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

// ============================================================
describe('questMaterializer.ts — evaluateGroupBonus', () => {
  const { evaluateGroupBonus } = materializer;

  const inst = (id, completed, claimed = false, scheduledDate = '2026-04-15', groupId = 'g1') => ({
    id,
    title: id,
    points: 10,
    category: 'homework',
    completed,
    scheduledDate,
    groupId,
    groupBonusClaimed: claimed,
  });

  test('no siblings → not eligible', () => {
    const { eligible, siblings } = evaluateGroupBonus('g1', '2026-04-15', []);
    assert.equal(eligible, false);
    assert.equal(siblings.length, 0);
  });

  test('siblings present but one incomplete → not eligible', () => {
    const all = [inst('a', true), inst('b', false), inst('c', true)];
    const { eligible } = evaluateGroupBonus('g1', '2026-04-15', all);
    assert.equal(eligible, false);
  });

  test('all siblings complete and no claim → eligible', () => {
    const all = [inst('a', true), inst('b', true), inst('c', true)];
    const { eligible, siblings } = evaluateGroupBonus('g1', '2026-04-15', all);
    assert.equal(eligible, true);
    assert.equal(siblings.length, 3);
  });

  test('already claimed → not eligible (no double payout)', () => {
    const all = [inst('a', true, true), inst('b', true), inst('c', true)];
    const { eligible } = evaluateGroupBonus('g1', '2026-04-15', all);
    assert.equal(eligible, false);
  });

  test('different dates do not mingle when scheduledDate is set', () => {
    const all = [
      inst('a', true, false, '2026-04-15'),
      inst('b', true, false, '2026-04-14'), // yesterday, ignored
    ];
    const { eligible, siblings } = evaluateGroupBonus('g1', '2026-04-15', all);
    assert.equal(eligible, true); // only 1 sibling today, all complete
    assert.equal(siblings.length, 1);
  });

  test('quests without scheduledDate are treated as live for today', () => {
    const undated = {
      id: 'a',
      title: 'a',
      points: 10,
      category: 'homework',
      completed: true,
      groupId: 'g1',
      groupBonusClaimed: false,
    };
    const { eligible, siblings } = evaluateGroupBonus('g1', '2026-04-15', [undated]);
    assert.equal(eligible, true);
    assert.equal(siblings.length, 1);
  });

  test('different groups are isolated', () => {
    const all = [
      inst('a', true, false, '2026-04-15', 'g1'),
      inst('b', false, false, '2026-04-15', 'g2'),
    ];
    const r1 = evaluateGroupBonus('g1', '2026-04-15', all);
    const r2 = evaluateGroupBonus('g2', '2026-04-15', all);
    assert.equal(r1.eligible, true);
    assert.equal(r2.eligible, false);
  });
});

// ============================================================
describe('pastWindow.ts — retroactive completion guard', () => {
  const { evalPastWindow } = pastWindow;
  // Anchor "now" at noon local on 2026-04-15 to keep tests deterministic
  // across timezones. dayKey is computed from the SAME local date.
  const NOW = new Date(2026, 3, 15, 12, 0, 0);
  const DAY_KEY = '2026-04-15';

  test('quest with no scheduledDate is always allowed and not past', () => {
    const r = evalPastWindow(undefined, DAY_KEY, 7, NOW);
    assert.equal(r.allowed, true);
    if (r.allowed) {
      assert.equal(r.isPastScheduled, false);
      assert.equal(r.effectiveTimestamp, NOW.toISOString());
    }
  });

  test('today-scheduled quest is allowed and not past', () => {
    const r = evalPastWindow('2026-04-15', DAY_KEY, 7, NOW);
    assert.equal(r.allowed, true);
    if (r.allowed) {
      assert.equal(r.isPastScheduled, false);
      assert.equal(r.effectiveTimestamp, NOW.toISOString());
    }
  });

  test('1-day-old quest is allowed, marked past, timestamp lands on that day', () => {
    const r = evalPastWindow('2026-04-14', DAY_KEY, 7, NOW);
    assert.equal(r.allowed, true);
    if (r.allowed) {
      assert.equal(r.isPastScheduled, true);
      // toDateString roundtrip should match the scheduled day in local tz
      assert.equal(
        new Date(r.effectiveTimestamp).toDateString(),
        new Date(2026, 3, 14, 12, 0, 0).toDateString(),
      );
    }
  });

  test('exactly 7-day-old quest is allowed (boundary inclusive)', () => {
    const r = evalPastWindow('2026-04-08', DAY_KEY, 7, NOW);
    assert.equal(r.allowed, true);
  });

  test('8-day-old quest is rejected as too-old', () => {
    const r = evalPastWindow('2026-04-07', DAY_KEY, 7, NOW);
    assert.equal(r.allowed, false);
    if (!r.allowed) assert.equal(r.reason, 'too-old');
  });

  test('future-scheduled quest is rejected as future', () => {
    const r = evalPastWindow('2026-04-16', DAY_KEY, 7, NOW);
    assert.equal(r.allowed, false);
    if (!r.allowed) assert.equal(r.reason, 'future');
  });

  test('past-day timestamp survives toDateString roundtrip (calendar key match)', () => {
    // The CalendarView buckets history by `new Date(timestamp).toDateString()`.
    // For retroactive completions to land on the right day, the noon-local
    // construction must match the same toDateString as a Date for that day.
    for (const dateStr of ['2026-04-09', '2026-04-10', '2026-04-13', '2026-04-15']) {
      const r = evalPastWindow(dateStr, DAY_KEY, 7, NOW);
      assert.equal(r.allowed, true, `${dateStr} should be allowed`);
      if (r.allowed && r.isPastScheduled) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const expected = new Date(y, m - 1, d, 12, 0, 0).toDateString();
        assert.equal(
          new Date(r.effectiveTimestamp).toDateString(),
          expected,
          `${dateStr} timestamp should bucket to its own calendar day`,
        );
      }
    }
  });
});
