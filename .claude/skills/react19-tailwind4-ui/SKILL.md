---
name: react19-tailwind4-ui
description: KidQuest의 React 19 + Tailwind v4 + Framer Motion + lucide-react 컴포넌트 패턴. 아이 친화적 애니메이션, 색상 시스템, confetti 피드백. UI 컴포넌트 추가/수정 시 사용.
---

# React 19 + Tailwind v4 UI 패턴

## 환경
- **React 19** — `useOptimistic`, `use()`, ref as prop 지원
- **Tailwind v4** — `@tailwindcss/vite` 플러그인. CSS-first 설정, `@theme` 블록 in [src/index.css](src/index.css)
- **유틸**: [src/lib/utils.ts](src/lib/utils.ts)의 `cn()` 헬퍼 (clsx + tailwind-merge)

## 디자인 토큰 (현재 App.tsx에서 반복 사용)
| 용도 | 값 |
|---|---|
| 배경 | `bg-[#FDFCF0]` (크림색) |
| 프라이머리 | `yellow-400`, `yellow-500` |
| 카테고리 색 | [src/types.ts:80](src/types.ts#L80) `CATEGORY_COLORS` 사용 |
| 둥근 모서리 | `rounded-2xl`, `rounded-3xl` (아이 친화적) |
| 그림자 | `shadow-lg`, `shadow-xl` |

## 카테고리 아이콘
[src/App.tsx:1801](src/App.tsx#L1801)의 `getCategoryIcon()`에 중앙화. 신규 카테고리 추가 시 이 함수와 [src/types.ts](src/types.ts)의 `CATEGORY_COLORS` / `CATEGORY_LABELS` 세 곳을 동기화.

## Framer Motion 패턴
```tsx
import { motion, AnimatePresence } from 'motion/react';

// 리스트 아이템 등장/퇴장
<AnimatePresence>
  {quests.map(q => (
    <motion.div
      key={q.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
```

스프링 애니메이션이 아이 친화적 — `ease` 선형보다 `spring` 우선.

## Confetti 성공 피드백
퀘스트 완료/보상 구매 시:
```ts
import confetti from 'canvas-confetti';
confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
```
+ `playSound()` ([src/App.tsx:52](src/App.tsx#L52))로 효과음 동반.

## 컴포넌트 작성 원칙
1. **Props 타입은 inline** — 현재 [src/App.tsx](src/App.tsx) 스타일. 별도 `.types.ts` 분리는 리팩터 후 고려
2. **`cn()` 사용** — 조건부 클래스 병합 시 항상 `cn()`, 생 `clsx` 금지 (Tailwind 충돌 방지)
3. **lucide-react 아이콘** — `import { Star, Trophy } from 'lucide-react'`. 크기는 `size` prop
4. **접근성** — 버튼은 `aria-label`, 애니메이션은 `prefers-reduced-motion` 존중 (아이 기기 배려)
5. **터치 타겟** — 최소 `min-h-[44px]` (어린이 손가락)

## React 19 활용처
- **`useOptimistic`** — 퀘스트 완료 낙관적 업데이트 (Firestore 왕복 대기 없이)
- **`useTransition`** — Gemini API 호출 같은 느린 작업
- **ref as prop** — `forwardRef` 불필요

## 폼 패턴
현재 `useState` + 제어 컴포넌트. React 19 `<form action>` 도입은 리팩터 시 고려.
