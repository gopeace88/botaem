---
allowed-tools: Read, Bash(cat:*), Bash(grep:*), Bash(tail:*)
description: 자동 고침 실패 로그 분석. 패턴을 찾아 개선점 도출.
---
# Heal Failure Analysis

## Context

### 최근 고침 로그
```bash
!`tail -100 botame-admin/logs/heal.log 2>/dev/null || echo "로그 파일 없음"`
```

### 최근 실행 결과
```bash
!`ls -la .claude/workspace/heal-logs/ 2>/dev/null || echo "heal-logs 폴더 비어있음"`
```

## Process

selector-healer agent를 사용하여:

### 1. 실패 로그 수집
- 최근 N건의 고침 시도 로그
- 실패한 셀렉터 목록
- healMethod별 성공/실패 통계

### 2. 패턴 분류

#### 셀렉터 유형별
- CSS 셀렉터 실패율
- Text 셀렉터 실패율
- XPath 셀렉터 실패율

#### 페이지별
- 어떤 페이지에서 실패가 많은지
- losims 특정 화면 문제

#### 시간대별
- 특정 시간에 실패 집중 (세션 만료 등)

### 3. 반복 실패 식별
- 3회 이상 실패한 셀렉터
- 동일 요소 다른 셀렉터 실패

### 4. 개선 전략 도출
- fallback 전략 개선
- 셀렉터 교체 권장

## Output Format

```
📊 자동 고침 분석 (최근 100건)

📈 통계
- 총 고침 시도: 100건
- 성공: 75건 (75%)
- 실패: 25건 (25%)

🔴 반복 실패 셀렉터 TOP 5
1. #btn_search_* (15회) - 동적 ID 문제
2. .grid_row:nth-child(1) (8회) - 인덱스 기반 취약
3. //div[@class='popup']/button (5회) - XPath 구조 변경

📊 healMethod 성공률
- fallback: 85% (가장 안정적)
- text: 70%
- aria: 65%
- dynamic: 40%

💡 개선 제안
1. 동적 ID 셀렉터 → 텍스트 기반으로 전환
2. 인덱스 기반 → 고유 속성 기반으로 전환
3. XPath → CSS + 텍스트 조합으로 전환

🔧 즉시 수정 권장
- playbooks/login.json: Step 3 셀렉터
- playbooks/search.json: Step 5, 7 셀렉터
```
