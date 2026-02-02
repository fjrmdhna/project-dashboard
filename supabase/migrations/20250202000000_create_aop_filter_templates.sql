-- AOP Filter Templates: shared filter presets for AOP page
-- Run this in Supabase Dashboard > SQL Editor, or via Supabase MCP execute_sql

CREATE TABLE IF NOT EXISTS aop_filter_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Optional: unique name to avoid duplicates (remove if you allow same name)
-- CREATE UNIQUE INDEX IF NOT EXISTS aop_filter_templates_name_key ON aop_filter_templates (name);

-- Optional: trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS aop_filter_templates_updated_at ON aop_filter_templates;
CREATE TRIGGER aop_filter_templates_updated_at
  BEFORE UPDATE ON aop_filter_templates
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- RLS: allow read and insert for anon (adjust if you use auth)
ALTER TABLE aop_filter_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read aop_filter_templates" ON aop_filter_templates
  FOR SELECT USING (true);

CREATE POLICY "Allow insert aop_filter_templates" ON aop_filter_templates
  FOR INSERT WITH CHECK (true);
