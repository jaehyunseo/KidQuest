import { Plus } from 'lucide-react';
import type { ChildProfile, Quest } from '../../../types';
import { cn } from '../../../lib/utils';

interface ChildRailProps {
  childrenList: ChildProfile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenAddChild: () => void;
  selectedChildQuests: Quest[];
}

export function ChildRail({
  childrenList,
  selectedId,
  onSelect,
  onOpenAddChild,
  selectedChildQuests,
}: ChildRailProps) {
  const completedCount = selectedChildQuests.filter((q) => q.completed).length;
  const totalCount = selectedChildQuests.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <>
      {/* Mobile: horizontal chip row */}
      <div className="lg:hidden flex gap-3 overflow-x-auto py-3 -mx-6 px-6 scrollbar-hide">
        {childrenList.map((c) => {
          const isSelected = c.id === selectedId;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                'flex-shrink-0 flex flex-col items-center justify-center gap-1 w-20 h-24 rounded-2xl transition-all active:scale-95',
                isSelected
                  ? 'bg-blue-50 border-2 border-blue-500 shadow-md shadow-blue-100'
                  : 'bg-white border-2 border-slate-200'
              )}
            >
              <span className="text-3xl">{c.avatar}</span>
              <span
                className={cn(
                  'text-[10px] font-black truncate max-w-[70px]',
                  isSelected ? 'text-blue-700' : 'text-slate-600'
                )}
              >
                {c.name}
              </span>
              <span className="text-[9px] font-bold text-slate-400">Lv.{c.level || 1}</span>
            </button>
          );
        })}
        <button
          onClick={onOpenAddChild}
          className="flex-shrink-0 w-20 h-24 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Desktop: left rail */}
      <aside className="hidden lg:block">
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sticky top-20">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-3">
            자녀 목록
          </h3>
          <div className="space-y-2">
            {childrenList.map((c) => {
              const isSelected = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-2xl transition-all active:scale-[0.98] text-left',
                    isSelected
                      ? 'bg-blue-50 border-2 border-blue-500 shadow-md shadow-blue-100/50'
                      : 'border-2 border-transparent hover:bg-slate-50'
                  )}
                >
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0',
                      isSelected ? 'bg-white shadow-inner' : 'bg-slate-50'
                    )}
                  >
                    {c.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'font-black text-sm truncate',
                        isSelected ? 'text-blue-700' : 'text-slate-700'
                      )}
                    >
                      {c.name}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400">
                      Lv.{c.level || 1} · {(c.totalPoints || 0).toLocaleString()}P
                    </p>
                    {isSelected && totalCount > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-black text-slate-500 tabular-nums">
                          {completedCount}/{totalCount}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <button
            onClick={onOpenAddChild}
            className="mt-3 w-full flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-colors text-xs font-bold"
          >
            <Plus size={16} /> 자녀 추가
          </button>
        </div>
      </aside>
    </>
  );
}
