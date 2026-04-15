import { useState } from 'react';
import { auth } from '../../firebase';
import { OverviewTab } from './tabs/OverviewTab';
import { FamiliesTab } from './tabs/FamiliesTab';
import { UsersTab } from './tabs/UsersTab';
import { ConsentTab } from './tabs/ConsentTab';
import { AnnouncementsTab } from './tabs/AnnouncementsTab';
import { ModerationTab } from './tabs/ModerationTab';
import { AuditTab } from './tabs/AuditTab';

type TabKey =
  | 'overview'
  | 'families'
  | 'users'
  | 'consent'
  | 'announcements'
  | 'moderation'
  | 'audit';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: '개요' },
  { key: 'families', label: '가족' },
  { key: 'users', label: '사용자' },
  { key: 'consent', label: '동의' },
  { key: 'announcements', label: '공지' },
  { key: 'moderation', label: '모더레이션' },
  { key: 'audit', label: '감사 로그' },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState<TabKey>('overview');

  const goHome = () => {
    window.location.hash = '';
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="text-xl font-bold">🛡 KidQuest Admin</div>
          <div className="text-xs opacity-70">{auth.currentUser?.email}</div>
          <button
            onClick={goHome}
            className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20"
          >
            ← 앱으로 돌아가기
          </button>
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition ${
                tab === t.key
                  ? 'border-blue-400 text-white'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'families' && <FamiliesTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'consent' && <ConsentTab />}
        {tab === 'announcements' && <AnnouncementsTab />}
        {tab === 'moderation' && <ModerationTab />}
        {tab === 'audit' && <AuditTab />}
      </main>
    </div>
  );
}
