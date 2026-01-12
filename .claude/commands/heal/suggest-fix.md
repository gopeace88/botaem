---
allowed-tools: Read, Edit, Grep
argument-hint: [failed-selector] [context-info]
description: 실패한 셀렉터에 대한 고침 방안 제안.
---
# Suggest Selector Fix

## Input
- 실패 셀렉터: $1
- 컨텍스트 (페이지, 요소 설명): $2

## Process

selector-healer agent를 사용하여:

### 1. 실패 원인 분석

#### 가능한 원인들
- **요소 없음**: DOM에서 제거됨
- **셀렉터 변경**: 클래스/ID 변경
- **타이밍**: 로딩 전 시도
- **Frame 오류**: 잘못된 frame 컨텍스트
- **동적 ID**: 세션/타임스탬프 기반 ID

### 2. 요소 특성 수집

요소에 대해 알려진 정보 정리:
- 텍스트 콘텐츠
- ARIA 속성
- 클래스 목록
- 부모 컨텍스트
- 역할 (button, link, input 등)

### 3. 대체 셀렉터 생성

우선순위에 따라 여러 전략 제안:
1. data-testid (있다면)
2. role + name
3. aria-label
4. text content
5. CSS class (의미있는)
6. CSS 조합
7. XPath

### 4. 신뢰도 평가

각 셀렉터에 신뢰도 점수 부여:
- **높음**: 변경 가능성 낮음 (testid, role)
- **중간**: 어느 정도 안정적 (text, aria)
- **낮음**: 변경 가능성 있음 (CSS, XPath)

## Output Format

```
🔍 셀렉터 분석

📍 실패 셀렉터
$1

🔎 추정 원인
[원인 설명]

📋 요소 특성
- 텍스트: "조회"
- 역할: button
- 클래스: btn_search
- ARIA: aria-label="검색 버튼"

🩹 고침 제안

| 우선순위 | 셀렉터 | 신뢰도 |
|---------|--------|--------|
| 1 (primary) | button:has-text("조회") | 높음 |
| 2 (fallback) | [aria-label="검색 버튼"] | 중간 |
| 3 (fallback) | .btn_search | 중간 |
| 4 (fallback) | //button[contains(text(),'조회')] | 낮음 |

📝 SmartSelector 구조

```json
{
  "primary": "button:has-text(\"조회\")",
  "fallback": [
    "[aria-label=\"검색 버튼\"]",
    ".btn_search",
    "//button[contains(text(),'조회')]"
  ],
  "metadata": {
    "text": "조회",
    "ariaLabel": "검색 버튼",
    "role": "button"
  }
}
```

💡 적용 방법
1. 해당 플레이북 파일 열기
2. 실패 스텝의 selector 교체
3. /playbook:test로 검증
```
