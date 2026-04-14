/**
 * One-off utility: seed 6 default rewards for a specific family via
 * the Firestore REST API, using gcloud Application Default Credentials.
 *
 * This was used to recover the "행복한가족" family whose rewards
 * collection was empty because an earlier role=child misconfiguration
 * blocked the in-app auto-seed migration.
 *
 * Usage:
 *   node scripts/seed-user-rewards.mjs <projectId> <databaseId> <familyId>
 */
import { execSync } from 'node:child_process';

const projectId = process.argv[2] || 'gen-lang-client-0281831277';
const databaseId = process.argv[3] || 'ai-studio-2ec230ec-f2ca-4672-be64-eebc32cf5343';
const familyId = process.argv[4] || 'SIDEQs0YS3melMx6sN24';

const REWARDS = [
  { title: '유튜브 30분 시청권', description: '오늘 하루 유튜브를 30분 더 볼 수 있어요!', points: 300, icon: '📺' },
  { title: '맛있는 아이스크림', description: '편의점에서 좋아하는 아이스크림 하나!', points: 500, icon: '🍦' },
  { title: '주말 게임 1시간 추가', description: '이번 주말에 게임을 1시간 더 할 수 있어요.', points: 1000, icon: '🎮' },
  { title: '원하는 장난감 선물', description: '부모님과 상의해서 원하는 장난감을 골라요!', points: 5000, icon: '🧸' },
  { title: '가족 외식', description: '가고 싶은 식당에서 함께 저녁을 먹어요!', points: 2000, icon: '🍕' },
  { title: '책 한 권 선물', description: '읽고 싶은 책을 골라 선물 받아요.', points: 1500, icon: '📚' },
];

const token = execSync('cmd.exe /c "gcloud auth print-access-token"', { encoding: 'utf8' })
  .trim();

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/families/${familyId}/rewards`;

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && Number.isInteger(v)) {
      fields[k] = { integerValue: String(v) };
    } else {
      fields[k] = { stringValue: String(v) };
    }
  }
  return fields;
}

let created = 0;
for (const r of REWARDS) {
  const body = JSON.stringify({ fields: toFields(r) });
  const res = await fetch(base, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body,
  });
  if (res.ok) {
    const data = await res.json();
    console.log(`✅ ${r.title} → ${data.name.split('/').pop()}`);
    created++;
  } else {
    const err = await res.text();
    console.error(`❌ ${r.title}: ${err}`);
  }
}

console.log(`\n${created}/${REWARDS.length} rewards seeded.`);

// Also mark the rewardsSeeded flag on the family doc
const famUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/families/${familyId}?updateMask.fieldPaths=rewardsSeeded`;
const flagRes = await fetch(famUrl, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json; charset=utf-8',
  },
  body: JSON.stringify({ fields: { rewardsSeeded: { booleanValue: true } } }),
});
console.log(flagRes.ok ? '✅ rewardsSeeded flag set' : '❌ failed to set flag');
