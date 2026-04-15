import { useState } from 'react';

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;      // user must type this exact string
  cascadeItems?: string[];  // list of things that will be deleted
  warning?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmDeleteModal({
  open,
  title,
  description,
  confirmText,
  cascadeItems,
  warning,
  onConfirm,
  onClose,
}: Props) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const handleConfirm = async () => {
    if (typed !== confirmText) return;
    setBusy(true);
    setErr(null);
    try {
      await onConfirm();
      setTyped('');
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border-2 border-red-500">
        <div className="p-5 border-b border-red-200 bg-red-50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-red-700">⚠️ {title}</h2>
          <p className="text-sm text-red-600 mt-1">{description}</p>
        </div>
        <div className="p-5 space-y-4">
          {cascadeItems && cascadeItems.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
              <div className="font-semibold text-amber-800 mb-1">삭제될 데이터:</div>
              <ul className="list-disc list-inside text-amber-700 space-y-0.5">
                {cascadeItems.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </div>
          )}
          {warning && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-800">
              {warning}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              확인을 위해 <code className="px-1 bg-gray-100 rounded">{confirmText}</code>을(를) 입력하세요
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
              placeholder={confirmText}
              autoFocus
            />
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
              onClick={handleConfirm}
              disabled={typed !== confirmText || busy}
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? '삭제 중…' : '영구 삭제'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
