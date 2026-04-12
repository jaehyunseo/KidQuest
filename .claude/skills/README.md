# KidQuest Agent Skills

Claude Code가 이 프로젝트에서 작업할 때 사용하는 도메인 특화 스킬 모음.

## 스킬 목록

| 스킬 | 사용 시점 |
|---|---|
| [kidquest-architecture](kidquest-architecture/SKILL.md) | **진입점.** 모든 작업 전 먼저 참조 — 파일 지도, 데이터 모델, 흐름 |
| [firestore-family-rules](firestore-family-rules/SKILL.md) | Firestore 쿼리 작성, 스키마 확장, 보안 규칙 수정 |
| [react19-tailwind4-ui](react19-tailwind4-ui/SKILL.md) | UI 컴포넌트 추가/수정, 애니메이션, 디자인 토큰 |
| [gemini-quest-ai](gemini-quest-ai/SKILL.md) | Gemini AI 통합, 프롬프트 작성, 격려/추천 기능 |
| [app-tsx-refactor](app-tsx-refactor/SKILL.md) | 1943줄 App.tsx 단계적 분할 |
| [playwright-kid-flows](playwright-kid-flows/SKILL.md) | E2E 테스트 작성 — 로그인/퀘스트/보상 시나리오 |
| [korean-kid-copy](korean-kid-copy/SKILL.md) | 한국어 UI 카피 — 자녀 반말/부모 존댓말 톤 |

## 작업 유형별 조합

- **새 기능 추가** → `kidquest-architecture` + `react19-tailwind4-ui` + `korean-kid-copy` (+ 해당 도메인 스킬)
- **Firestore 스키마 확장** → `kidquest-architecture` + `firestore-family-rules`
- **AI 기능 추가** → `gemini-quest-ai` + `korean-kid-copy`
- **리팩터링** → `app-tsx-refactor` + `kidquest-architecture`
- **테스트 작성** → `playwright-kid-flows` + `kidquest-architecture`
