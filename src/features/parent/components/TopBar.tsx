import { Settings, LogOut, Home } from 'lucide-react';

interface TopBarProps {
  familyName: string;
  onOpenSettings: () => void;
  onExit: () => void;
}

export function TopBar({ familyName, onOpenSettings, onExit }: TopBarProps) {
  return (
    <div className="sticky top-0 z-30 py-3 px-3 sm:px-4 bg-[#FDFCF0]/95 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between gap-2 shadow-sm">
      <button
        onClick={onExit}
        className="flex items-center gap-1.5 px-2.5 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-xs transition-all active:scale-95 border border-slate-200 shadow-sm shrink-0"
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">부모 모드 나가기</span>
        <span className="sm:hidden">나가기</span>
      </button>

      <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
        <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 shrink-0">
          <Home size={14} />
        </div>
        <div className="text-sm font-black text-slate-800 truncate">
          {familyName}
        </div>
      </div>

      <button
        onClick={onOpenSettings}
        className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all active:scale-95 shadow-sm shrink-0"
      >
        <Settings size={16} />
        <span className="hidden sm:inline">설정</span>
      </button>
    </div>
  );
}
