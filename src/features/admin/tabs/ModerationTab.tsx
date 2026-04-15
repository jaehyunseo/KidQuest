import { useEffect, useState } from 'react';
import {
  deleteFeedPostAsAdmin,
  listAllFeedPosts,
  type FeedPostWithFamily,
} from '../../../lib/adminOps';

export function ModerationTab() {
  const [posts, setPosts] = useState<FeedPostWithFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setErr(null);
    try {
      setPosts(await listAllFeedPosts(50));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleDelete = async (p: FeedPostWithFamily) => {
    if (!confirm(`"${p.text.slice(0, 40)}..." 포스트를 삭제하시겠습니까?`)) return;
    try {
      await deleteFeedPostAsAdmin(p.familyId, p.id);
      await reload();
    } catch (e: any) {
      alert(`삭제 실패: ${e?.message ?? e}`);
    }
  };

  if (loading) return <div className="p-6 text-gray-500">로딩 중…</div>;
  if (err) return <div className="p-6 text-red-600">오류: {err}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600">최근 50개 포스트 (모든 가족)</div>
        <button
          onClick={reload}
          className="text-xs px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          새로고침
        </button>
      </div>
      <div className="space-y-2">
        {posts.map((p) => (
          <div
            key={`${p.familyId}_${p.id}`}
            className="rounded-lg border border-gray-200 bg-white p-3"
          >
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-mono">{p.familyId}</span>
                  <span>·</span>
                  <span>{p.authorAvatar} {p.authorName}</span>
                  <span>·</span>
                  <span>{new Date(p.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-sm mt-1 whitespace-pre-wrap break-words">
                  {p.text}
                </div>
                {p.imageUrl && (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="mt-2 max-h-40 rounded border border-gray-200"
                  />
                )}
              </div>
              <button
                onClick={() => handleDelete(p)}
                className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="text-sm text-gray-400 p-4 text-center">
            피드 포스트가 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
