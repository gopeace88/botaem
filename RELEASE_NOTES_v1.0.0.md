# 보탬e 관리자 v1.0.0 Release Notes

 Released: 2025-01-15

## 🎉 첫 번째 공식 릴리스

보탬e 관리자의 첫 번째 공식 릴리스를 발표합니다! 이 버전은 지방보조금시스템(losims.go.kr) 사용자들이 AI 가이드의 도움을 받아 쉽게 시스템을 이용할 수 있도록 돕는 완전한 플레이북 관리 및 실행 시스템을 제공합니다.

## ✨ 주요 기능

### 1. 플레이북 관리
- ✅ 플레이북 생성, 편집, 삭제
- ✅ 로컬 파일 시스템 저장
- ✅ JSON 형식으로 가져오기/내보내기
- ✅ 메타데이터 관리 (이름, 설명, 카테고리)

### 2. 녹화 기능
- ✅ 브라우저 동작 자동 녹화
- ✅ 스마트 셀렉터 자동 생성
- ✅ 실시간 스텝 미리보기
- ✅ 녹화 중 일시정지/재개
- ✅ 개별 스텝 삭제

### 3. 플레이북 실행
- ✅ 자동 플레이백
- ✅ 단계별 실행 상태 표시
- ✅ 실행 중 일시정지/재개/중지
- ✅ 스크린샷 자동 저장
- ✅ 실행 결과 리포트

### 4. 자동 고침 (Self-Healing)
- ✅ 셀렉터 실패 시 자동 복구
- ✅ 폴백 셀렉터 순차 시도
- ✅ 동적 텍스트 탐색
- ✅ ARIA 라벨 매칭
- ✅ 수동 셀렉터 선택 지원
- ✅ 고침 결과 표시 및 리포트

### 5. 클라우드 동기화
- ✅ Supabase 연동
- ✅ 플레이북 업로드/다운로드
- ✅ 카탈로그 기능 (DB 전체 조회)
- ✅ 일괄 업로드
- ✅ 원격 플레이북 직접 실행
- ✅ 버전 관리

### 6. 오프라인 지원
- ✅ IndexedDB 기반 로컬 저장소
- ✅ 오프라인 모드 자동 전환
- ✅ 오프라인 동작 큐잉
- ✅ 재연결 시 자동 동기화
- ✅ 오프라인 표시기

### 7. 보안
- ✅ API Key 안전한 저장소 (OS 네이티브 암호화)
- ✅ Electron 샌드박스 활성화
- ✅ 컨텍스트 격리
- ✅ 안전한 IPC 통신

### 8. 자동 업데이트
- ✅ GitHub Releases 기반 업데이트
- ✅ 자동 업데이트 확인
- ✅ 백그라운드 다운로드
- ✅ 사용자 알림 및 설치

### 9. 모니터링
- ✅ 실시계 시스템 메트릭 대시보드
- ✅ 서비스 상태 모니터링
- ✅ 서킷 브레이커 패턴
- ✅ CPU/메모리 사용량 추적

### 10. 로깅
- ✅ Winston 기반 구조화된 로깅
- ✅ 파일 로테이션
- ✅ 개발/프로덕션 모드 분리
- ✅ 로그 보존 정책

### 11. 설정 관리
- ✅ 중앙화된 설정 시스템
- ✅ 프로필 관리
- ✅ URL 설정 (홈, 로그인)
- ✅ 카테고리 관리
- ✅ 일정 상수 관리

### 12. 테스트
- ✅ E2E 테스트 인프라 (Playwright)
- ✅ 유닛 테스트 (Vitest)
- ✅ CI/CD 통합
- ✅ 테스트 커버리지

## 🔧 기술 스택

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Desktop**: Electron 28
- **Automation**: Playwright 1.57
- **Database**: Supabase (PostgreSQL)
- **Storage**: IndexedDB (idb)
- **Logging**: Winston
- **Testing**: Vitest, Playwright
- **Package Manager**: pnpm (workspace)

## 📦 설치 방법

### Windows
1. [보탬e-관리자-Setup-1.0.0.exe](https://github.com/gopeace88/botaem/releases/download/v1.0.0/보탬e-관리자-Setup-1.0.0.exe) 다운로드
2. 설치 프로그램 실행
3. 설치 완료 후 바로 사용

### macOS
1. [보탬e-관리자-1.0.0.dmg](https://github.com/gopeace88/botaem/releases/download/v1.0.0/보탬e-관리자-1.0.0.dmg) 다운로드
2. DMG 파일 열기
3. Applications 폴더로 드래그

### Linux
1. [보탬e-관리자-1.0.0.AppImage](https://github.com/gopeace88/botaem/releases/download/v1.0.0/보탬e-관리자-1.0.0.AppImage) 다운로드
2. 실행 권한 부여: `chmod +x 보탬e-관리자-1.0.0.AppImage`
3. 실행: `./보탬e-관리자-1.0.0.AppImage`

## 🚀 빠른 시작

1. **API Key 설정**
   - 첫 실행 시 API Key 설정 화면이 나타납니다
   - Anthropic API Key와 Supabase Key를 입력하세요

2. **Supabase 연동** (선택)
   - 설정 화면에서 Supabase URL과 Key를 입력
   - 카탈로그 기능과 클라우드 동기화 사용 가능

3. **플레이북 생성**
   - "녹화 시작" 버튼 클릭
   - 브라우저에서 원하는 동작 수행
   - "녹화 중지"로 완료
   - 메타데이터 입력 후 저장

4. **플레이북 실행**
   - 플레이북 목록에서 실행할 플레이북 선택
   - "실행" 버튼 클릭
   - 자동으로 플레이백 시작

## 📊 성능

- **시작 시간**: < 5초
- **플레이북 로드**: < 1초
- **실행 속도**: 10단계 < 30초
- **메모리 사용**: 100개 플레이북 < 100MB
- **자동 고침**: < 5초

## 🐛 알려진 문제점

1. **Linux IME 지원**: fcitx 사용자는 입력기 설정이 필요할 수 있습니다
2. **대형 플레이북**: 100개 이상의 스텝이 있는 플레이북은 성능이 저하될 수 있습니다

## 🔄 업그레이드

이전 버전에서 업그레이드하는 경우:
1. 자동 업데이트 알림이 표시되면 "지금 업데이트" 클릭
2. 다운로드 완료 후 "재시작하여 설치"
3. 업데이트가 자동으로 설치됩니다

## 📝 다음 릴리스 (v1.1.0) 예정 기능

- [ ] 플레이북 스케줄링
- [ ] 이메일 알림
- [ ] 고급 필터링 및 검색
- [ ] 플레이북 템플릿
- [ ] 사용자 권한 관리
- [ ] 감사 로그

## 🙏 기여

이 프로젝트는 오픈 소스입니다. 기여하고 싶으시다면:
- 버그 리포트: [GitHub Issues](https://github.com/gopeace88/botaem/issues)
- 기능 요청: [GitHub Discussions](https://github.com/gopeace88/botaem/discussions)
- PR: [GitHub Pull Requests](https://github.com/gopeace88/botaem/pulls)

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요

## 📞 지원

문의사항이 있으시면:
- 이메일: support@botame.io
- GitHub: [https://github.com/gopeace88/botaem](https://github.com/gopeace88/botaem)

---

**축하합니다! 보탬e 관리자 v1.0.0을 사용해 주셔서 감사합니다! 🎉**
