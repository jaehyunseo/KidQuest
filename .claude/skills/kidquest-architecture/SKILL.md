---
name: kidquest-architecture
description: KidQuest 프로젝트 전체 지도. 데이터 모델, 파일 구조, 인증/상태 흐름, 주요 컴포넌트 위치. 이 프로젝트에서 작업을 시작하기 전 반드시 먼저 읽는다.
---

# KidQuest 아키텍처 가이드

부모-자녀 가족 단위의 게임형 습관/숙제 투두 앱. 한국어 UI.

## 스택
- **Frontend**: React 19 + TypeScript + Vite 6
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`), `clsx`, `tailwind-merge`
- **Animation**: `motion` (Framer Motion), `canvas-confetti`
- **Icons**: `lucide-react`
- **Backend**: Firebase Auth (Google), Firestore
- **AI**: `@google/genai` (Gemini) — 격려 메시지/퀘스트 추천
- **PWA**: [public/sw.js](public/sw.js), [public/manifest.json](public/manifest.json)
- **E2E**: Playwright

## 주요 파일
| 경로 | 역할 |
|---|---|
| [src/App.tsx](src/App.tsx) | **모든 로직/UI가 여기 집중 (1943줄)** — 리팩터 대상. `app-tsx-refactor` 스킬 참조 |
| [src/types.ts](src/types.ts) | 도메인 타입 전체 (`Quest`, `Family`, `UserProfile`, `Reward`, `HistoryRecord`) |
| [src/firebase.ts](src/firebase.ts) | Firebase 초기화 (`auth`, `db`, `googleProvider`) |
| [src/main.tsx](src/main.tsx) | 진입점 |
| [src/lib/utils.ts](src/lib/utils.ts) | `cn()` 헬퍼 (clsx + tailwind-merge) |
| [firestore.rules](firestore.rules) | 권한 규칙 — `firestore-family-rules` 스킬 참조 |
| [firebase-applet-config.json](firebase-applet-config.json) | Firebase 설정 (firestoreDatabaseId 포함) |

## 도메인 모델 ([src/types.ts](src/types.ts))
- **UserAccount** — `uid`, `email`, `role: 'parent'|'child'`, `familyId`
- **Family** — `id`, `name`, `inviteCode`, `members: { uid: role }`
- **ChildProfile** — `id`, `name`, `avatar`, `totalPoints`, `level`, `inventory[]`
- **Quest** — `id`, `title`, `points`, `category: 'homework'|'chore'|'habit'|'other'`, `completed`, `completedAt?`
- **Reward** — `id`, `title`, `description`, `points`, `icon`
- **HistoryRecord** — `type?: 'quest'|'reward'`, `questId?`, `rewardId?`, `title`, `points`, `timestamp`

## App.tsx 내부 구성 (라인 단위 지도)
| 라인 | 컴포넌트/함수 | 역할 |
|---|---|---|
| ~52 | `playSound()` | 효과음 재생 |
| ~82 | `App()` | 루트 — Auth 상태, 가족 로드, 역할 라우팅 |
| ~543 | `generateEncouragement()` | Gemini API 호출 (격려 메시지) |
| ~949 | `ChildDashboard` | 자녀 메인 화면 |
| ~1071 | `RewardShop` | 포인트 교환 상점 |
| ~1126 | `ProfileView` | 프로필/인벤토리 |
| ~1217 | `CalendarView` | 히스토리 캘린더 |
| ~1375 | `ParentDashboard` | 부모 관리 화면 |
| ~1810 | `FamilySetup` | 가족 생성/참가 |

## 역할 기반 라우팅 흐름
1. `onAuthStateChanged` → `users/{uid}` 로드
2. `familyId` 없음 → `FamilySetup` 노출
3. `role === 'parent'` → `ParentDashboard`
4. `role === 'child'` → `ChildDashboard` → (`RewardShop` / `ProfileView` / `CalendarView`)

## 환경 변수
- `GEMINI_API_KEY` — `.env.local`. `vite.config.ts`에서 `process.env`로 노출 (클라이언트 번들에 포함되므로 퍼블릭 키 취급)

## 관련 스킬
- `firestore-family-rules` — Firestore 스키마/권한
- `react19-tailwind4-ui` — UI 컴포넌트 패턴
- `gemini-quest-ai` — Gemini 통합
- `app-tsx-refactor` — App.tsx 분할 전략
- `playwright-kid-flows` — E2E 시나리오
- `korean-kid-copy` — 한국어 카피 톤
