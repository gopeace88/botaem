# botame-guide-app

> 사용자용 가이드 앱. 설계 문서: `Docs/MASTER_DESIGN.md`

## 빠른 시작

```bash
cd /mnt/d/00.Projects/02.보탬e/botame-guide-app
./scripts/dev.sh   # 또는 npm run dev
```

## 테스트 계정

- URL: https://www.losims.go.kr/lss.do
- 아이디: gopeace / 비밀번호: gopeace123!
- 로그인: "아이디 로그인" 탭 선택 후 입력

## 검증된 셀렉터

| 요소 | 셀렉터 |
|------|--------|
| 아이디 로그인 탭 | `text=아이디 로그인` |
| 아이디 입력 | `input[type='text']` |
| 비밀번호 입력 | `input[type='password']` |
| 로그인 버튼 | `role=button[name='로그인 버튼']` |
| 사용자 이름 | `text=알티케이` |

## WSL2 한글 입력

```bash
# 필수 패키지
sudo apt-get install -y fcitx fcitx-hangul

# 환경 변수 (~/.bashrc)
export DISPLAY=:0
export GTK_IM_MODULE=fcitx
export QT_IM_MODULE=fcitx
export XMODIFIERS="@im=fcitx"

# 실행
fcitx -d &
```

한영 전환: Ctrl+Space

## 트러블슈팅

| 문제 | 해결 |
|------|------|
| 한글 입력 안됨 | `pkill fcitx && DISPLAY=:0 fcitx -d &` |
| 스크롤바 안보임 | viewport 고정값 사용 (1280x800) |

## 주요 경로

- 플레이북 캐시: `~/.config/botame-guide-app/playbook-cache/`
- 브라우저 데이터: `~/.config/botame-guide-app/browser-data/`
- 시스템 플레이북: `electron/playbooks/`
