-- Supabase Migration: Add aliases field and smartSelector support
-- This migration adds support for self-healing features

-- 1. Add aliases to metadata (if not exists)
-- Note: Since metadata is JSONB, we can add aliases without altering table structure

-- Update existing playbooks to add empty aliases array if missing
UPDATE playbooks
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"aliases": []}'::jsonb
WHERE metadata IS NULL
  OR NOT (metadata ? 'aliases');

-- 2. Add start_url to metadata (for snake_case consistency)
UPDATE playbooks
SET metadata = COALESCE(metadata, '{}'::jsonb) ||
  CASE
    WHEN metadata ? 'startUrl' THEN jsonb_build_object('start_url', metadata->>'startUrl')
    ELSE '{}'::jsonb
  END
WHERE metadata IS NOT NULL
  AND metadata ? 'startUrl'
  AND NOT (metadata ? 'start_url');

-- 3. Create function to update playbook with smartSelector
CREATE OR REPLACE FUNCTION add_smart_selector_to_steps()
RETURNS void AS $$
DECLARE
  playbook_record RECORD;
  updated_steps JSONB;
BEGIN
  FOR playbook_record IN
    SELECT playbook_id, steps
    FROM playbooks
    WHERE steps IS NOT NULL
      AND jsonb_array_length(steps) > 0
  LOOP
    -- Add smartSelector to each step if missing
    updated_steps := (
      SELECT jsonb_agg(
        CASE
          WHEN NOT (step->'smartSelector' ? 'primary') THEN
            step || jsonb_build_object(
              'smartSelector',
              jsonb_build_object(
                'primary', jsonb_build_object(
                  'strategy', COALESCE(step->>'selectorType', 'css'),
                  'value', COALESCE(step->>'selector', ''),
                  'confidence', 80
                ),
                'fallbacks', jsonb_build_array(),
                'coordinates', jsonb_build_object(
                  'x', 0, 'y', 0, 'width', 0, 'height', 0
                ),
                'elementHash', '',
                'snapshot', NULL
              )
            )
          ELSE
            step
          END
      )
      FROM jsonb_array_elements(playbook_record.steps) AS step
    );

    -- Update playbook with new steps
    UPDATE playbooks
    SET steps = updated_steps,
        updated_at = NOW()
    WHERE playbook_id = playbook_record.playbook_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the function (uncomment to execute)
-- SELECT add_smart_selector_to_steps();

-- 4. Create index for playbook_id lookup
CREATE INDEX IF NOT EXISTS idx_playbooks_metadata_aliases
ON playbooks USING GIN (metadata jsonb_path_ops);

-- 5. Add comment for documentation
COMMENT ON COLUMN playbooks.metadata IS 'Extended metadata including aliases, startUrl, etc.';
COMMENT ON COLUMN playbooks.steps IS 'Playbook steps with smartSelector for self-healing';

-- 6. Create trigger to auto-generate aliases on insert
CREATE OR REPLACE FUNCTION generate_aliases_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure metadata exists
  IF NEW.metadata IS NULL THEN
    NEW.metadata := '{}'::jsonb;
  END IF;

  -- Generate aliases if missing
  IF NOT (NEW.metadata ? 'aliases') OR jsonb_array_length(NEW.metadata->'aliases') = 0 THEN
    NEW.metadata := NEW.metadata || jsonb_build_object(
      'aliases',
      jsonb_build_array(
        -- Add simple alias from first word
        split_part(NEW.name, ' ', 1)
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS playbooks_generate_aliases ON playbooks;
CREATE TRIGGER playbooks_generate_aliases
  BEFORE INSERT ON playbooks
  FOR EACH ROW
  EXECUTE FUNCTION generate_aliases_on_insert();

-- Verification queries
-- SELECT playbook_id, name, metadata->'aliases' as aliases
-- FROM playbooks
-- LIMIT 10;

-- SELECT playbook_id, name, jsonb_array_length(steps) as step_count,
--        steps->0->'smartSelector' as first_step_smart_selector
-- FROM playbooks
-- WHERE steps IS NOT NULL
-- LIMIT 5;
