import type { HistoryRecord } from '../types';

/**
 * Browser-side CSV export for a child's history. Produces a UTF-8 BOM
 * prefixed CSV so Korean characters render correctly in Excel.
 */
function escapeCell(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function historyToCsv(records: HistoryRecord[]): string {
  const headers = ['날짜', '시간', '유형', '제목', '카테고리', '포인트'];
  const rows = records
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((r) => {
      const d = new Date(r.timestamp);
      const date = d.toLocaleDateString('ko-KR');
      const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const type = r.type === 'reward' ? '보상 받기' : '미션 완료';
      return [date, time, type, r.title, r.category ?? '', r.points]
        .map(escapeCell)
        .join(',');
    });
  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

export function downloadHistoryCsv(records: HistoryRecord[], childName: string) {
  const csv = historyToCsv(records);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `KidQuest_${childName}_${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
