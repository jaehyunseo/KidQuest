# KidQuest 수동 테스트 체크리스트

자동화된 테스트(`tsc + test:unit + test:scenario`)는 Firebase 인증을 통과하지 않는 플로우만 검증합니다. 아래 항목은 **실제 Google 계정으로 로그인 후** 브라우저에서 직접 확인해야 합니다.

## 🎯 Phase 1 회귀 테스트

### 1. 로그인 & 동의 플로우
- [ ] 로그아웃 상태에서 페이지 열기 → 로그인 화면 노출
- [ ] Google 로그인 팝업 표시 → 계정 선택 → 팝업 닫힘
- [ ] **법정대리인 동의 섹션** 표시 확인 (파란 박스)
  - [ ] "저는 이 앱에서 관리될 아이(들)의 법정대리인..." 체크박스
  - [ ] 이름 입력 필드 (2자 이상 필수)
  - [ ] 자녀 수 드롭다운 (1-5명)
- [ ] 이름을 1자만 입력 → "동의하고 시작하기" 버튼 비활성 유지
- [ ] 이름 2자 이상 + 체크박스 ON + 자녀 수 선택 → 버튼 활성화
- [ ] 동의 완료 후 메인 화면 진입
- [ ] Firestore 콘솔에서 `users/{uid}.guardianConsent` 필드 저장 확인

### 2. Pro 게이트 — 두 번째 자녀 등록
- [ ] 첫 자녀 등록 (정상 진행)
- [ ] 두 번째 자녀 등록 시도
- [ ] **Pro 업셀 모달** 표시 확인
  - [ ] 헤더: "두 명 이상 아이를 함께 관리하려면"
  - [ ] 연간 플랜 카드 (31% 할인 뱃지, ₩24,000)
  - [ ] 월간 플랜 카드 (₩2,900)
  - [ ] 프로모 코드 링크
- [ ] "연간" 클릭 → "결제 준비 중" alert 표시
- [ ] "월간" 클릭 → "결제 준비 중" alert 표시
- [ ] 모달 닫기 → 자녀 추가 취소됨 (첫 자녀만 유지)

### 3. Pro 게이트 — 프리미엄 아바타
- [ ] 프로필 화면 진입
- [ ] 카메라 버튼 클릭 → 아바타 피커 패널 표시
- [ ] Free 아바타 6개 (🦁🐼🦊🐰🐻🐯) 선택 가능
- [ ] Free 아바타 클릭 → 즉시 변경, 피커 닫힘
- [ ] Firestore 콘솔에서 `children/{id}.avatar` 업데이트 확인
- [ ] Pro 아바타 (🦄🐲🥷 등)에 잠금 아이콘 표시 확인
- [ ] 피커 헤더에 "프리미엄 잠금" 칩 표시 (noPro 상태)
- [ ] Pro 아바타 클릭 → Pro 업셀 모달 (`premium_avatar` reason)
- [ ] "✨ Pro로 모든 캐릭터 해제" 버튼 클릭 → 동일 업셀 모달

### 4. PWA 설치 플로우
**Chrome 데스크톱**:
- [ ] 프로필 화면에서 "앱으로 설치하기" 카드 노출
- [ ] `canInstall=true`이면 "지금 설치하기" 버튼 표시
- [ ] 버튼 클릭 → 브라우저 네이티브 설치 프롬프트
- [ ] 설치 후 카드 자동 숨김 확인 (`appinstalled` 이벤트)

**Android Chrome (실기기)**:
- [ ] `beforeinstallprompt` 이벤트 발생 → "지금 설치하기" 버튼
- [ ] 설치 → 홈 화면에 아이콘 생성
- [ ] 홈 화면 아이콘으로 실행 → standalone 모드로 열림
- [ ] 설치된 상태에서 재방문 시 설치 카드 숨김

**iOS Safari (실기기)**:
- [ ] `beforeinstallprompt`는 발생 안 함 → "지금 설치하기" 버튼 없음
- [ ] 대신 "사파리 공유 버튼(⎋) → 홈 화면에 추가" 가이드 표시
- [ ] 추가 후 홈 화면 아이콘으로 실행 → `navigator.standalone === true`

