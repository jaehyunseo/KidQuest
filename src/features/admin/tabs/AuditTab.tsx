import { useEffect, useState } from 'react';
import { listAuditLogs } from '../../../lib/adminOps';
import type { AdminAuditLog } from '../../../types';

export function AuditTab() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setErr(null);
    try {
      setLogs(await listAuditLogs(100));
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

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600">최근 100개 로그</div>
        <button
          onClick={reload}
          className="text-xs px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          새로고침
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">시각</th>
              <th className="px-3 py-2">관리자</th>
              <th className="px-3 py-2">액션</th>
              <th className="px-3 py-2">대상</th>
              <th className="px-3 py-2">메타</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-gray-100 align-top">
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  {new Date(l.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-xs">{l.actorEmail}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700">
                    {l.action}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs break-all">
                  {l.targetPath}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {l.meta ? JSON.stringify(l.meta) : '-'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  로그가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
