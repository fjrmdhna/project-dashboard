-- Some dumped tables keep NOT NULL id without a sequence default.
-- Upload upserts only send business columns, so id must auto-generate.

DO $$
DECLARE
  t text;
  seq_name text;
  max_id bigint;
  is_identity text;
  has_default boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['site_data', 'site_data_aop']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'id'
    ) THEN
      CONTINUE;
    END IF;

    SELECT c.is_identity
    INTO is_identity
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = t AND c.column_name = 'id';

    IF is_identity IN ('YES', 'ALWAYS', 'BY DEFAULT') THEN
      CONTINUE;
    END IF;

    SELECT pg_get_expr(d.adbin, d.adrelid) IS NOT NULL
    INTO has_default
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relname = t AND a.attname = 'id' AND a.attnum > 0;

    IF has_default THEN
      CONTINUE;
    END IF;

    seq_name := t || '_id_seq';
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = seq_name) THEN
      EXECUTE format('CREATE SEQUENCE %I', seq_name);
    END IF;

    EXECUTE format('SELECT COALESCE(MAX(id), 1) FROM public.%I', t) INTO max_id;
    EXECUTE format('SELECT setval(%L, %s)', seq_name, GREATEST(max_id, 1));
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT nextval(%L)', t, seq_name);
    EXECUTE format('ALTER SEQUENCE %I OWNED BY public.%I.id', seq_name, t);
  END LOOP;
END
$$;
