import { type ReactNode, useEffect, useState } from 'react';
import { fetchAdminStats } from '../../../lib/adminOps';
import type { AdminStats } from '../../../types';

export function OverviewTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchAdminStats()
      .then((s) => {
        if (mounted) setStats(s);
      })
      .catch((e) => {
        if (mounted) setErr(e?.message ?? String(e));
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="p-6 text-gray-500">통계 로딩 중…</div>;
  if (err) return <div className="p-6 text-red-600">오류: {err}</div>;
  if (!stats) return null;

  const completionPct = Math.round(stats.completionRate * 100);
  const consentPct =
    stats.totalUsers > 0
      ? Math.round((stats.consentComplete / stats.totalUsers) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Row 1: Top-line counts */}
      <Section title="📊 전체 현황">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label="가족" value={stats.totalFamilies} tone="blue" />
          <Card label="Auth 사용자" value={stats.totalUsers} tone="purple" />
          <Card
            label="실제 자녀 (ChildProfile)"
            value={stats.totalChildProfiles}
            tone="pink"
          />
          <Card label="관리자" value={stats.admins} tone="indigo" />
        </div>
      </Section>

      {/* Row 2: Semantic role breakdown */}
      <Section title="👥 사용자 분포 (의미 기반)">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card
            label="가족 마스터"
            value={stats.masters}
            tone="amber"
            hint="families.ownerUid 주인"
          />
          <Card
            label="가족 부모 (보조)"
            value={stats.coParents}
            tone="blue"
            hint="join한 non-owner parent"
          />
          <Card
            label="자녀 (Auth)"
            value={stats.authChildren}
            tone="pink"
            hint="users.role='child'"
          />
          <Card
            label="미소속 parent"
            value={stats.orphans}
            tone="gray"
            hint="familyId 없음"
          />
        </div>
      </Section>

      {/* Row 3: Activity & content */}
      <Section title="🎯 활동 & 콘텐츠">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card
            label="등록 퀘스트"
            value={stats.totalQuests}
            tone="green"
          />
          <Card
            label="완료 퀘스트"
            value={stats.completedQuests}
            tone="green"
            hint={`${completionPct}% 완료율`}
          />
          <Card label="피드 포스트" value={stats.totalFeedPosts} tone="pink" />
          <Card label="보상 카탈로그" value={stats.totalRewards} tone="purple" />
        </div>
      </Section>

      {/* Row 4: Consent */}
      <Section title="✅ 개인정보 동의">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-700">
              동의 완료 <b>{stats.consentComplete}</b> / 미완료{' '}
              <b className="text-amber-700">{stats.consentMissing}</b>
            </div>
            <div className="text-sm font-semibold">{consentPct}%</div>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${consentPct}%` }}
            />
          </div>
        </div>
      </Section>

      {/* Row 5: Top families by completion */}
      {stats.topFamilies.length > 0 && (
        <Section title="🏆 가족별 퀘스트 완료 Top 5">
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">가족</th>
                  <th className="px-3 py-2 text-right">자녀</th>
                  <th className="px-3 py-2 text-right">완료 / 전체</th>
                  <th className="px-3 py-2 text-right">완료율</th>
                </tr>
              </thead>
              <tbody>
                {stats.topFamilies.map((f, idx) => {
                  const rate =
                    f.totalQuests > 0
                      ? Math.round((f.completedQuests / f.totalQuests) * 100)
                      : 0;
                  return (
                    <tr key={f.familyId} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold">{f.familyName}</div>
                        <div className="text-xs font-mono text-gray-400">
                          {f.familyId}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">{f.childCount}</td>
                      <td className="px-3 py-2 text-right text-xs">
                        {f.completedQuests} / {f.totalQuests}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`font-semibold ${
                            rate >= 70
                              ? 'text-green-600'
                              : rate >= 30
                                ? 'text-amber-600'
                                : 'text-gray-400'
                          }`}
                        >
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="text-sm font-bold text-gray-700 mb-2">{title}</h2>
      {children}
    </div>
  );
}

type Tone =
  | 'blue'
  | 'purple'
  | 'pink'
  | 'green'
  | 'amber'
  | 'indigo'
  | 'gray';

const TONE_MAP: Record<Tone, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
  pink: 'bg-pink-50 text-pink-700 border-pink-100',
  green: 'bg-green-50 text-green-700 border-green-100',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  gray: 'bg-gray-50 text-gray-600 border-gray-200',
};

function Card({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  tone: Tone;
  hint?: string;
}) {
  return (
    <div className={`rounded-xl p-4 border ${TONE_MAP[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="text-3xl font-extrabold mt-1">{value}</div>
      {hint && <div className="text-[10px] mt-1 opacity-60">{hint}</div>}
    </div>
  );
}
