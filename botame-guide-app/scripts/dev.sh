#!/bin/bash
# 보탬e 가이드 앱 개발 모드 실행 스크립트
# WSL2 환경에서 한글 입력과 브라우저 스크롤바 지원

set -e

# 프로젝트 디렉토리로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "=== 보탬e 가이드 앱 시작 ==="

# 1. 환경 변수 설정 (한글 입력용)
export DISPLAY=:0
export GTK_IM_MODULE=fcitx
export QT_IM_MODULE=fcitx
export XMODIFIERS="@im=fcitx"
export SDL_IM_MODULE=fcitx

echo "[1/4] 환경 변수 설정 완료"

# 2. 기존 프로세스 정리
echo "[2/4] 기존 프로세스 정리 중..."
pkill -f "electron-vite" 2>/dev/null || true
pkill -f "botame-guide-app/node_modules/electron" 2>/dev/null || true
pkill -f "ms-playwright/chromium" 2>/dev/null || true
sleep 1

# 3. fcitx 시작 (한글 입력)
echo "[3/4] fcitx 입력기 시작 중..."
if ! pgrep -x "fcitx" > /dev/null; then
    fcitx -d 2>/dev/null &
    sleep 2
    echo "  - fcitx 시작됨"
else
    echo "  - fcitx 이미 실행 중"
fi

# fcitx 상태 확인
if fcitx-remote 2>/dev/null; then
    echo "  - fcitx 응답 확인"
    echo "  - 한영 전환: Ctrl+Space 또는 한영키"
else
    echo "  - 경고: fcitx가 응답하지 않습니다"
fi

# 4. 앱 실행
echo "[4/4] 앱 실행 중..."
echo ""
echo "=== 한글 입력: Ctrl+Space 또는 한영키 ==="
echo "=== 브라우저: 1280x800 고정 크기 (스크롤바 표시) ==="
echo ""

npm run dev
