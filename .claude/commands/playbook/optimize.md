---
allowed-tools: Read, Edit, Write
argument-hint: [playbook-file.json]
description: 플레이북 최적화. 셀렉터 강화, fallback 추가, 구조 개선.
---
# Playbook Optimization

## Target
최적화 대상: $ARGUMENTS

## Process

selector-healer agent와 playbook-developer agent를 사용하여:

### 1. 현재 플레이북 로드
파일 내용 확인 및 구조 파악

### 2. 셀렉터 분석
각 스텝의 셀렉터 품질 평가

### 3. 최적화 수행

#### 3.1 Fallback 강화
- 3개 미만인 셀렉터에 fallback 추가
- 전략 다양성 확보 (text + aria + css)

#### 3.2 losims 특화 적용
- frame 컨텍스트 확인
- 동적 ID → 안정적 셀렉터로 교체

#### 3.3 메타데이터 보강
- text, ariaLabel 추가
- 동적 탐색용 키워드 확보

### 4. 검증
- JSON 유효성
- 스키마 준수

## Optimization Checklist
- [ ] 모든 셀렉터에 fallback 3개 이상
- [ ] text/aria/css 전략 혼합
- [ ] frame 컨텍스트 명시 (#mainFrame)
- [ ] 적절한 timeout 설정 (기본 30000ms)
- [ ] message 명확성 (키워드 추출 가능)
- [ ] 동적 ID 제거

## Output
최적화된 플레이북 파일 저장 및 변경 사항 요약.
