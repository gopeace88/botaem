# Playbook Schema Reference

## Playbook Structure
```typescript
interface Playbook {
  id: string;
  name: string;
  description?: string;
  start_url: string;  // 기본: "https://www.losims.go.kr/lss.do"
  steps: PlaybookStep[];
  metadata: {
    version: string;
    created_at: string;
    updated_at: string;
  };
}

interface PlaybookStep {
  id: string;
  type: 'click' | 'fill' | 'select' | 'navigate' | 'wait' | 'screenshot';
  selector?: SmartSelector;
  value?: string;
  message: string;  // 사용자에게 보여줄 설명
  timeout?: number; // 기본: 30000ms
}

interface SmartSelector {
  primary: string;
  fallback: string[];
  metadata?: {
    text?: string;
    ariaLabel?: string;
    role?: string;
  };
}
```

## Step Types
| Type | 용도 | 필수 필드 |
|------|------|----------|
| click | 요소 클릭 | selector |
| fill | 입력 필드 채우기 | selector, value |
| select | 드롭다운 선택 | selector, value |
| navigate | URL 이동 | value (URL) |
| wait | 대기 | value (ms) or selector |
| screenshot | 스크린샷 | - |

## Validation Rules
1. `id`는 UUID v4 형식
2. `start_url`은 유효한 URL
3. 각 step의 `selector.primary`는 유효한 CSS/XPath
4. `message`는 필수 (자동 고침 시 키워드 추출용)
