// Premium content catalog. Kept as plain data so the PO can iterate
// on the store lineup without touching components. Each item carries
// a `premium` flag that `ProGate` uses to decide lock state.
//
// IMPORTANT: do NOT reference these lists by index from persisted
// data — use the string `id` so reordering/additions don't break
// users' saved selections.

export type PremiumItemKind = 'avatar' | 'skin' | 'badgeSkin' | 'theme';

export interface PremiumItem {
  id: string;
  kind: PremiumItemKind;
  label: string;
  // For avatars/skins: the emoji or icon key to render.
  // For badge skins: a visual token name (maps to a style preset).
  // For themes: the theme id consumed by tailwind variants.
  display: string;
  premium: boolean;
  // Optional marketing copy shown in the upsell modal preview.
  tagline?: string;
}

// ------------------------------------------------------------------
// Avatars — the emoji picker on the child/profile screens.
// Free users see the first 6; the rest are Pro-locked.
// ------------------------------------------------------------------
export const AVATAR_CATALOG: PremiumItem[] = [
  // Free tier — friendly starter set
  { id: 'lion',    kind: 'avatar', label: '사자',     display: '🦁', premium: false },
  { id: 'panda',   kind: 'avatar', label: '판다',     display: '🐼', premium: false },
  { id: 'fox',     kind: 'avatar', label: '여우',     display: '🦊', premium: false },
  { id: 'rabbit',  kind: 'avatar', label: '토끼',     display: '🐰', premium: false },
  { id: 'bear',    kind: 'avatar', label: '곰',       display: '🐻', premium: false },
  { id: 'tiger',   kind: 'avatar', label: '호랑이',   display: '🐯', premium: false },
  // Pro tier — character/fantasy pack
  { id: 'unicorn', kind: 'avatar', label: '유니콘',   display: '🦄', premium: true, tagline: '전설의 친구' },
  { id: 'dragon',  kind: 'avatar', label: '드래곤',   display: '🐲', premium: true, tagline: '용기의 상징' },
  { id: 'ninja',   kind: 'avatar', label: '닌자',     display: '🥷', premium: true, tagline: '은밀한 수련생' },
  { id: 'astro',   kind: 'avatar', label: '우주인',   display: '👨‍🚀', premium: true, tagline: '우주 탐험가' },
  { id: 'wizard',  kind: 'avatar', label: '마법사',   display: '🧙', premium: true, tagline: '지식의 수호자' },
  { id: 'princess',kind: 'avatar', label: '공주',     display: '👸', premium: true, tagline: '빛나는 리더' },
  { id: 'robot',   kind: 'avatar', label: '로봇',     display: '🤖', premium: true, tagline: '미래 친구' },
  { id: 'mermaid', kind: 'avatar', label: '인어',     display: '🧜', premium: true, tagline: '바다의 친구' },
  // Seasonal — rotates; locked for free users
  { id: 'ghost',   kind: 'avatar', label: '유령',     display: '👻', premium: true, tagline: '🎃 할로윈 한정' },
  { id: 'santa',   kind: 'avatar', label: '산타',     display: '🎅', premium: true, tagline: '🎄 겨울 한정' },
  { id: 'egg',     kind: 'avatar', label: '부활절',   display: '🐣', premium: true, tagline: '🐰 봄 한정' },
];

// ------------------------------------------------------------------
// Badge visual skins — applied to the achievement pills shown on
// the profile view. Catalog keys map to tailwind class presets in
// `src/components/BadgeSkin.tsx` (to be wired when we render skins).
// ------------------------------------------------------------------
export const BADGE_SKIN_CATALOG: PremiumItem[] = [
  { id: 'silver',    kind: 'badgeSkin', label: '실버',    display: 'silver',    premium: false },
  { id: 'gold',      kind: 'badgeSkin', label: '골드',    display: 'gold',      premium: false },
  { id: 'neon',      kind: 'badgeSkin', label: '네온',    display: 'neon',      premium: true, tagline: '빛나는 네온' },
  { id: 'rainbow',   kind: 'badgeSkin', label: '레인보우',display: 'rainbow',   premium: true, tagline: '7색 그라데이션' },
  { id: 'holo',      kind: 'badgeSkin', label: '홀로그램',display: 'holo',      premium: true, tagline: '홀로그램 시프트' },
  { id: 'crystal',   kind: 'badgeSkin', label: '크리스탈',display: 'crystal',   premium: true, tagline: '투명 유리 질감' },
];

// ------------------------------------------------------------------
// UI themes — color palettes applied at the root.
// ------------------------------------------------------------------
export const THEME_CATALOG: PremiumItem[] = [
  { id: 'sunny',    kind: 'theme', label: '햇살',   display: 'sunny',    premium: false },
  { id: 'pastel',   kind: 'theme', label: '파스텔', display: 'pastel',   premium: true,  tagline: '부드러운 파스텔' },
  { id: 'dark',     kind: 'theme', label: '다크',   display: 'dark',     premium: true,  tagline: '눈이 편안한 야간' },
  { id: 'neon',     kind: 'theme', label: '네온',   display: 'neon',     premium: true,  tagline: '화려한 네온' },
  { id: 'forest',   kind: 'theme', label: '숲',     display: 'forest',   premium: true,  tagline: '자연 속으로' },
];

// Helpers -----------------------------------------------------------

export function findAvatar(id: string): PremiumItem | undefined {
  return AVATAR_CATALOG.find((a) => a.id === id);
}

export function freeAvatars(): PremiumItem[] {
  return AVATAR_CATALOG.filter((a) => !a.premium);
}

export function premiumAvatars(): PremiumItem[] {
  return AVATAR_CATALOG.filter((a) => a.premium);
}

// Is this item permitted for the given Pro status?
export function isItemAllowed(item: PremiumItem, isPro: boolean): boolean {
  return !item.premium || isPro;
}
