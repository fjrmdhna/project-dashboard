-- Migration: AOP Performance Indexes
-- Description: Menambahkan indexes untuk optimasi performa query pada tabel site_data_aop
-- Created: 2025-01-XX

-- Indexes untuk filter columns (sering digunakan dalam WHERE clause)
CREATE INDEX IF NOT EXISTS idx_site_data_aop_vendor_name ON site_data_aop(vendor_name);
CREATE INDEX IF NOT EXISTS idx_site_data_aop_program_report ON site_data_aop(program_report);
CREATE INDEX IF NOT EXISTS idx_site_data_aop_region_circle ON site_data_aop(region_circle);
CREATE INDEX IF NOT EXISTS idx_site_data_aop_site_category ON site_data_aop(site_category);

-- Composite index untuk kombinasi filter yang sering digunakan bersama
-- Index ini akan mempercepat query dengan multiple filter conditions
CREATE INDEX IF NOT EXISTS idx_site_data_aop_filters ON site_data_aop(vendor_name, program_report, region_circle, site_category);

-- Partial indexes untuk milestone columns (hanya index rows dengan nilai NOT NULL)
-- Partial indexes lebih kecil dan lebih cepat untuk queries yang filter by milestone
CREATE INDEX IF NOT EXISTS idx_site_data_aop_rfi_accepted ON site_data_aop(rfi_accepted) WHERE rfi_accepted IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_site_data_aop_mos_af ON site_data_aop(mos_af) WHERE mos_af IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_site_data_aop_ic_000040_af ON site_data_aop(ic_000040_af) WHERE ic_000040_af IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_site_data_aop_imp_integ_af ON site_data_aop(imp_integ_af) WHERE imp_integ_af IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_site_data_aop_rfs_af ON site_data_aop(rfs_af) WHERE rfs_af IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_site_data_aop_rfc_approved ON site_data_aop(rfc_approved) WHERE rfc_approved IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_site_data_aop_fatp_accepted_af ON site_data_aop(fatp_accepted_af) WHERE fatp_accepted_af IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_site_data_aop_hotnews_af ON site_data_aop(hotnews_af) WHERE hotnews_af IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_site_data_aop_endorse_af ON site_data_aop(endorse_af) WHERE endorse_af IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_site_data_aop_pac_accepted_af ON site_data_aop(pac_accepted_af) WHERE pac_accepted_af IS NOT NULL;

-- Index untuk issue_category (digunakan di top-5-issue API)
CREATE INDEX IF NOT EXISTS idx_site_data_aop_issue_category ON site_data_aop(issue_category) WHERE issue_category IS NOT NULL;

-- Index untuk search columns (system_key, site_id, site_name)
CREATE INDEX IF NOT EXISTS idx_site_data_aop_system_key ON site_data_aop(system_key);
CREATE INDEX IF NOT EXISTS idx_site_data_aop_site_id ON site_data_aop(site_id) WHERE site_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_site_data_aop_site_name ON site_data_aop(site_name) WHERE site_name IS NOT NULL;

-- Index untuk date columns yang digunakan di daily-runrate (rfs_ff, rfs_af)
CREATE INDEX IF NOT EXISTS idx_site_data_aop_rfs_ff ON site_data_aop(rfs_ff) WHERE rfs_ff IS NOT NULL;

-- Comments untuk dokumentasi
COMMENT ON INDEX idx_site_data_aop_vendor_name IS 'Index untuk filter vendor_name pada AOP queries';
COMMENT ON INDEX idx_site_data_aop_program_report IS 'Index untuk filter program_report pada AOP queries';
COMMENT ON INDEX idx_site_data_aop_region_circle IS 'Index untuk filter region_circle pada AOP queries';
COMMENT ON INDEX idx_site_data_aop_site_category IS 'Index untuk filter site_category pada AOP queries';
COMMENT ON INDEX idx_site_data_aop_filters IS 'Composite index untuk kombinasi filter yang sering digunakan';
COMMENT ON INDEX idx_site_data_aop_rfi_accepted IS 'Partial index untuk milestone CRFI (rfi_accepted)';
COMMENT ON INDEX idx_site_data_aop_mos_af IS 'Partial index untuk milestone MOS';
COMMENT ON INDEX idx_site_data_aop_ic_000040_af IS 'Partial index untuk milestone INSTALL';
COMMENT ON INDEX idx_site_data_aop_imp_integ_af IS 'Partial index untuk milestone Readiness';
COMMENT ON INDEX idx_site_data_aop_rfs_af IS 'Partial index untuk milestone RFS/Activated';
