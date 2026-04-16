# KidQuest Android 출시 가이드

Phase 2 — Capacitor로 웹앱을 Android 네이티브 앱으로 패키징해 Google Play에 등록하는 절차입니다. 코드는 모두 준비되어 있고, 아래는 **본인 PC에서 직접 수행해야 하는** 환경 설정 + Play Console 작업입니다.

## 사전 요구사항

| 항목 | 상태 | 비고 |
|---|---|---|
| Node.js 18+ | ✅ 이미 설치 | npm 명령 정상 작동 중 |
| Capacitor 8.x | ✅ 설치됨 | `package.json` |
| `android/` 폴더 | ✅ 생성됨 | `npx cap add android` 완료 |
| **JDK 17** | ❌ 설치 필요 | 권장: Eclipse Temurin 17 |
| **Android Studio** | ❌ 설치 필요 | 최신 안정판 |
| **Android SDK 34+** | ⚠️ Studio가 자동 설치 | API 34, Build Tools 34.0.0 |
| **Google Play 개발자 계정** | ❌ 등록 필요 | $25 1회 결제, 개인 가능 |
| **앱 서명 키** | ❌ 생성 필요 | keystore.jks (분실 금지!) |

## 1. JDK 17 설치 (Windows)

```powershell
# 옵션 A: winget (권장)
winget install EclipseAdoptium.Temurin.17.JDK

# 옵션 B: 수동 다운로드
# https://adoptium.net/temurin/releases/?version=17
```

설치 후 환경변수 확인:
```bash
java -version
# openjdk version "17.x.x" ...

echo $JAVA_HOME
# 비어있다면 시스템 환경변수에 JAVA_HOME 추가
```

## 2. Android Studio 설치

1. https://developer.android.com/studio 다운로드
2. 설치 마법사에서 **Standard** 선택 → SDK + Emulator 자동 설치
3. 첫 실행 시 SDK Manager → **Android 14 (API 34)** 체크 → Install
4. Tools → SDK Manager → SDK Tools 탭 → **Android SDK Build-Tools 34.0.0** 체크

## 3. 프로젝트 열기 & 첫 빌드

```bash
# 1. 웹 빌드 + Android sync
npm run cap:sync

# 2. Android Studio에서 프로젝트 열기
npm run cap:open
# 또는: Android Studio → Open → d:\AI Workspaces\KidQuest\android
```

Android Studio가 Gradle sync를 시작합니다 (5~10분, 처음 한 번).

**디버그 빌드 + 에뮬레이터 실행**:
- Studio 상단 툴바 → 가상 디바이스 선택 (Pixel 7 권장) → ▶ Run
- 또는 명령줄: `npm run cap:run` (USB 연결된 실기기로 설치)

## 4. 앱 아이콘 + 스플래시

Capacitor가 기본 아이콘을 사용 중입니다. 실제 출시 전 교체:

```bash
# 1. 패키지 설치
npm install --save-dev @capacitor/assets

# 2. 아이콘/스플래시 원본을 assets/에 배치
mkdir assets
# - assets/icon-only.png (1024x1024, 투명 배경)
# - assets/icon-foreground.png (1024x1024, 가운데 64% 영역만 사용)
# - assets/icon-background.png (1024x1024, 단색 배경)
# - assets/splash.png (2732x2732, 가운데 정렬)

# 3. 자동 생성
npx capacitor-assets generate --android
```

이미 `public/icon-1024.png`가 있으니 임시로 활용 가능합니다.

## 5. 앱 서명 키 생성 (출시 전 1회)

**⚠️ 절대 분실 금지**: 이 키를 잃어버리면 앱을 영구히 업데이트할 수 없습니다.

```bash
cd android/app
keytool -genkey -v -keystore kidquest-release.keystore \
  -alias kidquest -keyalg RSA -keysize 2048 -validity 10000
```

비밀번호 + 이름/소속 입력 → `kidquest-release.keystore` 생성됨.

