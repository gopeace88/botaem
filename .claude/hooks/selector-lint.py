#!/usr/bin/env python3
"""
셀렉터 린트 Hook
PreToolUse에서 Edit 전 실행
SmartSelector 수정 시 fallback 개수 체크
"""
import json
import sys
import re

def main():
    try:
        # stdin에서 JSON 데이터 읽기
        data = json.load(sys.stdin)
        
        # tool_input에서 정보 추출
        tool_input = data.get('tool_input', {})
        file_path = tool_input.get('file_path', '') or tool_input.get('path', '')
        new_content = tool_input.get('new_str', '') or tool_input.get('content', '')
        
        if not file_path or not new_content:
            sys.exit(0)
        
        # 셀렉터 관련 파일만 처리
        selector_related = any(keyword in file_path.lower() for keyword in [
            'playbook', 'selector', 'self-healing', 'healing'
        ])
        
        if not selector_related:
            sys.exit(0)
        
        # SmartSelector 패턴 검사
        if 'fallback' in new_content:
            # fallback 배열 추출 시도
            # 패턴: fallback: [...] 또는 "fallback": [...]
            patterns = [
                r'fallback\s*:\s*\[(.*?)\]',
                r'"fallback"\s*:\s*\[(.*?)\]',
            ]
            
            for pattern in patterns:
                match = re.search(pattern, new_content, re.DOTALL)
                if match:
                    fallback_content = match.group(1).strip()
                    
                    if not fallback_content:
                        # 빈 배열
                        print("⚠️ Selector lint: fallback 배열이 비어있습니다. 3개 이상 권장.")
                        break
                    
                    # 요소 개수 세기 (쉼표 기준, 대략적)
                    # 문자열 내 쉼표 제외하기 어려우므로 단순 카운트
                    fallback_count = fallback_content.count(',') + 1
                    
                    if fallback_count < 3:
                        print(f"⚠️ Selector lint: fallback이 {fallback_count}개입니다. 3개 이상 권장.")
                    
                    break
        
        # 동적 ID 패턴 경고
        dynamic_id_patterns = [
            r'#\w+_\d{10,}',  # #element_1234567890
            r'#\w+-\d{10,}',  # #element-1234567890
        ]
        
        for pattern in dynamic_id_patterns:
            if re.search(pattern, new_content):
                print("⚠️ Selector lint: 동적 ID 패턴 감지. 텍스트/ARIA 기반 셀렉터 권장.")
                break
        
    except json.JSONDecodeError:
        pass
    except Exception as e:
        print(f"⚠️ Selector lint error: {e}")
    
    # 경고만 출력, 작업은 차단하지 않음
    sys.exit(0)

if __name__ == '__main__':
    main()
