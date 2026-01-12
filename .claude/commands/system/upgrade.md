---
allowed-tools: Read, Edit, Write, Bash(git:*), Grep, Glob
argument-hint: [focus-area] (skills|agents|hooks|commands|all)
description: 오케스트레이션 시스템 업그레이드. 최근 작업 패턴을 분석하고 시스템 개선점을 발견하여 적용합니다.
---
# System Upgrade

## Context
- 업그레이드 대상: $ARGUMENTS (기본: all)
- 최근 커밋: !`git log --oneline -10 2>/dev/null || echo "No commits yet"`
- 최근 변경 파일: !`git diff --name-only HEAD~1 2>/dev/null || git status --short`

## Upgrade Process

### Phase 1: 분석
1. 최근 커밋에서 반복되는 작업 패턴 식별
2. 자주 사용되는 코드/명령어 추출
3. 에러가 자주 발생하는 영역 파악

### Phase 2: 개선안 도출
패턴별 자동화 가능성 평가:
- **새 Skill 필요**: 도메인 지식이 반복 참조됨
- **새 Agent 필요**: 특정 전문 작업이 반복됨
- **새 Hook 필요**: 파일 저장 후 동일 작업 반복
- **새 Command 필요**: 같은 명령어 조합 반복

### Phase 3: 구현
발견된 개선점을 구현:
1. 우선순위 정렬 (효과/노력 비율)
2. 가장 효과적인 1-2개 항목 구현
3. 기존 구성요소 업데이트

## Output Format
```
🔍 분석 결과
- 반복 패턴 X개 발견
- 자동화 가능 항목 Y개

📈 업그레이드 계획
1. [높음] [구현 내용] - 예상 효과: ...
2. [중간] [구현 내용] - 예상 효과: ...

✅ 적용 완료
- [변경 내용]

📝 다음 세션 권장
- [후속 작업]
```

사용자에게 각 단계 진행 전 확인을 받으세요.