### 5. 가족 피드 권한 (Storage 강화 검증)
- [ ] 피드에 이미지 업로드 → 파일명이 `{uid}_{randomToken}.jpg` 패턴
- [ ] 다른 가족 계정으로 로그인 → 같은 `familyId` URL 접근 시 피드 자체가 안 보임
- [ ] Firestore 콘솔에서 피드 포스트의 `imageUrl` 필드 확인 → 브라우저에서 해당 URL 직접 열기 → 로드됨 (download URL 토큰 경로)
- [ ] 개발자도구 네트워크 탭에서 직접 `families/{id}/feed/xxx.jpg` 경로 fetch 시도 → 403 (storage 규칙 거부)

### 6. 포인트 음수 플로우 (이전 세션 회귀)
- [ ] 보상 구매로 잔액 0 만들기
- [ ] 어제 날짜 캘린더 → X 버튼 클릭 → 경고 confirm (⚠️ 마이너스)
- [ ] 확인 → 잔액이 음수로 표시
- [ ] lifetimeEarned는 그대로 (레벨 유지)

### 7. 규칙 변경 검증 (`firestore.rules`)
- [ ] 자녀 계정으로 로그인 → `children/{cid}.totalPoints`를 직접 SDK로 `999999`로 write 시도
  - → 필드는 화이트리스트에 있으므로 허용됨 (CAVEAT: 값 검증은 여전히 클라이언트 레벨)
- [ ] 자녀 계정으로 `children/{cid}.role = 'admin'` 같은 임의 필드 write 시도 → **규칙 거부** ✅
- [ ] `history` 컬렉션 update 시도 → **규칙 거부** (admin 전용) ✅
- [ ] `achievements` 서브컬렉션 write 시도 → **규칙 거부** (parent 전용) ✅
- [ ] 피드 포스트의 `reactions[다른uid]` 수정 시도 → **규칙 거부** ✅
- [ ] 자녀 초대코드로 가입한 사용자가 `families/{id}.members[uid] = 'parent'`로 write 시도 → **규칙 거부** (`child`만 허용) ✅

---

## 🔧 자동화 실행 순서

```bash
# 1. 정적 검증
npm run lint              # tsc --noEmit
npm run test:unit         # 53개 순수 함수 테스트

# 2. 빌드 + 시나리오
npm run build
npm run preview -- --port 5200 --host 127.0.0.1 &
SCENARIO_URL=http://127.0.0.1:5200 npm run test:scenario

# 3. 규칙 테스트 (Java 필요)
npm run test:rules        # firestore.rules
npm run test:storage      # storage.rules
```

`test:rules`/`test:storage`는 Firebase 에뮬레이터 + Java JDK 11+ 필요. 현재 개발 환경에 Java 미설치 시 배포 전 CI에서 실행.

---

## 📋 시나리오 테스트 커버리지 (자동)

| 영역 | 자동 | 수동 | 비고 |
|---|---|---|---|
| 랜딩 페이지 로드 | ✅ | — | Playwright |
| PWA manifest 필드 | ✅ | — | Playwright |
| iOS/Android 메타 태그 | ✅ | — | Playwright |
| PWA 아이콘 (3개) | ✅ | — | Playwright |
| Service Worker 등록 | ✅ | — | Playwright |
| 정적 페이지 (privacy/terms) | ✅ | — | Playwright |
| 한국어 copy 렌더링 | ✅ | — | Playwright |
| 콘솔 에러 부재 | ✅ | — | Playwright |
| Pro entitlement 로직 | ✅ | — | unit test |
| 프리미엄 카탈로그 게이팅 | ✅ | — | unit test |
| 과거 7일 window 검증 | ✅ | — | unit test |
| Google 로그인 플로우 | ❌ | ✅ | 실 계정 필요 |
| 동의 모달 동작 | ❌ | ✅ | 로그인 후 노출 |
| 두 번째 자녀 업셀 | ❌ | ✅ | 가족 상태 필요 |
| 아바타 피커 + 업셀 | ❌ | ✅ | 로그인 필요 |
| 설치 프롬프트 | ❌ | ✅ | 실제 기기 필요 |
| Firestore 규칙 거부 | ❌ | ✅ | 콘솔 또는 에뮬레이터 |
