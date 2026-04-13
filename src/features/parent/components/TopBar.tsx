import { Settings, LogOut, Home } from 'lucide-react';

interface TopBarProps {
  familyName: string;
  onOpenSettings: () => void;
  onExit: () => void;
}

export function TopBar({ familyName, onOpenSettings, onExit }: TopBarProps) {
  return (
    <div className="sticky top-0 z-30 -mx-6 px-6 py-3 bg-[#FDFCF0]/90 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between shadow-sm">
      <button
        onClick={onExit}
        className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-xs transition-all active:scale-95 border border-slate-200 shadow-sm"
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">관리 모드 나가기</span>
        <span className="sm:hidden">나가기</span>
      </button>

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
          <Home size={16} />
        </div>
        <div className="text-sm font-black text-slate-800 truncate max-w-[160px]">
          {familyName}
        </div>
      </div>

      <button
        onClick={onOpenSettings}
        className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all active:scale-95 shadow-sm"
      >
        <Settings size={16} />
        <span className="hidden sm:inline">설정</span>
      </button>
    </div>
  );
}
