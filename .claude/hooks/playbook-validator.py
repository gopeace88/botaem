#!/usr/bin/env python3
"""
플레이북 JSON 자동 검증 Hook
PostToolUse에서 Write 후 실행 (playbook 파일만)
"""
import json
import sys
import os

def validate_playbook(data):
    """플레이북 JSON 검증"""
    errors = []
    warnings = []
    
    # 필수 필드 검증
    if 'id' not in data:
        errors.append("Missing required field: id")
    if 'name' not in data:
        errors.append("Missing required field: name")
    if 'steps' not in data:
        errors.append("Missing required field: steps")
    elif not isinstance(data['steps'], list):
        errors.append("'steps' must be an array")
    elif len(data['steps']) == 0:
        errors.append("'steps' array is empty")
    else:
        # 각 스텝 검증
        for i, step in enumerate(data['steps']):
            step_prefix = f"Step {i + 1}"
            
            if 'id' not in step:
                errors.append(f"{step_prefix}: Missing 'id'")
            if 'type' not in step:
                errors.append(f"{step_prefix}: Missing 'type'")
            if 'message' not in step:
                errors.append(f"{step_prefix}: Missing 'message'")
            
            # selector 검증 (navigate, wait 제외)
            step_type = step.get('type', '')
            if step_type not in ['navigate', 'wait', 'screenshot']:
                if 'selector' not in step:
                    errors.append(f"{step_prefix}: Missing 'selector'")
                else:
                    selector = step['selector']
                    if 'primary' not in selector:
                        errors.append(f"{step_prefix}: Missing 'selector.primary'")
                    
                    # fallback 권장 검사
                    fallback = selector.get('fallback', [])
                    if len(fallback) < 3:
                        warnings.append(f"{step_prefix}: fallback {len(fallback)}개 (권장: 3개 이상)")
    
    return errors, warnings

def main():
    try:
        # stdin에서 JSON 데이터 읽기
        input_data = json.load(sys.stdin)
        
        # tool_input에서 file_path 추출
        tool_input = input_data.get('tool_input', {})
        file_path = tool_input.get('file_path', '') or tool_input.get('path', '')
        
        if not file_path:
            sys.exit(0)
        
        # playbook 관련 파일만 처리
        if 'playbook' not in file_path.lower() and not file_path.endswith('.json'):
            sys.exit(0)
        
        # 파일이 playbooks 폴더에 있거나 playbook 이름 포함
        if not ('playbook' in file_path.lower() or '/playbooks/' in file_path or '\\playbooks\\' in file_path):
            sys.exit(0)
        
        # 파일 존재 확인
        if not os.path.exists(file_path):
            sys.exit(0)
        
        # 파일 읽기 및 검증
        with open(file_path, 'r', encoding='utf-8') as f:
            playbook_data = json.load(f)
        
        errors, warnings = validate_playbook(playbook_data)
        
        # 결과 출력
        if errors:
            print("❌ Playbook validation errors:")
            for err in errors:
                print(f"  - {err}")
            # 에러 있으면 작업 차단
            sys.exit(2)
        
        if warnings:
            print("⚠️ Playbook validation warnings:")
            for warn in warnings:
                print(f"  - {warn}")
        
        print(f"✅ Playbook validated: {file_path}")
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error: {e}")
        sys.exit(2)
    except Exception as e:
        # 예상치 못한 에러는 무시
        print(f"⚠️ Validation hook error: {e}")
    
    sys.exit(0)

if __name__ == '__main__':
    main()
