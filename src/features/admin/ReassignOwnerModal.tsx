import { useEffect, useState } from 'react';
import { listAllUsers, reassignFamilyOwner } from '../../lib/adminOps';
import type { Family, UserAccount } from '../../types';

interface Props {
  open: boolean;
  family: Family | null;
  onClose: () => void;
  onDone: () => void;
}

export function ReassignOwnerModal({ open, family, onClose, onDone }: Props) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [targetUid, setTargetUid] = useState('');
  const [keepOld, setKeepOld] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setTargetUid('');
    listAllUsers()
      .then(setUsers)
      .catch((e) => setErr(e?.message ?? String(e)));
  }, [open]);

  if (!open || !family) return null;

  const target = users.find((u) => u.uid === targetUid);
  const oldOwnerEmail =
    users.find((u) => u.uid === family.ownerUid)?.email ?? family.ownerUid;

  const handle = async () => {
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      await reassignFamilyOwner(
        family.id,
        target.uid,
        target.name || target.email,
        { keepOldOwnerAsParent: keepOld }
      );
      onDone();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border-2 border-indigo-500">
        <div className="p-5 border-b border-indigo-200 bg-indigo-50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-indigo-700">👑 소유자 이전</h2>
          <p className="text-sm text-indigo-600 mt-1">
            {family.name ?? family.id}
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-sm">
            <div className="text-xs font-semibold text-gray-600 mb-1">
              현재 소유자
            </div>
            <div className="px-3 py-2 rounded-lg bg-gray-100 font-mono text-xs break-all">
              {oldOwnerEmail}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              새 소유자 선택
            </label>
            <select
              value={targetUid}
              onChange={(e) => setTargetUid(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none"
            >
              <option value="">-- 사용자 선택 --</option>
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.email} ({u.name})
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={keepOld}
              onChange={(e) => setKeepOld(e.target.checked)}
            />
            이전 소유자를 <span className="font-semibold">parent 멤버</span>로 유지
          </label>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            이 작업은 <code className="px-1 bg-white rounded">families/{family.id}</code>의
            <br />• <code>ownerUid</code> 교체
            <br />• <code>members</code> / <code>memberNames</code> 업데이트
            <br />• 새 소유자의 <code>users/{'{uid}'}.familyId</code> 설정
            <br />
            하위 퀘스트/아이/히스토리 데이터는 그대로 유지됩니다.
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handle}
              disabled={!target || busy}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-40"
            >
              {busy ? '이전 중…' : '이전 실행'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
