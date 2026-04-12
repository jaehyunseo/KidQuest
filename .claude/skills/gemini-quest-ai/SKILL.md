---
name: gemini-quest-ai
description: KidQuest의 @google/genai (Gemini) 통합 패턴. 격려 메시지, 퀘스트 추천, 프롬프트 설계, API 키 관리, 에러 처리. AI 기능 추가/수정 시 사용.
---

# Gemini AI 통합 가이드

## 현재 사용처
[src/App.tsx:543](src/App.tsx#L543) `generateEncouragement()` — 자녀가 완료한 퀘스트 목록을 기반으로 격려 한 문장 생성.

## 기본 패턴
```ts
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('GEMINI_API_KEY is not defined');
  return;
}

const ai = new GoogleGenAI({ apiKey });
const response = await ai.models.generateContent({
  model: "gemini-flash-latest",
  contents: prompt,
});
const text = response.text || '<fallback>';
```

## 모델 선택
- **`gemini-flash-latest`** — 기본. 격려 메시지, 간단 추천. 빠르고 저렴
- **`gemini-pro-latest`** — 복잡한 추천/긴 컨텍스트가 필요할 때만

## 프롬프트 원칙 (아이 대상)
1. **페르소나 명시** — "다정한 선생님", "친구 같은 코치"
2. **한국어 + 이모티콘** — 명시적으로 요청 ("이모티콘도 섞어서")
3. **길이 제한** — "한 문장으로", "30자 이내"
4. **톤** — 칭찬/응원/도전 격려. 부정/비판/비교 금지
5. **컨텍스트 주입** — 완료한 퀘스트 제목, 포인트, 레벨
6. **Fallback** — 실패 시 기본 문구 준비 (네트워크/API 에러 대비)

## 예시 프롬프트
```ts
// 격려 (현재 구현)
`당신은 아이들을 격려하는 다정한 선생님입니다. 아이가 오늘 완료한 일들(${list})을 보고
아이에게 칭찬과 응원의 메시지를 한 문장으로 아주 재미있고 따뜻하게 해주세요. 이모티콘도 섞어서요.`

// 퀘스트 추천
`당신은 아이의 습관 형성을 돕는 코치입니다. ${age}세 아이에게 추천할 ${category} 카테고리의
퀘스트 3개를 JSON 배열로 주세요. 형식: [{"title": "...", "points": 10-50}]. 한국어로.`
```

## JSON 출력
구조화된 응답이 필요하면 `responseMimeType: "application/json"` + `responseSchema` 사용:
```ts
const response = await ai.models.generateContent({
  model: "gemini-flash-latest",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: { type: "array", items: { ... } }
  }
});
```

## 에러 처리
- **항상 try/catch** — 네트워크/쿼터/키 누락 모두 처리
- **사용자에게는 긍정 fallback** — "오늘도 너의 도전을 응원해! 화이팅! 🌟" 같은 기본 문구
- **로그**: `error.response`가 있으면 상세 출력

## API 키 관리
- [.env.local](.env.local) — `GEMINI_API_KEY=...`
- [vite.config.ts](vite.config.ts)에서 `process.env.GEMINI_API_KEY`로 define
- **주의**: Vite `define`으로 클라이언트 번들에 포함됨 → Gemini API는 도메인 제한 없으므로 **유출 시 쿼터 탈취 위험**
- **권장 개선**: Firebase Functions/Cloud Run 프록시 경유로 서버 측 호출

## 새 AI 기능 추가 체크리스트
1. 프롬프트 초안 → 한국어 + 아이 친화적 톤 (see `korean-kid-copy` skill)
2. API 키 체크 → 없으면 UI 숨기기, 깨지지 않기
3. `useTransition` or `isLoading` state로 로딩 UI
4. Fallback 문구 준비
5. 호출 빈도 제한 — 탭 전환/리렌더 시 불필요 호출 방지 (현재 `useEffect([])`로 1회만)
