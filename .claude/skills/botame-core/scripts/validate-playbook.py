#!/usr/bin/env python3
"""
플레이북 JSON 검증 스크립트
사용법: python3 validate-playbook.py <playbook-file.json>
"""
import json
import sys
import os

def validate_smart_selector(selector, step_prefix):
    """SmartSelector 구조 검증"""
    errors = []
    warnings = []
    
    if not isinstance(selector, dict):
        errors.append(f"{step_prefix}: selector는 객체여야 합니다")
        return errors, warnings
    
    # primary 필수
    if 'primary' not in selector:
        errors.append(f"{step_prefix}: selector.primary 필수")
    elif not isinstance(selector['primary'], str) or not selector['primary'].strip():
        errors.append(f"{step_prefix}: selector.primary는 비어있지 않은 문자열이어야 합니다")
    
    # fallback 권장
    fallback = selector.get('fallback', [])
    if not isinstance(fallback, list):
        errors.append(f"{step_prefix}: selector.fallback은 배열이어야 합니다")
    elif len(fallback) < 3:
        warnings.append(f"{step_prefix}: fallback {len(fallback)}개 (권장: 3개 이상)")
    
    # metadata 선택
    metadata = selector.get('metadata')
    if metadata is not None and not isinstance(metadata, dict):
        warnings.append(f"{step_prefix}: selector.metadata는 객체여야 합니다")
    
    return errors, warnings

def validate_step(step, index):
    """단일 스텝 검증"""
    errors = []
    warnings = []
    step_prefix = f"Step {index + 1}"
    
    # 필수 필드
    if 'id' not in step:
        errors.append(f"{step_prefix}: id 필수")
    
    if 'type' not in step:
        errors.append(f"{step_prefix}: type 필수")
    else:
        valid_types = ['click', 'fill', 'select', 'navigate', 'wait', 'screenshot', 'hover', 'check', 'uncheck']
        if step['type'] not in valid_types:
            errors.append(f"{step_prefix}: 유효하지 않은 type '{step['type']}' (허용: {valid_types})")
    
    if 'message' not in step:
        errors.append(f"{step_prefix}: message 필수")
    elif not step['message'].strip():
        warnings.append(f"{step_prefix}: message가 비어있습니다")
    
    # selector 검증 (일부 타입 제외)
    no_selector_types = ['navigate', 'wait', 'screenshot']
    if step.get('type') not in no_selector_types:
        if 'selector' not in step:
            errors.append(f"{step_prefix}: selector 필수 (type: {step.get('type')})")
        else:
            sel_errors, sel_warnings = validate_smart_selector(step['selector'], step_prefix)
            errors.extend(sel_errors)
            warnings.extend(sel_warnings)
    
    # fill 타입은 value 필요
    if step.get('type') == 'fill' and 'value' not in step:
        warnings.append(f"{step_prefix}: fill 타입에 value 권장")
    
    # timeout 권장
    if 'timeout' not in step:
        warnings.append(f"{step_prefix}: timeout 미설정 (기본값 사용)")
    
    return errors, warnings

def validate_playbook(data):
    """플레이북 전체 검증"""
    errors = []
    warnings = []
    
    # 최상위 필수 필드
    if 'id' not in data:
        errors.append("최상위: id 필수")
    
    if 'name' not in data:
        errors.append("최상위: name 필수")
    elif not data['name'].strip():
        warnings.append("최상위: name이 비어있습니다")
    
    if 'steps' not in data:
        errors.append("최상위: steps 필수")
    elif not isinstance(data['steps'], list):
        errors.append("최상위: steps는 배열이어야 합니다")
    elif len(data['steps']) == 0:
        errors.append("최상위: steps 배열이 비어있습니다")
    else:
        # 각 스텝 검증
        for i, step in enumerate(data['steps']):
            step_errors, step_warnings = validate_step(step, i)
            errors.extend(step_errors)
            warnings.extend(step_warnings)
    
    # start_url 권장
    if 'start_url' not in data:
        warnings.append("최상위: start_url 권장")
    
    return errors, warnings

def main():
    if len(sys.argv) < 2:
        print("사용법: python3 validate-playbook.py <playbook-file.json>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    # 파일 존재 확인
    if not os.path.exists(file_path):
        print(f"❌ 파일을 찾을 수 없습니다: {file_path}")
        sys.exit(1)
    
    # JSON 파싱
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ JSON 파싱 오류: {e}")
        sys.exit(1)
    
    # 검증 실행
    errors, warnings = validate_playbook(data)
    
    # 결과 출력
    print(f"\n📋 플레이북 검증 결과: {file_path}\n")
    
    if errors:
        print("❌ Errors:")
        for err in errors:
            print(f"  - {err}")
        print()
    
    if warnings:
        print("⚠️ Warnings:")
        for warn in warnings:
            print(f"  - {warn}")
        print()
    
    # 요약
    step_count = len(data.get('steps', []))
    print(f"📊 Summary:")
    print(f"  - 스텝 수: {step_count}")
    print(f"  - 에러: {len(errors)}")
    print(f"  - 경고: {len(warnings)}")
    
    if errors:
        print(f"\n❌ INVALID - {len(errors)}개 에러 수정 필요")
        sys.exit(1)
    elif warnings:
        print(f"\n✅ VALID (with {len(warnings)} warnings)")
    else:
        print(f"\n✅ VALID")
    
    sys.exit(0)

if __name__ == '__main__':
    main()
