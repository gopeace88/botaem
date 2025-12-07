# 보탬e 가이드 앱 설정 가이드

## 1. Supabase 프로젝트 생성

### 1.1 Supabase 대시보드 접속
1. https://supabase.com 에 접속
2. 로그인 후 "New Project" 클릭
3. 프로젝트 이름: `botame-guide` (또는 원하는 이름)
4. 데이터베이스 비밀번호 설정
5. Region: Northeast Asia (Seoul) 선택

### 1.2 데이터베이스 스키마 생성
1. Supabase 대시보드 > SQL Editor 이동
2. `supabase/migrations/001_initial_schema.sql` 파일 내용 복사
3. SQL Editor에 붙여넣기 후 "Run" 실행

### 1.3 API 키 확인
1. Settings > API 이동
2. 다음 값들을 복사:
   - Project URL: `https://[your-project-ref].supabase.co`
   - anon/public key: `eyJ...`

## 2. Claude API 키 설정

### 2.1 Anthropic Console에서 API 키 생성
1. https://console.anthropic.com 접속
2. API Keys 메뉴에서 새 키 생성
3. 키 값 복사 (보안 유지!)

### 2.2 Supabase에 API 키 설정
1. Supabase 대시보드 > Edge Functions > Secrets 이동
2. "New Secret" 클릭
3. Name: `CLAUDE_API_KEY`
4. Value: Claude API 키 붙여넣기

## 3. Edge Function 배포

### 3.1 Supabase CLI 설치 (선택사항)
```bash
npm install -g supabase
```

### 3.2 Edge Function 배포
```bash
# 프로젝트 루트에서
supabase login
supabase link --project-ref [your-project-ref]
supabase functions deploy chat
```

또는 Supabase 대시보드에서 직접 배포:
1. Edge Functions 메뉴 이동
2. "New Function" 클릭
3. `supabase/functions/chat/index.ts` 내용 붙여넣기
4. Deploy 클릭

## 4. 로컬 환경 설정

### 4.1 환경 변수 파일 생성
```bash
cp .env.example .env
```

### 4.2 .env 파일 편집
```env
VITE_SUPABASE_URL=https://[your-project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
VITE_BOTAME_URL=https://www.losims.go.kr/sp
```

## 5. 앱 실행

### 5.1 의존성 설치
```bash
npm install
```

### 5.2 개발 모드 실행
```bash
npm run dev
```

### 5.3 프로덕션 빌드
```bash
npm run build
npm run package
```

## 6. 사용 방법

### 6.1 앱 실행
1. 앱 시작 시 로그인 화면 표시
2. Supabase 계정으로 로그인 (첫 사용 시 회원가입)

### 6.2 보탬e 웹사이트 연동
1. 채팅창에 "보탬e 로그인" 입력
2. 브라우저가 열리면 보탬e 로그인 정보 입력
3. 로그인 후 AI가 웹사이트 제어 가능

### 6.3 AI와 대화
- "예산 등록해줘" → 예산 등록 플레이북 실행
- "지출 결의 도와줘" → 지출 결의 플레이북 실행
- 자연어로 질문하면 AI가 적절한 업무 안내

## 문제 해결

### Playwright 브라우저 오류
```bash
npx playwright install chromium
```

### TypeScript 컴파일 오류
```bash
npm run typecheck
```

### 테스트 실행
```bash
npm test
```
