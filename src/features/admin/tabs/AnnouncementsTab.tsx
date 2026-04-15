import { useEffect, useState } from 'react';
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
} from '../../../lib/adminOps';
import type { Announcement, AnnouncementSeverity } from '../../../types';

export function AnnouncementsTab() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<AnnouncementSeverity>('info');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reload = async () => {
    setLoading(true);
    setErr(null);
    try {
      setList(await listAnnouncements());
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleCreate = async () => {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      await createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        severity,
        expiresAt: expiresAt
          ? new Date(expiresAt).toISOString()
          : undefined,
      });
      setTitle('');
      setBody('');
      setExpiresAt('');
      setSeverity('info');
      await reload();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 공지사항을 삭제하시겠습니까?')) return;
    await deleteAnnouncement(id);
    await reload();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="text-sm font-semibold text-gray-700">새 공지사항</div>
        <input
          type="text"
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <textarea
          placeholder="본문"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <div className="flex gap-3 flex-wrap items-center">
          <label className="text-sm">
            심각도:
            <select
              value={severity}
              onChange={(e) =>
                setSeverity(e.target.value as AnnouncementSeverity)
              }
              className="ml-2 px-2 py-1 border border-gray-300 rounded"
            >
              <option value="info">정보</option>
              <option value="warn">경고</option>
            </select>
          </label>
          <label className="text-sm">
            만료일(선택):
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="ml-2 px-2 py-1 border border-gray-300 rounded"
            />
          </label>
          <button
            onClick={handleCreate}
            disabled={submitting || !title.trim() || !body.trim()}
            className="ml-auto px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40"
          >
            {submitting ? '전송 중…' : '공지 전송'}
          </button>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-gray-700 mb-2">
          현재 공지 ({list.length})
        </div>
        {loading && <div className="text-gray-500">로딩 중…</div>}
        {err && <div className="text-red-600">{err}</div>}
        <div className="space-y-2">
          {list.map((a) => (
            <div
              key={a.id}
              className={`rounded-lg border p-3 ${
                a.severity === 'warn'
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-sm text-gray-700 mt-1">{a.body}</div>
                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(a.createdAt).toLocaleString()}
                    {a.expiresAt &&
                      ` • 만료: ${new Date(a.expiresAt).toLocaleDateString()}`}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
          {list.length === 0 && !loading && (
            <div className="text-sm text-gray-400 p-4 text-center">
              공지사항이 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
