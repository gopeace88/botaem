---
allowed-tools: Read, Write, Edit
argument-hint: [event-type] [matcher] [purpose]
description: 새 Hook을 생성합니다. 이벤트 타입, 매처, 실행 스크립트를 구성합니다.
---
# Create New Hook

## Input
- 이벤트 타입: $1 (PreToolUse|PostToolUse|Notification|Stop|SubagentStop)
- 매처: $2 (Bash|Edit|Write|Read|* 등)
- 목적: $3

## Available Events
| Event | 용도 | Exit Code 의미 |
|-------|------|---------------|
| PreToolUse | 도구 실행 전 검사/차단 | 0=허용, 2=차단 |
| PostToolUse | 도구 실행 후 처리 | - |
| Notification | 알림 발생 시 | - |
| Stop | Claude 응답 완료 시 | - |

## Creation Process

### Step 1: Hook 스크립트 생성
`.claude/hooks/$1-$2.py`:
```python
#!/usr/bin/env python3
"""
Hook: $3
Event: $1
Matcher: $2
"""
import json
import sys

try:
    data = json.load(sys.stdin)
    tool_input = data.get('tool_input', {})
    
    # TODO: 실제 로직 구현
    file_path = tool_input.get('file_path', '')
    
    # 처리 로직
    
except Exception as e:
    print(f"Hook error: {e}", file=sys.stderr)
    sys.exit(0)  # 실패해도 작업 계속
```

### Step 2: settings.json 업데이트
`.claude/settings.json`에 추가:
```json
{
  "hooks": {
    "$1": [
      {
        "matcher": "$2",
        "hooks": [
          {
            "type": "command",
            "command": "python3 .claude/hooks/$1-$2.py"
          }
        ]
      }
    ]
  }
}
```

### Step 3: 테스트
Hook이 의도대로 동작하는지 테스트.

## Output
생성된 Hook 설정과 테스트 결과.
