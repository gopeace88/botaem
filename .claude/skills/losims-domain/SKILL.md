---
name: losims-domain
description: 지방보조금시스템(losims.go.kr) 도메인 지식. Use when (1) losims UI 요소 셀렉터 작성, (2) 업무 흐름 플레이북 설계, (3) losims 특화 자동 고침, (4) 보조금 업무 프로세스 이해 필요 시.
---
# 지방보조금시스템 Domain

## 시스템 개요
- **URL**: https://www.losims.go.kr/lss.do
- **용도**: 지방자치단체 보조금 관리 시스템
- **사용자**: 공무원, 보조사업자, 민간 수행기관

## UI 구조

### 프레임 레이아웃
losims는 iframe 기반 레이아웃 사용.

```
┌─────────────────────────────────────┐
│          #topFrame (상단 메뉴)       │
├──────────┬──────────────────────────┤
│          │                          │
│ #leftFrame│      #mainFrame          │
│ (좌측 트리)│      (본문 콘텐츠)        │
│          │                          │
│          │                          │
└──────────┴──────────────────────────┘
```

**중요**: 셀렉터 작성 시 반드시 frame 컨텍스트 지정!

```typescript
// 올바른 접근
const mainFrame = page.frameLocator('#mainFrame');
await mainFrame.locator('button:has-text("조회")').click();
```

### 공통 UI 패턴

| 요소 | 클래스/셀렉터 | 설명 |
|------|--------------|------|
| 조회 버튼 | `.btn_search`, `button:has-text("조회")` | 데이터 조회 |
| 저장 버튼 | `.btn_save`, `button:has-text("저장")` | 데이터 저장 |
| 삭제 버튼 | `.btn_delete`, `button:has-text("삭제")` | 데이터 삭제 |
| 신규 버튼 | `.btn_new`, `button:has-text("신규")` | 신규 등록 |
| 그리드 | `.grid_area table` | 데이터 목록 |
| 팝업 | `.layer_popup`, `[role="dialog"]` | 모달 창 |
| 탭 | `.tab_area li` | 탭 메뉴 |
| 트리 | `.tree_area` | 좌측 메뉴 트리 |

## 주요 업무 흐름

### 1. 보조사업 조회
```
로그인 → 좌측메뉴 선택 → 검색조건 입력 → 조회 → 결과 확인
```

### 2. 보조금 신청
```
신규 버튼 → 기본정보 입력 → 사업내용 입력 → 첨부파일 → 저장 → 제출
```

### 3. 정산보고
```
해당 사업 선택 → 정산 탭 → 집행내역 입력 → 증빙자료 첨부 → 제출
```

## 셀렉터 맵

### 로그인 화면
```typescript
{
  id_input: {
    primary: 'input[name="userId"]',
    fallback: ['#userId', 'input:near(:text("아이디"))']
  },
  pw_input: {
    primary: 'input[name="userPw"]',
    fallback: ['#userPw', 'input[type="password"]']
  },
  login_btn: {
    primary: 'button:has-text("로그인")',
    fallback: ['.btn_login', '[type="submit"]']
  }
}
```

### 메인 화면
```typescript
{
  left_menu: {
    primary: '#leftFrame .tree_area',
    fallback: ['[role="tree"]', '.lnb_menu']
  },
  search_btn: {
    primary: '#mainFrame button:has-text("조회")',
    fallback: ['#mainFrame .btn_search', '#mainFrame [onclick*="search"]']
  }
}
```

## 주의사항

### 동적 요소
- 세션 ID, 타임스탬프가 포함된 ID 피하기
- `#element_1736582400000` 같은 패턴 회피

### 로딩 대기
```typescript
// 그리드 로딩 완료 대기
await mainFrame.locator('.grid_area tr').first().waitFor();

// 팝업 표시 대기
await page.locator('.layer_popup').waitFor({ state: 'visible' });
```

### 인증 세션
- 세션 타임아웃: 약 30분
- 장시간 작업 시 세션 체크 필요

## References
- `references/ui-patterns.md` - 상세 UI 패턴
- `references/common-flows.md` - 업무 흐름 상세
- `references/selector-map.md` - 검증된 셀렉터 맵
