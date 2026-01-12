-- 기존 플레이북들의 start_url을 기본 URL로 업데이트
-- Supabase SQL Editor에서 실행하세요

-- 1. 먼저 현재 상태 확인
SELECT
  playbook_id,
  name,
  start_url,
  CASE
    WHEN start_url IS NULL OR start_url = '' THEN 'NEEDS UPDATE'
    ELSE 'OK'
  END as status
FROM playbooks
ORDER BY name;

-- 2. start_url이 비어있거나 NULL인 플레이북들 업데이트
UPDATE playbooks
SET
  start_url = 'https://www.losims.go.kr/lss.do',
  updated_at = NOW()
WHERE start_url IS NULL OR start_url = '';

-- 3. 업데이트 결과 확인
SELECT
  playbook_id,
  name,
  start_url,
  updated_at
FROM playbooks
ORDER BY name;
