# 보탬e 자동화 시스템

지방보조금관리시스템(보탬e) 반복 업무 자동화 도구

## 프로젝트 접근 방식

> **"사전 지식 기반 자동화"** - 문서 분석이 먼저, 코드 작성은 나중

본 프로젝트는 일반적인 RPA 방식(사이트 접속 → 셀렉터 추측 → 실패 → 수정 반복)이 아닌,
**사전 지식 구축 → 녹화 검증 → 안정적 실행** 순서로 진행됩니다.

```
Phase 1: 사전 지식 구축 (완료)
  - 21개 매뉴얼 분석 (118,167자)
  - 업무 계층구조 파악
  - 업무흐름도 수립
  - GUI 동작 예측

Phase 2: 녹화 및 검증 (진행 예정)
  - 사용자가 작업 선택
  - Playwright Codegen으로 실제 녹화
  - 사전 지식과 녹화 데이터 매칭
  - 불일치 시에만 LLM/의미분석 적용

Phase 3: 안정적 실행
  - 검증된 셀렉터로 자동화 실행
```

상세 아키텍처: [PROJECT_ARCHITECTURE.md](../PROJECT_ARCHITECTURE.md)

## 기능

| 자동화 유형 | 설명 | 자동화 수준 |
|------------|------|-----------|
| `card` | 카드사용내역 집행등록 | 완전 자동화 |
| `tax` | 전자세금계산서 집행등록 | 완전 자동화 |
| `transfer` | 집행이체 일괄처리 | 반자동화 (인증서 필요) |

## 설치

```bash
# 가상환경 생성
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 패키지 설치
pip install -r requirements.txt

# Playwright 브라우저 설치
playwright install chromium
```

## 설정

### 1. 환경 변수 (.env)

```bash
cp .env.example .env
# .env 파일 편집하여 실제 값 입력
```

```env
BOTAME_USER_ID=your_user_id
BOTAME_PASSWORD=your_password
BOTAME_FISCAL_YEAR=2024
BOTAME_PROJECT_CODE=your_project_code
```

### 2. 설정 파일 (config/settings.yaml)

비목 매핑 규칙, 알림 설정 등 상세 설정은 `config/settings.yaml`에서 수정합니다.

## 실행

```bash
# 카드사용내역 집행등록
python main.py card

# 전자세금계산서 집행등록
python main.py tax

# 집행이체 일괄처리 (인증서 인증 필요)
python main.py transfer

# 모든 자동화 순차 실행
python main.py all

# 사용 가능한 자동화 목록
python main.py --list
```

## 디렉토리 구조

```
automation/
├── main.py                    # 메인 실행 스크립트
├── requirements.txt           # Python 패키지 의존성
├── .env.example              # 환경변수 템플릿
├── config/
│   └── settings.yaml         # 상세 설정
├── src/
│   ├── __init__.py
│   ├── config.py             # 설정 로더
│   ├── logger.py             # 로깅 모듈
│   ├── browser.py            # 브라우저 관리
│   ├── botame.py             # 기본 자동화 클래스
│   ├── card_usage_automation.py    # 카드내역 자동화
│   ├── tax_invoice_automation.py   # 세금계산서 자동화
│   └── transfer_automation.py      # 이체 자동화
├── tests/                    # 테스트 코드
└── logs/                     # 로그 및 스크린샷
```

## 비목 매핑 규칙

`config/settings.yaml`에서 거래처명/업종별 비목 자동 매핑 규칙을 설정할 수 있습니다:

```yaml
automation:
  budget_mapping_rules:
    - vendor_type: "음식점"
      budget_item: "회의비"
      funding_type: "시도비"
    - vendor_name_contains: "택시"
      budget_item: "여비"
      funding_type: "시도비"
```

## 로그

- 콘솔: INFO 이상
- 파일: `logs/automation.log` (DEBUG 이상)
- 스크린샷: `logs/screenshots/` (오류 발생 시 자동 저장)

## 주의사항

1. **인증서 인증**: 집행이체는 공동인증서가 필요하여 수동 개입이 필요합니다.
2. **셀렉터 수정**: 실제 화면에 맞게 CSS 셀렉터 수정이 필요할 수 있습니다.
3. **테스트 환경**: 운영 환경 적용 전 테스트 환경에서 충분히 검증하세요.

## 라이선스

Private - 내부 사용 전용
