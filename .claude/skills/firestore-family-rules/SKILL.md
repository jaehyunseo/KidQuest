---
name: firestore-family-rules
description: KidQuest의 Firestore 스키마, 컬렉션 구조, parent/child 권한 규칙 컨벤션. Firestore 쿼리 작성, 보안 규칙 수정, 스키마 확장 시 사용.
---

# Firestore 스키마 & 보안 규칙

## 컬렉션 트리
```
users/{uid}                               // UserAccount — 본인만 R/W
families/{familyId}                       // Family — 인증 사용자 읽기, parent만 수정(멤버 추가 예외)
  ├─ children/{childId}                   // ChildProfile — 가족 멤버 R/W
  │   ├─ quests/{questId}                 // Quest — 가족 멤버 R/W
  │   └─ history/{historyId}              // HistoryRecord — 가족 멤버 R/W
```

실제 규칙은 [firestore.rules](firestore.rules)에 있음.

## 헬퍼 함수 ([firestore.rules](firestore.rules))
- `isAuthenticated()` — `request.auth != null`
- `getUserData()` — `users/{auth.uid}` 문서 data
- `isFamilyMember(familyId)` — 사용자 `familyId`가 일치
- `isParentOfFamily(familyId)` — 가족 멤버 + `role == 'parent'`

## 규칙 원칙
1. **users/{uid}** — 본인만. 자신의 `familyId`, `role` 관리
2. **families/{familyId}** —
   - read: 인증 사용자 (초대 코드 조회용)
   - create: 인증 사용자 (가족 생성)
   - update: parent **또는** `members` 필드만 변경하는 경우 (자녀 가입 허용)
3. **하위 컬렉션** (children/quests/history) — 가족 멤버 전체 R/W. parent-only 제약은 클라이언트 로직으로 분리

## 쿼리 패턴
```ts
import { doc, getDoc, collection, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// 사용자 문서
const userRef = doc(db, 'users', uid);

// 가족 하위 컬렉션
const questsRef = collection(db, 'families', familyId, 'children', childId, 'quests');

// 실시간 구독
const unsub = onSnapshot(questsRef, snap => {
  const quests = snap.docs.map(d => ({ id: d.id, ...d.data() } as Quest));
});
```

## 초대 코드로 가족 찾기
`families`를 `where('inviteCode', '==', code)`로 쿼리 → 결과의 `members`에 자신 uid 추가. `update`는 "members만 변경" 예외 규칙을 통해 parent가 아닌 child도 수행 가능.

## 스키마 확장 시 체크리스트
1. [src/types.ts](src/types.ts)에 타입 추가/수정
2. [firestore.rules](firestore.rules)에 매치 규칙 추가
3. 새 컬렉션은 기본적으로 `isFamilyMember(familyId)` 게이트 사용
4. parent-only 액션은 `isParentOfFamily(familyId)` 사용
5. 규칙 변경 후 Firebase 콘솔 또는 `firebase deploy --only firestore:rules`로 반영

## 주의
- `databaseId`가 기본값이 아님 — [src/firebase.ts](src/firebase.ts)에서 `firestoreDatabaseId` 사용
- 클라이언트에서 `families` 전체 쿼리는 read 규칙상 가능하나 리스트 노출 위험 → 초대 코드 기반 단건 조회만 사용
