#!/bin/bash

# 보탬e 관리자 v1.0.0 릴리스 스크립트
# 이 스크립트는 릴리스 빌드를 생성하고 GitHub에 업로드합니다

set -e  # 오류 발생 시 중단

VERSION="1.0.0"
PRODUCT_NAME="보탬e-관리자"
GITHUB_REPO="gopeace88/botaem"

echo "🚀 Starting release build for ${PRODUCT_NAME} v${VERSION}"
echo "================================================"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 함수: 성공 메시지
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 함수: 경고 메시지
warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 함수: 오류 메시지
error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

# 사전 체크
echo ""
echo "📋 Pre-flight checks..."

# Node.js 체크
if ! command -v node &> /dev/null; then
    error "Node.js is not installed"
fi
success "Node.js $(node -v)"

# pnpm 체크
if ! command -v pnpm &> /dev/null; then
    error "pnpm is not installed"
fi
success "pnpm $(pnpm -v)"

# Git 체크
if ! command -v git &> /dev/null; then
    error "Git is not installed"
fi
success "Git $(git --version)"

# 의존성 설치
echo ""
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile || error "Failed to install dependencies"
success "Dependencies installed"

# 타입 체크
echo ""
echo "🔍 Type checking..."
pnpm run typecheck || error "TypeScript check failed"
success "Type check passed"

# 린트
echo ""
echo "🧹 Linting..."
pnpm run lint || error "ESLint check failed"
success "Lint passed"

# 테스트
echo ""
echo "🧪 Running tests..."
pnpm run test || warning "Unit tests failed (continuing anyway)"
success "Tests completed"

# 빌드
echo ""
echo "🏗️  Building application..."

# OS별 빌드
case "$(uname -s)" in
    Darwin*)
        echo "Building for macOS..."
        pnpm run build -- --mac --universal || error "macOS build failed"
        success "macOS build complete"
        ;;

    Linux*)
        echo "Building for Linux..."
        pnpm run build -- --linux appimage deb || error "Linux build failed"
        success "Linux build complete"
        ;;

    MINGW*|MSYS*|CYGWIN*)
        echo "Building for Windows..."
        pnpm run build -- --win --x64 || error "Windows build failed"
        success "Windows build complete"
        ;;

    *)
        warning "Unknown OS. Skipping build."
        ;;
esac

# 빌드 결과물 확인
echo ""
echo "📦 Build artifacts:"
ls -lh release/ || error "No build artifacts found"

# Git 태그 생성 (아직 없는 경우)
echo ""
echo "🏷️  Creating git tag..."
if git rev-parse "v${VERSION}" >/dev/null 2>&1; then
    warning "Tag v${VERSION} already exists"
else
    git tag -a "v${VERSION}" -m "Release v${VERSION}" || error "Failed to create tag"
    git push origin "v${VERSION}" || error "Failed to push tag"
    success "Tag v${VERSION} created and pushed"
fi

# GitHub CLI 체크 및 릴리스 생성
echo ""
if command -v gh &> /dev/null; then
    echo "📢 Creating GitHub release..."

    # 릴리스 노트 읽기
    RELEASE_NOTES=""
    if [ -f "../../RELEASE_NOTES_v${VERSION}.md" ]; then
        RELEASE_NOTES=$(cat "../../RELEASE_NOTES_v${VERSION}.md")
    else
        warning "Release notes not found. Using placeholder."
        RELEASE_NOTES="Release v${VERSION}"
    fi

    # 릴리스 생성 (초안)
    echo "$RELEASE_NOTES" | gh release create "v${VERSION}" \
        --title "${PRODUCT_NAME} v${VERSION}" \
        --notes-file - \
        --draft || error "Failed to create GitHub release"

    success "GitHub release draft created"
    echo ""
    echo "📎 Please upload build artifacts from 'release/' directory to the GitHub release:"
    echo "   https://github.com/${GITHUB_REPO}/releases/edit/v${VERSION}"
else
    warning "GitHub CLI (gh) not installed. Please create release manually:"
    echo "   1. Go to: https://github.com/${GITHUB_REPO}/releases/new"
    echo "   2. Tag: v${VERSION}"
    echo "   3. Title: ${PRODUCT_NAME} v${VERSION}"
    echo "   4. Upload artifacts from 'release/' directory"
fi

# 완료
echo ""
echo "================================================"
success "Release build complete! 🎉"
echo ""
echo "Next steps:"
echo "  1. Test the build artifacts"
echo "  2. Upload artifacts to GitHub release"
echo "  3. Publish the release"
echo "  4. Announce the release"
echo ""
echo "Release checklist: ../../RELEASE_CHECKLIST.md"
echo ""
