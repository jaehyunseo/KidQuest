import { useEffect, useState } from 'react';
import {
  deleteFamilyWithCascade,
  fetchFamilyDetail,
  type FamilyDetail,
  getFamilyOwnerEmail,
  listAllFamilies,
} from '../../../lib/adminOps';
import type { Family } from '../../../types';
import { ConfirmDeleteModal } from '../ConfirmDeleteModal';
import { ReassignOwnerModal } from '../ReassignOwnerModal';

export function FamiliesTab() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [ownerEmails, setOwnerEmails] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<Record<string, FamilyDetail>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [target, setTarget] = useState<Family | null>(null);
  const [reassignTarget, setReassignTarget] = useState<Family | null>(null);

  const reload = async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await listAllFamilies();
      setFamilies(list);

      const emails: Record<string, string> = {};
      const detailMap: Record<string, FamilyDetail> = {};
      await Promise.all(
        list.map(async (f) => {
          if (f.ownerUid) {
            const e = await getFamilyOwnerEmail(f.ownerUid);
            if (e) emails[f.ownerUid] = e;
          }
          try {
            detailMap[f.id] = await fetchFamilyDetail(f.id);
          } catch (err) {
            console.warn(`[FamiliesTab] detail fetch failed ${f.id}:`, err);
          }
        })
      );
      setOwnerEmails(emails);
      setDetails(detailMap);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  if (loading) return <div className="p-6 text-gray-500">로딩 중…</div>;
  if (err) return <div className="p-6 text-red-600">오류: {err}</div>;

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600">
          총 {families.length}개 가족 (최대 500개 조회)
        </div>
        <button
          onClick={reload}
          className="text-xs px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          새로고침
        </button>
      </div>

      <div className="space-y-2">
        {families.map((f) => {
          const detail = details[f.id];
          const isExpanded = expandedId === f.id;
          const ownerEmail = f.ownerUid
            ? ownerEmails[f.ownerUid] ?? `(유실: ${f.ownerUid.slice(0, 8)})`
            : '⚠ 레거시 (없음)';
          const parentCount = Object.values(f.members ?? {}).filter(
            (r) => r === 'parent'
          ).length;
          const childMemberCount = Object.values(f.members ?? {}).filter(
            (r) => r === 'child'
          ).length;

          return (
            <div
              key={f.id}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden"
            >
              {/* Header row */}
              <div className="flex items-center gap-3 p-3">
                <button
                  onClick={() => toggleExpand(f.id)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500"
                  aria-label="펼치기"
                >
                  {isExpanded ? '▼' : '▶'}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-bold text-gray-900">
                      {f.name ?? '(이름 없음)'}
                    </span>
                    <span className="text-xs font-mono text-gray-400">
                      {f.id}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    👑 {ownerEmail}
                    <span className="mx-2 text-gray-300">·</span>
                    부모 {parentCount}
                    {childMemberCount > 0 && (
                      <span>
                        {' '}
                        / Auth자녀 {childMemberCount}
                      </span>
                    )}
                    <span className="mx-2 text-gray-300">·</span>
                    자녀 {detail?.children.length ?? '…'}명
                    <span className="mx-2 text-gray-300">·</span>
                    퀘스트 {detail?.completedQuests ?? '…'}/{detail?.totalQuests ?? '…'}
                    <span className="mx-2 text-gray-300">·</span>
                    피드 {detail?.feedCount ?? '…'}
                  </div>
                </div>

                <div className="text-xs text-gray-400 hidden md:block">
                  {f.createdAt
                    ? new Date(f.createdAt).toLocaleDateString()
                    : '-'}
                </div>

                <button
                  onClick={() => setReassignTarget(f)}
                  className="text-xs px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                >
                  👑 소유자
                </button>
                <button
                  onClick={() => setTarget(f)}
                  className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                >
                  삭제
                </button>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
                  {/* Meta */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <Meta
                      label="초대 코드 (부모)"
                      value={f.parentInviteCode ?? '-'}
                    />
                    <Meta
                      label="초대 코드 (자녀)"
                      value={f.childInviteCode ?? '-'}
                    />
                    <Meta
                      label="생성일"
                      value={
                        f.createdAt
                          ? new Date(f.createdAt).toLocaleString()
                          : '-'
                      }
                    />
                    <Meta
                      label="ownerUid"
                      value={f.ownerUid ?? '(없음)'}
                      mono
                    />
                  </div>

                  {/* Members breakdown */}
                  <div>
                    <div className="text-xs font-bold text-gray-600 mb-1">
                      멤버 ({Object.keys(f.members ?? {}).length})
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(f.members ?? {})
                        .sort(([a], [b]) => {
                          // 1. Owner first
                          if (a === f.ownerUid) return -1;
                          if (b === f.ownerUid) return 1;
                          // 2. parents before children
                          const ra = (f.members ?? {})[a];
                          const rb = (f.members ?? {})[b];
                          if (ra !== rb) return ra === 'parent' ? -1 : 1;
                          // 3. by name
                          const na = f.memberNames?.[a] ?? a;
                          const nb = f.memberNames?.[b] ?? b;
                          return na.localeCompare(nb);
                        })
                        .map(([uid, role]) => (
                          <div
                            key={uid}
                            className={`px-2 py-1 rounded-full text-xs ${
                              uid === f.ownerUid
                                ? 'bg-amber-100 text-amber-800 font-semibold'
                                : role === 'parent'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-pink-100 text-pink-700'
                            }`}
                          >
                            {uid === f.ownerUid && '👑 '}
                            {f.memberNames?.[uid] ?? uid.slice(0, 8)} ·{' '}
                            {uid === f.ownerUid ? '마스터' : role}
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* ChildProfiles */}
                  <div>
                    <div className="text-xs font-bold text-gray-600 mb-1">
                      자녀 프로필 ({detail?.children.length ?? 0})
                    </div>
                    {detail && detail.children.length > 0 ? (
                      <div className="flex gap-2 flex-wrap">
                        {detail.children.map((c) => (
                          <div
                            key={c.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-pink-200 text-xs"
                          >
                            <span>{c.avatar ?? '🧒'}</span>
                            <span className="font-semibold">{c.name}</span>
                            {c.level != null && (
                              <span className="text-pink-600">
                                Lv.{c.level}
                              </span>
                            )}
                            {c.totalPoints != null && (
                              <span className="text-gray-500">
                                {c.totalPoints}p
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">없음</div>
                    )}
                  </div>

                  {/* Content counts */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat
                      label="보상 카탈로그"
                      value={detail?.rewardCount ?? 0}
                    />
                    <Stat
                      label="카테고리"
                      value={detail?.categoryCount ?? 0}
                    />
                    <Stat label="피드 포스트" value={detail?.feedCount ?? 0} />
                    <Stat
                      label="퀘스트 완료율"
                      value={
                        detail && detail.totalQuests > 0
                          ? `${Math.round((detail.completedQuests / detail.totalQuests) * 100)}%`
                          : '-'
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {families.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-400">
            가족이 없습니다
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        open={!!target}
        title="가족 영구 삭제"
        description={`${target?.name ?? target?.id} 및 모든 하위 데이터가 삭제됩니다.`}
        confirmText={target?.id ?? ''}
        cascadeItems={[
          '자녀 프로필 + 모든 퀘스트/히스토리/업적',
          '피드 포스트 + 댓글',
          '카테고리, 보상',
          '부모 비밀번호 설정',
        ]}
        warning="이 작업은 되돌릴 수 없습니다. Firebase Auth 계정은 유지됩니다."
        onConfirm={async () => {
          if (!target) return;
          await deleteFamilyWithCascade(target.id);
          await reload();
        }}
        onClose={() => setTarget(null)}
      />

      <ReassignOwnerModal
        open={!!reassignTarget}
        family={reassignTarget}
        onClose={() => setReassignTarget(null)}
        onDone={reload}
      />
    </div>
  );
}

function Meta({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase text-gray-400 font-semibold">
        {label}
      </div>
      <div
        className={`text-xs text-gray-700 break-all ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-white border border-gray-200 p-2">
      <div className="text-[10px] uppercase text-gray-400 font-semibold">
        {label}
      </div>
      <div className="text-lg font-bold text-gray-800">{value}</div>
    </div>
  );
}
