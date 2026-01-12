---
allowed-tools: Read, Bash(cat:*), Bash(jq:*)
argument-hint: [playbook-file.json]
description: 플레이북 분석. 구조, 셀렉터 품질, 개선점을 파악합니다.
---
# Playbook Analysis

## Target
분석 대상: $ARGUMENTS

## Context
```bash
# 플레이북 파일 확인
!`cat "$ARGUMENTS" 2>/dev/null | head -50 || echo "File not found"`
```

## Analysis Tasks

playbook-developer agent를 사용하여:

### 1. 구조 분석
- 총 스텝 수
- 스텝 타입 분포 (click, fill, select, wait 등)
- 흐름 논리성 검토

### 2. 셀렉터 품질 평가
- fallback 개수 (3개 이상 권장)
- 전략 다양성 (text, aria, css 혼합 권장)
- losims 특화 패턴 준수 (frame 컨텍스트)
- 동적 ID 사용 여부

### 3. 메시지 명확성
- 사용자가 이해할 수 있는 설명인지
- 자동 고침 시 키워드 추출 가능 여부

### 4. 대기 전략
- 적절한 timeout 설정
- 로딩 대기 누락 여부

## Output
- 품질 점수 (100점 만점)
- 항목별 분석 결과
- 구체적 개선 권장사항
