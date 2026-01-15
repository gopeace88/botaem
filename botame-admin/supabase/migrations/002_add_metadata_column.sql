ALTER TABLE playbooks
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_playbooks_metadata
ON playbooks USING GIN (metadata jsonb_path_ops);

UPDATE playbooks
SET metadata = jsonb_build_object(
  'startUrl', '',
  'aliases', jsonb_build_array()
)
WHERE metadata IS NULL OR metadata = '{}'::jsonb;

COMMENT ON COLUMN playbooks.metadata IS 'Playbook metadata including startUrl, aliases, etc.';

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'playbooks'
  AND column_name = 'metadata';
