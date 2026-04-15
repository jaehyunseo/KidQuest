import { useEffect, useState } from 'react';
import {
  type AdminChildProfile,
  deleteUserDoc,
  listAllFamilies,
  listAllUsers,
  listChildrenOfFamily,
} from '../../../lib/adminOps';
import type { Family, UserAccount } from '../../../types';
import { ConfirmDeleteModal } from '../ConfirmDeleteModal';

interface Group {
  familyId: string | null;
  family: Family | null;
  parents: UserAccount[];
  children: AdminChildProfile[];
}

export function UsersTab() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [orphans, setOrphans] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [target, setTarget] = useState<UserAccount | null>(null);

  const reload = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [users, families] = await Promise.all([
        listAllUsers(),
        listAllFamilies(),
      ]);

      const famMap = new Map<string, Family>();
      families.forEach((f) => famMap.set(f.id, f));

      const byFamily = new Map<string, UserAccount[]>();
      const orphan: UserAccount[] = [];
      users.forEach((u) => {
        if (u.familyId && famMap.has(u.familyId)) {
          const arr = byFamily.get(u.familyId) ?? [];
          arr.push(u);
          byFamily.set(u.familyId, arr);
        } else {
          orphan.push(u);
        }
      });

      // Fetch child profiles for each family in parallel
      const childrenByFamily = new Map<string, AdminChildProfile[]>();
      await Promise.all(
        Array.from(byFamily.keys()).map(async (fid) => {
          childrenByFamily.set(fid, await listChildrenOfFamily(fid));
        })
      );

      // Also include families with zero parents (orphaned families)
      families.forEach((f) => {
        if (!byFamily.has(f.id)) byFamily.set(f.id, []);
        if (!childrenByFamily.has(f.id)) {
          // lazy fetch
        }
      });

      const sortedGroups: Group[] = Array.from(byFamily.entries())
        .map(([fid, parents]) => ({
          familyId: fid,
          family: famMap.get(fid) ?? null,
          parents,
          children: childrenByFamily.get(fid) ?? [],
        }))
        .sort((a, b) => {
          const an = a.family?.name ?? a.familyId ?? '';
          const bn = b.family?.name ?? b.familyId ?? '';
          return an.localeCompare(bn);
        });

      setGroups(sortedGroups);
      setOrphans(orphan);
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

  const totalUsers =
    orphans.length + groups.reduce((s, g) => s + g.parents.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          총 {totalUsers}명 • {groups.length}개 가족 • 미소속 {orphans.length}명
        </div>
        <button
          onClick={reload}
          className="text-xs px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          새로고침
        </button>
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
        💡 <b>참고</b>: 이 목록은 <b>Firebase Auth 계정(users 컬렉션)</b>만
        보여줍니다. 실제 자녀 데이터는{' '}
        <code className="px-1 bg-white rounded">
          families/{'{fid}'}/children
        </code>{' '}
        하위에 <code>ChildProfile</code>로 저장되며, Auth 계정이 아닙니다.
        <br />
        기본 역할은 <code>parent</code>입니다. <code>child</code> 역할은 child
        초대 코드로 가족에 join했을 때만 부여됩니다.
      </div>

      {groups.map((g) => (
        <div key={g.familyId ?? 'none'}>
          <FamilyGroup group={g} onDelete={(u) => setTarget(u)} />
        </div>
      ))}

      {orphans.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-base font-bold text-gray-700">
              🚶 가족 미소속
            </h3>
            <span className="text-xs text-gray-500">
              ({orphans.length}명)
            </span>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
            <UserTable users={orphans} onDelete={(u) => setTarget(u)} />
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        open={!!target}
        title="사용자 문서 삭제"
        description={`${target?.email} 의 users/{uid} 문서를 삭제합니다.`}
        confirmText={target?.email ?? ''}
        cascadeItems={['users/{uid} 문서만']}
        warning="Firebase Auth 계정은 삭제되지 않습니다 (Admin SDK 필요). 가족 데이터는 Families 탭에서 별도 삭제하세요."
        onConfirm={async () => {
          if (!target) return;
          await deleteUserDoc(target.uid);
          await reload();
        }}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}

interface FamilyGroupProps {
  group: Group;
  onDelete: (u: UserAccount) => void;
}

function FamilyGroup({ group, onDelete }: FamilyGroupProps) {
  const famName =
    group.family?.name ?? `(이름 없음 · ${group.familyId?.slice(0, 8)})`;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <h3 className="text-base font-bold text-gray-800">👨‍👩‍👧 {famName}</h3>
        <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
          {group.familyId}
        </span>
        <span className="text-xs text-gray-500">
          부모 {group.parents.length}명 · 자녀 {group.children.length}명
        </span>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <UserTable users={group.parents} onDelete={onDelete} ownerUid={group.family?.ownerUid} />
      </div>
      {group.children.length > 0 && (
        <div className="mt-2 ml-4 flex gap-2 flex-wrap">
          {group.children.map((c) => (
            <div
              key={c.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-50 border border-pink-200 text-xs"
            >
              <span>{c.avatar ?? '🧒'}</span>
              <span className="font-semibold">{c.name}</span>
              {c.level != null && (
                <span className="text-pink-600">Lv.{c.level}</span>
              )}
              {c.totalPoints != null && (
                <span className="text-gray-500">{c.totalPoints}p</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserTable({
  users,
  onDelete,
  ownerUid,
}: {
  users: UserAccount[];
  onDelete: (u: UserAccount) => void;
  ownerUid?: string;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
        <tr>
          <th className="px-3 py-2">이메일</th>
          <th className="px-3 py-2">이름</th>
          <th className="px-3 py-2">역할</th>
          <th className="px-3 py-2">동의</th>
          <th className="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => {
          const consentOk = !!(u.consentPrivacy && u.consentTerms);
          const isOwner = !!(ownerUid && u.uid === ownerUid);
          const displayRole = deriveDisplayRole(u, isOwner, !!ownerUid);
          return (
            <tr key={u.uid} className="border-t border-gray-100">
              <td className="px-3 py-2 text-xs">
                {isOwner && (
                  <span className="mr-1" title="가족 마스터">
                    👑
                  </span>
                )}
                {u.email}
              </td>
              <td className="px-3 py-2">{u.name}</td>
              <td className="px-3 py-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${displayRole.cls}`}
                >
                  {displayRole.label}
                </span>
              </td>
              <td className="px-3 py-2">
                {consentOk ? (
                  <span className="text-green-600 text-xs">✓</span>
                ) : (
                  <span className="text-amber-600 text-xs">미완료</span>
                )}
              </td>
              <td className="px-3 py-2">
                <button
                  onClick={() => onDelete(u)}
                  className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                >
                  삭제
                </button>
              </td>
            </tr>
          );
        })}
        {users.length === 0 && (
          <tr>
            <td colSpan={5} className="px-3 py-4 text-center text-gray-400 text-xs">
              이 가족에 등록된 Auth 부모가 없습니다
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function deriveDisplayRole(
  u: UserAccount,
  isOwner: boolean,
  insideFamilyGroup: boolean
): { label: string; cls: string } {
  if (u.role === 'admin') {
    return { label: '관리자', cls: 'bg-indigo-100 text-indigo-700' };
  }
  if (u.role === 'child') {
    return { label: '자녀(Auth)', cls: 'bg-pink-100 text-pink-700' };
  }
  // role === 'parent' branch
  if (insideFamilyGroup) {
    if (isOwner) {
      return { label: '가족 마스터', cls: 'bg-amber-100 text-amber-800' };
    }
    return { label: '가족 부모', cls: 'bg-blue-100 text-blue-700' };
  }
  // orphan parent — no family at all
  return { label: '미소속 parent', cls: 'bg-gray-100 text-gray-600' };
}
