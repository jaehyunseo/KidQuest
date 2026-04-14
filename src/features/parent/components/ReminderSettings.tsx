import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import {
  DEFAULT_REMINDERS,
  canNotify,
  loadReminderSettings,
  requestNotificationPermission,
  saveReminderSettings,
  type ReminderSettings as ReminderSettingsType,
} from '../../../lib/reminders';
import { cn } from '../../../lib/utils';

interface ReminderSettingsProps {
  showAlert: (title: string, message: string) => void;
  onChange?: () => void;
}

export function ReminderSettings({ showAlert, onChange }: ReminderSettingsProps) {
  const [settings, setSettings] = useState<ReminderSettingsType>(DEFAULT_REMINDERS);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  useEffect(() => {
    setSettings(loadReminderSettings());
  }, []);

  const persist = (next: ReminderSettingsType) => {
    setSettings(next);
    saveReminderSettings(next);
    onChange?.();
  };

  const handleToggle = async () => {
    if (!settings.enabled) {
      if (!('Notification' in window)) {
        showAlert('알림 미지원', '이 브라우저는 알림을 지원하지 않아요.');
        return;
      }
      const granted = await requestNotificationPermission();
      setPermission(Notification.permission);
      if (!granted) {
        showAlert(
          '알림 권한 필요',
          '알림을 받으려면 브라우저 설정에서 이 사이트의 알림을 허용해주세요.'
        );
        return;
      }
      persist({ ...settings, enabled: true });
    } else {
      persist({ ...settings, enabled: false });
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
      <p className="text-[10px] font-bold text-slate-400">
        아이의 미션 체크를 잊지 않도록 매일 아침과 저녁에 알림을 보내드려요.
        <br />
        <span className="text-slate-400">* 현재 브라우저 탭이 열려있을 때만 작동해요.</span>
      </p>

      <button
        onClick={handleToggle}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 rounded-xl font-black text-sm transition-all',
          settings.enabled
            ? 'bg-yellow-400 text-slate-900 shadow-md shadow-yellow-100'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        )}
      >
        <span className="flex items-center gap-2">
          {settings.enabled ? <Bell size={16} /> : <BellOff size={16} />}
          매일 알림 {settings.enabled ? '켜짐' : '꺼짐'}
        </span>
        <div
          className={cn(
            'w-10 h-6 rounded-full p-0.5 transition-all',
            settings.enabled ? 'bg-slate-900' : 'bg-slate-300'
          )}
        >
          <div
            className={cn(
              'w-5 h-5 bg-white rounded-full transition-all',
              settings.enabled && 'translate-x-4'
            )}
          />
        </div>
      </button>

      {settings.enabled && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              아침 알림
            </label>
            <select
              value={settings.morningHour}
              onChange={(e) =>
                persist({ ...settings, morningHour: Number(e.target.value) })
              }
              className="mt-1 w-full border-2 border-slate-100 rounded-xl px-3 py-2 outline-none focus:border-yellow-400 bg-slate-50/50 font-bold text-sm"
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {h.toString().padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              저녁 알림
            </label>
            <select
              value={settings.eveningHour}
              onChange={(e) =>
                persist({ ...settings, eveningHour: Number(e.target.value) })
              }
              className="mt-1 w-full border-2 border-slate-100 rounded-xl px-3 py-2 outline-none focus:border-yellow-400 bg-slate-50/50 font-bold text-sm"
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {h.toString().padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {permission === 'denied' && (
        <p className="text-[10px] font-bold text-red-500 bg-red-50 p-2 rounded-lg">
          알림이 차단되어 있어요. 브라우저 주소창 옆의 자물쇠 아이콘에서 알림 권한을
          허용해주세요.
        </p>
      )}
    </div>
  );
}
