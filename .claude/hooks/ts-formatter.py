#!/usr/bin/env python3
"""
TypeScript 파일 자동 포맷팅 Hook
PostToolUse에서 Edit|Write 후 실행
"""
import json
import sys
import subprocess
import os

def main():
    try:
        # stdin에서 JSON 데이터 읽기
        data = json.load(sys.stdin)
        
        # tool_input에서 file_path 추출
        tool_input = data.get('tool_input', {})
        file_path = tool_input.get('file_path', '') or tool_input.get('path', '')
        
        if not file_path:
            sys.exit(0)
        
        # TypeScript/JavaScript 파일만 처리
        if not file_path.endswith(('.ts', '.tsx', '.js', '.jsx')):
            sys.exit(0)
        
        # 파일 존재 확인
        if not os.path.exists(file_path):
            sys.exit(0)
        
        # Prettier 실행
        result = subprocess.run(
            ['npx', 'prettier', '--write', file_path],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print(f"✅ Formatted: {file_path}")
        else:
            # 실패해도 작업은 계속
            print(f"⚠️ Format failed: {file_path}")
        
    except json.JSONDecodeError:
        # JSON 파싱 실패 시 무시
        pass
    except subprocess.TimeoutExpired:
        print("⚠️ Prettier timeout")
    except FileNotFoundError:
        # npx/prettier 없으면 무시
        pass
    except Exception as e:
        # 모든 예외 무시하고 작업 계속
        print(f"⚠️ Hook error: {e}")
    
    # 항상 성공으로 종료 (작업 차단 안함)
    sys.exit(0)

if __name__ == '__main__':
    main()
