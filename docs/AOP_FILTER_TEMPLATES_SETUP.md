# AOP Filter Templates – Database Setup

Create the `aop_filter_templates` table so the AOP page can save, load, update, and delete filter templates.

**Option 1 – Supabase Dashboard**

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Run the table migration: copy and run `supabase/migrations/20250202000000_create_aop_filter_templates.sql`.
3. Run the UPDATE/DELETE policies: copy and run `supabase/migrations/20250202100000_aop_filter_templates_update_delete_policies.sql`.

**Option 2 – Supabase MCP**

If the Supabase MCP server is configured and authenticated in Cursor, run the same SQL (both migration files) via the MCP execute-SQL tool.

After both migrations, the AOP page “See filter”, “Save as template”, “Update template”, and “Delete template” features will work.
