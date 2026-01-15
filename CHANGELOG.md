# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-15

### Added
- **Initial Release**
  - 플레이북 관리 시스템 (생성, 편집, 삭제, 가져오기/내보내기)
  - 브라우저 동작 녹화 기능
  - 플레이북 자동 실행 (Playbook Runner)
  - 셀렉터 자동 고침 (Self-Healing) 시스템
  - Supabase 클라우드 동기화
  - 카탈로그 기능 (DB 전체 조회)
  - IndexedDB 기반 오프라인 모드
  - API Key 안전한 저장소 (OS 네이티브 암호화)
  - GitHub Releases 기반 자동 업데이트
  - Winston 기반 구조화된 로깅
  - 실시계 시스템 모니터링 대시보드
  - 서킷 브레이커 패턴
  - 중앙화된 설정 시스템
  - E2E 테스트 인프라 (Playwright)
  - 유닛 테스트 (Vitest)
  - CI/CD 파이프라인
  - 성능 벤치마크 도구

### Security
- Electron 샌드박스 활성화
- 컨텍스트 격리 (contextIsolation: true)
- 안전한 IPC 통신 채널 화이트리스트
- API Key OS 레벨 암호화 (safeStorage)

### Performance
- 플레이북 로드 < 1초
- 시작 시간 < 5초
- 10단계 실행 < 30초
- 자동 고침 < 5초
- 메모리 사용량 최적화

### Documentation
- 사용자 가이드
- 개발자 문서
- API 문서
- 릴리스 노트
- 기여 가이드라인

## [Unreleased]

### Planned
- 플레이북 스케줄링
- 이메일 알림
- 고급 필터링 및 검색
- 플레이북 템플릿
- 사용자 권한 관리
- 감사 로그

---

## Version Guidelines

### Major Version (X.0.0)
- 호환되지 않는 API 변경
- 기존 기능 제거
- 아키텍처 주요 변경

### Minor Version (0.X.0)
- 새로운 기능 추가 (기존 기능과 호환)
- UI/UX 개선
- 성능 개선

### Patch Version (0.0.X)
- 버그 수정
- 보안 패치
- 문서 수정
- 작은 성능 개선

---

## Release Process

1. 모든 기능 구현 완료
2. 테스트 통과 (Unit + E2E)
3. 코드 리뷰 완료
4. 문서 업데이트
5. 릴리스 노트 작성
6. 버전 태그 생성
7. GitHub 릴리스 생성
8. 빌드 및 배포
9. 공지사항 게시