**백업**:
- 외부 USB 또는 클라우드(암호화)에 즉시 복사
- 비밀번호도 따로 안전한 곳에 저장 (1Password / Bitwarden 등)

`android/keystore.properties` 생성 (Git 무시됨):
```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=kidquest
storeFile=kidquest-release.keystore
```

`android/app/build.gradle` 수정 — `signingConfigs` 블록 추가:
```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    // ... 기존 설정 ...
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

## 6. Release AAB 빌드

```bash
npm run cap:build
# 또는 수동:
# cd android && ./gradlew bundleRelease
```

산출물: `android/app/build/outputs/bundle/release/app-release.aab`

이 파일을 Play Console에 업로드합니다.

## 7. Google Play Console 등록

### 7.1 개발자 계정 생성
1. https://play.google.com/console/signup
2. **개인** 또는 **조직** 선택 (사업자 없으면 개인)
3. $25 결제 (1회)
4. 신원 확인 (사진 ID 업로드, 검토 1~2일)

### 7.2 앱 생성
1. Console → **앱 만들기**
2. 앱 이름: **KidQuest (아이퀘스트)**
3. 기본 언어: 한국어
4. 앱 또는 게임: **앱**
5. 무료 또는 유료: **무료** (Pro는 인앱결제로)
6. 선언:
   - [x] 개발자 프로그램 정책에 동의
   - [x] 미국 수출 법률에 동의

### 7.3 대상 연령 설정 (중요!)
**앱 콘텐츠** → **대상 연령** → **혼합 대상 (Mixed Audience)** 선택
- 부모(13세 이상) + 어린이(13세 미만)
- 이렇게 하면 Families 정책이 부분 적용 (전면 적용보다 유연)

### 7.4 콘텐츠 등급
**앱 콘텐츠** → **콘텐츠 등급** → 설문 작성
- 카테고리: 교육
- 폭력성/성적/도박 모두 "없음"
- 결과: **3+ 또는 7+** 등급 예상

### 7.5 개인정보처리방침
**앱 콘텐츠** → **개인정보처리방침** → URL 입력:
- `https://kidquest.pyxora.app/privacy.html` (이미 호스팅됨)

### 7.6 데이터 보안 양식
**앱 콘텐츠** → **데이터 보안** → 다음 항목 선언:
- 이메일 주소 — 계정 관리 (필수)
- 사용자 콘텐츠 (사진) — 앱 기능 (선택)
- 앱 활동 — 앱 기능 (필수)
- 모든 데이터: 전송 중 암호화, 데이터 삭제 요청 가능 ✅

### 7.7 앱 카테고리
- 카테고리: **교육** 또는 **육아**
- "Designed for Families" 프로그램 신청 (선택)

### 7.8 스토어 등록정보
- **앱 이름**: KidQuest (아이퀘스트)
- **간단한 설명** (80자): "부모와 아이가 함께 약속을 세우고 매일 실천하는 습관 형성 앱"
- **전체 설명** (4000자): 아래 템플릿 참고
- **스크린샷**: 휴대전화 (최소 2장, 권장 4~8장), 7인치/10인치 태블릿 (선택)
- **앱 아이콘**: 512x512 PNG (`public/icon-512.png` 사용)
- **그래픽 이미지**: 1024x500 (Play Store 헤더)

### 7.9 출시 트랙
1. **내부 테스트** → 본인만 (즉시 가능)
2. **비공개 테스트** → 가족/지인 (1~2일 검토)
3. **공개 테스트** → Open beta (1주일 검토)
4. **프로덕션** → 정식 출시 (1~2주 검토, Kids 카테고리는 추가 검사 있음)

처음에는 **내부 테스트**부터 시작하세요. AAB 업로드 → 본인 Gmail을 테스터로 추가 → 링크로 설치.

## 8. Firebase Auth — Android 도메인 등록

Capacitor WebView는 `https://localhost` 또는 `https://app.kidquest` 같은 가상 도메인에서 작동합니다. Firebase 콘솔에서:

