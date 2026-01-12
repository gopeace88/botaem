---
allowed-tools: Read, Bash(python3:*), Bash(jq:*)
argument-hint: [playbook-file.json]
description: 플레이북 JSON 유효성 검사. 스키마 준수 여부 확인.
---
# Playbook Validation

## Target
검증 대상: $ARGUMENTS

## Validation Steps

### 1. JSON 문법 검증
```bash
!`jq '.' "$ARGUMENTS" > /dev/null 2>&1 && echo "✅ JSON 문법: OK" || echo "❌ JSON 문법: 오류"`
```

### 2. 스키마 검증
Python 스크립트 또는 수동 검증:

#### 필수 필드
- `id` (string, UUID)
- `name` (string)
- `steps` (array, 1개 이상)

#### 각 Step 필수 필드
- `id` (string)
- `type` (enum: click, fill, select, navigate, wait, screenshot)
- `message` (string)
- `selector` (object, type이 navigate/wait 아닌 경우)

#### SmartSelector 구조
- `primary` (string, 필수)
- `fallback` (array, 권장 3개 이상)
- `metadata` (object, 선택)

### 3. 품질 검사 (Warning)
- fallback 개수 < 3
- timeout 미설정
- frame 컨텍스트 누락 (losims URL인 경우)

## Output Format

```
📋 플레이북 검증 결과

📄 파일: example.json

✅ Passed
- JSON 문법
- 필수 필드 (id, name, steps)
- 스텝 구조 (10/10)

⚠️ Warnings
- Step 3: fallback 2개 (권장: 3개 이상)
- Step 7: timeout 미설정

❌ Errors
- (없음)

📊 Summary: VALID (2 warnings)
```
