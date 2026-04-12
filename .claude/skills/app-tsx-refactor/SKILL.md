---
name: app-tsx-refactor
description: 1943줄 단일 App.tsx를 feature 단위로 분할하는 전략. 파일 이동 매핑, 의존성 추출 순서, 안전한 단계적 리팩터. App.tsx를 분할/정리할 때 사용.
---

# App.tsx 리팩터 플랜

## 현재 상태
[src/App.tsx](src/App.tsx) 1943줄 단일 파일에 모든 컴포넌트 + 로직 집중.

## 목표 구조
```
src/
├── App.tsx                    # 100줄 이하, 라우팅/최상위 상태만
├── main.tsx
├── firebase.ts
├── types.ts
├── lib/
│   ├── utils.ts               # 기존 cn()
│   ├── sound.ts               # playSound()
│   └── gemini.ts              # generateEncouragement() 등 AI 헬퍼
├── hooks/
│   ├── useAuth.ts             # onAuthStateChanged + 사용자 문서 로드
│   ├── useFamily.ts           # 가족/멤버 구독
│   └── useQuests.ts           # quests 컬렉션 구독 + CRUD
├── features/
│   ├── auth/
│   │   └── FamilySetup.tsx    # L1810
│   ├── child/
│   │   ├── ChildDashboard.tsx # L949
│   │   ├── RewardShop.tsx     # L1071
│   │   ├── ProfileView.tsx    # L1126
│   │   └── CalendarView.tsx   # L1217
│   └── parent/
│       └── ParentDashboard.tsx# L1375
└── components/
    └── CategoryIcon.tsx       # L1801 getCategoryIcon → 컴포넌트화
```

## 단계적 리팩터 순서 (안전 → 위험)

### Phase 1 — 순수 유틸 추출 (위험도 최저)
1. `playSound` → [src/lib/sound.ts](src/lib/sound.ts)
2. `getCategoryIcon` → `src/components/CategoryIcon.tsx` (컴포넌트로 승격)
3. `generateEncouragement` → `src/lib/gemini.ts` (상태 주입 방식으로 순수화)

각 단계 후 `npm run lint` + `npm run dev`로 검증.

### Phase 2 — 커스텀 훅 추출
1. Auth 로직 → `useAuth()` — `{ user, account, loading }` 반환
2. 가족 구독 → `useFamily(familyId)` — `{ family, children }` 반환
3. 퀘스트 CRUD → `useQuests(familyId, childId)` — `{ quests, addQuest, completeQuest, deleteQuest }` 반환

**주의**: App.tsx 상태 중 어디서 set되는지 먼저 grep. `useEffect` 의존성 배열 누락 조심.

### Phase 3 — 컴포넌트 파일 이동
`ChildDashboard`부터 (의존성 가장 적음). 순서:
1. `RewardShop`, `ProfileView`, `CalendarView` (leaf 컴포넌트)
2. `ChildDashboard` (위 셋 import)
3. `ParentDashboard`
4. `FamilySetup`

각 파일로 이동 시 props 타입을 `interface XxxProps`로 승격.

### Phase 4 — App.tsx 슬림화
최종 App.tsx 구조:
```tsx
export default function App() {
  const { user, account, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen />;
  if (!account?.familyId) return <FamilySetup ... />;
  return account.role === 'parent'
    ? <ParentDashboard ... />
    : <ChildDashboard ... />;
}
```

## 리팩터 규칙
1. **한 번에 하나만** — 각 추출 후 커밋. 되돌리기 쉽게
2. **타입 먼저** — 이동 전 props 타입을 interface로 명시
3. **절대 로직 변경 금지** — 리팩터와 기능 수정 분리
4. **Playwright E2E** — Phase 2/3 후 `playwright-kid-flows` 스킬의 시나리오 실행
5. **의존성 순환 주의** — `features/child` ↔ `features/parent` 직접 import 금지. 공통은 `components/`로

## 금지사항
- Context API 도입 (현재 props drilling이 얕음 → 불필요한 추상화)
- 상태 관리 라이브러리 추가 (Zustand/Redux) — Firestore 실시간 구독으로 충분
- 한 번에 전체 파일 재작성 — 3천+ 줄 디프는 리뷰 불가능
