---
allowed-tools: Bash(git:*), Bash(cat:*), Bash(wc:*), Read
description: 오케스트레이션 시스템 사용 패턴 분석
---
# Usage Pattern Analysis

## Data Collection

### Git History Analysis
!`git log --oneline --since="2 weeks ago" 2>/dev/null | wc -l || echo "0"` commits in last 2 weeks

### File Change Frequency (if commits exist)
!`git log --since="2 weeks ago" --name-only --pretty=format: 2>/dev/null | sort | uniq -c | sort -rn | head -20 || echo "No history available"`

### Current Status
!`git status --short 2>/dev/null || echo "Not a git repository"`

## Analysis Tasks
(이하 동일...)
```

---

## 핵심 수정 패턴

모든 git 명령어에 에러 처리 추가:

| 기존 | 수정 |
|------|------|
| `!git log ...` | `!git log ... 2>/dev/null \|\| echo "No commits"` |
| `!git diff HEAD~5` | `!git diff HEAD~1 2>/dev/null \|\| git status --short` |
| `!git branch ...` | `!git branch ... 2>/dev/null \|\| echo "Unknown"` |

---

## 지금 바로 테스트

파일 수정 후 다시 실행:
```
/system:upgrade all
```

또는 자연어로:
```
현재 프로젝트 상태 분석하고 오케스트레이션 시스템 개선점 찾아줘
