import { useEffect, useMemo, useState } from 'react';
import { listAllUsers } from '../../../lib/adminOps';
import type { UserAccount } from '../../../types';

export function ConsentTab() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(false);

  useEffect(() => {
    listAllUsers()
      .then(setUsers)
      .catch((e) => setErr(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!onlyMissing) return users;
    return users.filter((u) => !u.consentPrivacy || !u.consentTerms);
  }, [users, onlyMissing]);

  if (loading) return <div className="p-6 text-gray-500">로딩 중…</div>;
  if (err) return <div className="p-6 text-red-600">오류: {err}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600">
          {filtered.length} / {users.length} 사용자
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
          />
          동의 미완료만 보기
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">이메일</th>
              <th className="px-3 py-2">Privacy</th>
              <th className="px-3 py-2">Terms</th>
              <th className="px-3 py-2">Age (COPPA)</th>
              <th className="px-3 py-2">Marketing</th>
              <th className="px-3 py-2">Version</th>
              <th className="px-3 py-2">동의일</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.uid} className="border-t border-gray-100">
                <td className="px-3 py-2 text-xs">{u.email}</td>
                <td className="px-3 py-2">{u.consentPrivacy ? '✓' : '—'}</td>
                <td className="px-3 py-2">{u.consentTerms ? '✓' : '—'}</td>
                <td className="px-3 py-2">{u.consentAge ? '✓' : '—'}</td>
                <td className="px-3 py-2">{u.consentMarketing ? '✓' : '—'}</td>
                <td className="px-3 py-2 text-xs">{u.consentVersion ?? '-'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {u.consentedAt
                    ? new Date(u.consentedAt).toLocaleDateString()
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
