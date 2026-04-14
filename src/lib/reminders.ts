/**
 * Browser-native daily check-in reminders.
 *
 * NOTE: Without a backend push service (FCM), we cannot wake the device
 * when the app is closed. This module schedules an in-page timer that
 * fires a local Notification when the tab is open in the background.
 * For true background delivery, add FCM in a later round.
 */

const REMINDER_KEY = 'kidquest_reminder_settings';
const LAST_FIRED_KEY = 'kidquest_reminder_last_fired';

export interface ReminderSettings {
  enabled: boolean;
  morningHour: number;  // 0-23
  eveningHour: number;  // 0-23
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: false,
  morningHour: 8,
  eveningHour: 20,
};

export function loadReminderSettings(): ReminderSettings {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    if (!raw) return DEFAULT_REMINDERS;
    return { ...DEFAULT_REMINDERS, ...(JSON.parse(raw) as Partial<ReminderSettings>) };
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export function saveReminderSettings(settings: ReminderSettings) {
  try {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(settings));
  } catch {}
}

/** Ask the user to grant Notification permission. Returns true on grant. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function canNotify(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

function getLastFiredMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LAST_FIRED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function markFired(kind: 'morning' | 'evening') {
  const map = getLastFiredMap();
  const today = new Date().toISOString().slice(0, 10);
  map[kind] = today;
  localStorage.setItem(LAST_FIRED_KEY, JSON.stringify(map));
}

function alreadyFiredToday(kind: 'morning' | 'evening'): boolean {
  const map = getLastFiredMap();
  const today = new Date().toISOString().slice(0, 10);
  return map[kind] === today;
}

/**
 * Call once on app mount. Returns a cleanup function.
 * Every minute it checks if the current hour matches morning/evening
 * and fires a local notification once per day per slot.
 */
export function startReminderLoop(
  getSettings: () => ReminderSettings,
  getMessage: (kind: 'morning' | 'evening') => { title: string; body: string }
): () => void {
  const check = () => {
    const settings = getSettings();
    if (!settings.enabled || !canNotify()) return;
    const now = new Date();
    const hour = now.getHours();
    if (hour === settings.morningHour && !alreadyFiredToday('morning')) {
      const { title, body } = getMessage('morning');
      try {
        new Notification(title, { body, icon: '/favicon.svg', tag: 'kidquest-morning' });
        markFired('morning');
      } catch {}
    }
    if (hour === settings.eveningHour && !alreadyFiredToday('evening')) {
      const { title, body } = getMessage('evening');
      try {
        new Notification(title, { body, icon: '/favicon.svg', tag: 'kidquest-evening' });
        markFired('evening');
      } catch {}
    }
  };
  // Run immediately + every minute
  check();
  const interval = setInterval(check, 60 * 1000);
  return () => clearInterval(interval);
}
