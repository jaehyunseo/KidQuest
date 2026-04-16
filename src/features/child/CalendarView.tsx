import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Gift, AlertTriangle, Sparkles, X, Lock, CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { type CustomCategory, type HistoryRecord, type Quest } from '../../types';
import { cn } from '../../lib/utils';
import { CategoryIcon } from '../../components/CategoryIcon';
import { resolveCategory } from '../../lib/categoryDisplay';
import { localDateKey } from '../../lib/achievements';

interface CalendarViewProps {
  history: HistoryRecord[];
  customCategories: CustomCategory[];
  dayKey: string;
  quests: Quest[];
  onRemoveRecord: (recordId: string) => void;
  onAddBackdated: (questId: string, dateKey: string) => void;
}

const EDIT_WINDOW_DAYS = 7;

export function CalendarView({
  history,
  customCategories,
  dayKey,
  quests,
  onRemoveRecord,
  onAddBackdated,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toDateString());

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const historyByDate = useMemo(() => {
    const map: Record<string, { count: number, earnedPoints: number, spentPoints: number, records: HistoryRecord[] }> = {};
    history.forEach(record => {
      const dateStr = new Date(record.timestamp).toDateString();
      if (!map[dateStr]) {
        map[dateStr] = { count: 0, earnedPoints: 0, spentPoints: 0, records: [] };
      }
      map[dateStr].count += 1;
      if (record.points > 0) {
        map[dateStr].earnedPoints += record.points;
      } else {
        map[dateStr].spentPoints += Math.abs(record.points);
      }
      map[dateStr].records.push(record);
    });
    return map;
  }, [history]);

  const selectedDayData = selectedDate ? historyByDate[selectedDate] : null;

  // Determine the dayKey (YYYY-MM-DD) of the selected calendar cell so we
  // can compare it against today + the 7-day edit window.
  const selectedKey = useMemo(
    () => (selectedDate ? localDateKey(new Date(selectedDate)) : null),
    [selectedDate],
  );
  const minEditableKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - EDIT_WINDOW_DAYS);
    return localDateKey(d);
  }, [dayKey]);
  const isFutureSelected = !!selectedKey && selectedKey > dayKey;
  const isPastSelected = !!selectedKey && selectedKey < dayKey;
  const isEditableSelected =
    !!selectedKey && selectedKey >= minEditableKey && selectedKey <= dayKey;
  const isPastEditable = isPastSelected && isEditableSelected;

  // Build the per-day quest checklist for past-date inspection.
  // For each existing quest in the collection, find any history record
  // for this quest on the selected date. If found → completed for that
  // day (with the record id so we can cancel it). Quest items without a
  // matching record are unchecked. The list is only shown for past dates
  // (today is edited via the mission list to avoid double-credit).
  const dayQuestChecklist = useMemo(() => {
    if (!selectedDate || !isPastSelected) return [];
    return quests
      .filter((q) => !!q.title)
      .map((q) => {
        const matched = history.find(
          (h) =>
            h.questId === q.id &&
            new Date(h.timestamp).toDateString() === selectedDate,
        );
        return { quest: q, recordId: matched?.id ?? null };
      });
  }, [selectedDate, isPastSelected, quests, history]);

  return (
    <div className="space-y-6 lg:h-full lg:flex lg:flex-col lg:min-h-0 lg:space-y-4">
      <div className="flex justify-between items-center lg:shrink-0">
        <h2 className="font-black text-2xl text-slate-800">나의 성장 일기</h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-slate-600">
            <ChevronLeft size={20} />
          </button>
          <span className="font-black text-slate-700 min-w-[100px] text-center">
            {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
          </span>
          <button onClick={nextMonth} className="p-2 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-slate-600">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm lg:shrink-0">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['일', '월', '화', '수', '목', '금', '토'].map(day => (
            <div key={day} className="text-center text-[10px] font-black text-slate-400 uppercase py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dateStr = date.toDateString();
            const data = historyByDate[dateStr];
            const isSelected = selectedDate === dateStr;
            const isToday = new Date().toDateString() === dateStr;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className={cn(
                  "aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all",
                  isSelected ? "bg-yellow-400 text-slate-900 shadow-lg shadow-yellow-100" : "hover:bg-slate-50",
                  isToday && !isSelected && "border-2 border-yellow-200"
                )}
              >
                <span className={cn("text-xs font-bold", isSelected ? "text-slate-900" : "text-slate-600")}>
                  {day}
                </span>
                {data && (
                  <div className="flex gap-0.5 mt-0.5">
                    {Array.from({ length: Math.min(data.count, 3) }).map((_, idx) => (
                      <div key={idx} className={cn("w-1 h-1 rounded-full", isSelected ? "bg-slate-900" : "bg-yellow-400")} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto scrollbar-hide lg:pr-1">
      <AnimatePresence mode="wait">
        {selectedDate && (
          <motion.div
            key={selectedDate}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-black text-slate-800">
                {new Date(selectedDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}의 기록
              </h3>
              {selectedDayData && (
                <div className="flex gap-2">
                  {selectedDayData.earnedPoints > 0 && (
                    <span className="text-xs font-bold text-orange-500">+{selectedDayData.earnedPoints}P 획득</span>
                  )}
                  {selectedDayData.spentPoints > 0 && (
                    <span className="text-xs font-bold text-blue-500">-{selectedDayData.spentPoints}P 사용</span>
                  )}
                </div>
              )}
            </div>

            {!isEditableSelected && !isFutureSelected && selectedKey && (
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2">
                <Lock size={12} />
                <span>7일이 지난 기록은 조회만 가능해요.</span>
              </div>
            )}
            {isFutureSelected && (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center">
                <p className="text-slate-400 text-sm font-medium">미래 날짜는 미리 등록할 수 없어요.</p>
              </div>
            )}

            {/* Past-day quest checklist — shows what was supposed to be
                done on the selected past day with each quest's completion
                state. Within 7 days the items are toggleable; outside the
                window they're read-only. */}
            {isPastSelected && dayQuestChecklist.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm text-slate-700">이 날의 미션</h4>
                  <span className="text-[10px] font-bold text-slate-400">
                    {dayQuestChecklist.filter((it) => it.recordId).length} / {dayQuestChecklist.length} 완료
                  </span>
                </div>
                <div className="space-y-2">
                  {dayQuestChecklist.map(({ quest, recordId }) => {
                    const cat = resolveCategory(quest.category, customCategories);
                    const isDone = !!recordId;
                    const interactive = isPastEditable;
                    return (
                      <button
                        key={quest.id}
                        type="button"
                        disabled={!interactive}
                        onClick={() => {
                          if (!interactive || !selectedKey) return;
                          if (isDone && recordId) {
                            onRemoveRecord(recordId);
                          } else {
                            onAddBackdated(quest.id, selectedKey);
                          }
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all',
                          isDone
                            ? 'bg-slate-50 border-slate-100'
                            : 'bg-white border-white shadow-sm',
                          interactive
                            ? 'hover:border-yellow-200 active:scale-[0.98] cursor-pointer'
                            : 'opacity-70 cursor-not-allowed',
                        )}
                      >
                        <div
                          className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                            isDone ? 'bg-slate-200 text-slate-400' : cat.color + ' text-white',
                          )}
                        >
                          <CategoryIcon
                            category={quest.category}
                            customCategories={customCategories}
                            size={18}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                              {cat.label}
                            </span>
                            <span className="text-xs font-bold text-orange-500">+{quest.points}P</span>
                          </div>
                          <h3
                            className={cn(
                              'font-bold text-slate-800 text-sm truncate',
                              isDone && 'line-through text-slate-400',
                            )}
                          >
                            {quest.title}
                          </h3>
                        </div>
                        <div
                          className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0',
                            isDone ? 'bg-green-500 text-white' : 'border-2 border-slate-200 text-slate-200',
                          )}
                        >
                          {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {!isFutureSelected && selectedDayData ? (
              <div className="space-y-2">
                {selectedDayData.records.map((record) => {
                  const isPenalty = record.type === 'penalty';
                  const isBonus = record.type === 'group-bonus';
                  const isReward = record.type === 'reward';
                  // Cancellation is allowed only within the 7-day window
                  // and never for shop purchases / parent penalties.
                  const canCancel =
                    isEditableSelected && !isReward && !isPenalty;
                  return (
                  <div
                    key={record.id}
                    className={cn(
                      'p-4 rounded-2xl border flex items-center justify-between',
                      isPenalty
                        ? 'bg-red-50 border-red-100'
                        : isBonus
                          ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-amber-200'
                          : 'bg-white border-slate-100',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {isReward ? (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-blue-500">
                          <Gift size={16} />
                        </div>
                      ) : isPenalty ? (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-red-500">
                          <AlertTriangle size={16} />
                        </div>
                      ) : isBonus ? (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-amber-500">
                          <Sparkles size={16} />
                        </div>
                      ) : (
                        (() => {
                          const cat = resolveCategory(record.category || 'other', customCategories);
                          return (
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", cat.color)}>
                              <CategoryIcon category={record.category || 'other'} size={16} customCategories={customCategories} />
                            </div>
                          );
                        })()
                      )}
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{record.title}</p>
                        <p className="text-[10px] font-bold text-slate-400">
                          {new Date(record.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                          {isPenalty && ' · 🔒 읽기전용 기록'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-xs font-black',
                          isPenalty
                            ? 'text-red-500'
                            : isReward
                              ? 'text-blue-500'
                              : isBonus
                                ? 'text-amber-600'
                                : 'text-orange-500',
                        )}
                      >
                        {record.points > 0 ? '+' : ''}{record.points}P
                      </span>
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => onRemoveRecord(record.id)}
                          aria-label={`${record.title} 기록 취소`}
                          className="w-7 h-7 rounded-full bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : !isFutureSelected ? (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center">
                <p className="text-slate-400 text-sm font-medium">이날은 기록이 없어요.</p>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