1. **Firebase Console** → Authentication → Settings → **승인된 도메인**
2. 다음 추가:
   - `localhost` (이미 있을 것)
   - `app.pyxora.kidquest` (capacitor.config.ts의 appId)
3. **iOS 설정** (해당 시): GoogleService-Info.plist 다운로드 → ios/App/App/

`google-services.json` (Android Firebase 설정):
1. Firebase Console → 프로젝트 설정 → Android 앱 추가
2. 패키지 이름: `app.pyxora.kidquest`
3. SHA-1: `keytool -list -v -keystore kidquest-release.keystore -alias kidquest`로 추출
4. 다운로드 → `android/app/google-services.json`에 배치
5. `.gitignore`에 이미 등록되어 있으니 커밋되지 않음

## 9. Play Console 출시 체크리스트

배포 전 확인:

- [ ] **앱 아이콘**: 512x512 + adaptive icon
- [ ] **스크린샷**: 최소 2장 (휴대전화)
- [ ] **개인정보처리방침** URL: 라이브
- [ ] **콘텐츠 등급**: 3+ 또는 7+
- [ ] **대상 연령**: Mixed Audience 선언
- [ ] **데이터 보안** 양식: 모두 작성
- [ ] **앱 서명**: Play App Signing 활성화 (권장)
- [ ] **AAB**: release 빌드 + 서명 완료
- [ ] **버전 코드**: 1, 버전명: 1.0.0
- [ ] **테스트 계정**: 리뷰어용 더미 가족 계정 1개 + 비밀번호 메모

## 10. 자주 막히는 곳 (Pitfalls)

| 문제 | 원인 | 해결 |
|---|---|---|
| Gradle sync 실패 | Java 버전 불일치 | JDK 17 사용 (11/21 X) |
| Sign-In 작동 안 함 | SHA-1 미등록 | google-services.json + Firebase 콘솔에 SHA-1 추가 |
| 화면이 흰색 | webDir 잘못됨 | `npm run build` 후 `cap sync` 다시 실행 |
| 광고 정책 위반 | Kids 앱에 일반 광고 | 부모 모드에만 광고, AdMob Families-cert 필수 |
| 결제 작동 안 함 | Play Billing 미연결 | Phase 3에서 `@capacitor-community/admob` + IAP 플러그인 추가 |
| 앱 이름 충돌 | 이미 등록된 이름 | Play Console에서 다른 표시명 사용 가능 |

## 11. Phase 3 미리보기

다음 단계는 Google Play Billing으로 실결제 연결입니다:

```bash
npm install --save @capacitor-community/in-app-purchases
# 또는 RevenueCat 추천 (수수료는 더 들지만 통합이 훨씬 쉬움)
npm install --save @revenuecat/purchases-capacitor
```

`ProUpsellModal`의 `onSelectYearly` / `onSelectMonthly` 콜백을 RevenueCat의 `Purchases.purchasePackage()` 호출로 교체하면 결제가 작동합니다. 백엔드 검증은 RevenueCat이 대신해줍니다.

## 12. 비용 요약 (Phase 2 한정)

| 항목 | 비용 |
|---|---|
| Google Play 개발자 계정 | $25 (1회) |
| 앱 서명 키 생성 | 무료 |
| Android Studio | 무료 |
| Capacitor + 플러그인 | 무료 (오픈소스) |
| Firebase (Spark) | 무료 (현재 등급 유지) |
| **합계** | **$25** |

Phase 3로 넘어가면 Blaze 요금제가 필요할 수 있습니다 (Cloud Functions로 IAP 검증할 경우).

## 13. 빠른 명령 참조

```bash
# 코드 변경 후 Android 동기화
npm run cap:sync

# Android Studio에서 프로젝트 열기
npm run cap:open

# 실기기/에뮬레이터 즉시 실행
npm run cap:run

# Release AAB 빌드 (Java + Android SDK 필요)
npm run cap:build
```
