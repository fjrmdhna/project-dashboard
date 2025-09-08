-- =====================================================
-- Table: site_data_5g
-- Description: 5G site data table for project dashboard
-- Created: 2025-09-02
-- =====================================================

-- Drop table if exists (for development/testing)
-- DROP TABLE IF EXISTS public.site_data_5g;

-- Create the site_data_5g table
CREATE TABLE public.site_data_5g (
    system_key text NOT NULL,
    "SBOQ.project_type" text NULL,
    vendor_code text NULL,
    vendor_name text NULL,
    wbs_status text NULL,
    site_id text NULL,
    site_name text NULL,
    new_site_id text NULL,
    new_site_name text NULL,
    unique_id text NULL,
    relo_id text NULL,
    relo_name text NULL,
    site_category text NULL,
    po_number text NULL,
    po_subline text NULL,
    network_header text NULL,
    year text NULL,
    program_name text NULL,
    project_name text NULL,
    program text NULL,
    program_report text NULL,
    ran_score text NULL,
    region text NULL,
    region_wise text NULL,
    region_circle text NULL,
    nano_cluster text NULL,
    twr_owner text NULL,
    long double precision NULL,
    lat double precision NULL,
    scope_of_work text NULL,
    issue_category text NULL,
    site_status text NULL,
    highlevel_issue text NULL,
    ran_scope text NULL,
    scope_category text NULL,
    imp_ttp text NULL,
    mc_cluster text NULL,
    imp_integ_ff timestamp without time zone NULL,
    imp_integ_af timestamp without time zone NULL,
    rfs_ff timestamp without time zone NULL,
    rfs_af timestamp without time zone NULL,
    rfc_approved timestamp without time zone NULL,
    hotnews_af timestamp without time zone NULL,
    endorse_af timestamp without time zone NULL,
    pac_accepted_af timestamp without time zone NULL,
    5g_readiness_date timestamp without time zone NULL,
    5g_activation_date timestamp without time zone NULL,
    cx_submitted timestamp without time zone NULL,
    cx_approved timestamp without time zone NULL,
    cx_acceptance_status text NULL,
    cx_remark text NULL,
    created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
    "RF_Fusion.cutover_af" timestamp without time zone NULL,
    rfs_bf timestamp without time zone NULL,
    mocn_activation_forecast timestamp without time zone NULL,
    rfs_forecast_lock timestamp without time zone NULL,
    caf_approved timestamp without time zone NULL,
    mos_af timestamp without time zone NULL,
    cluster_acceptance_af timestamp without time zone NULL,
    ic_000040_af timestamp without time zone NULL,
    CONSTRAINT site_data_5g_pkey PRIMARY KEY (system_key)
);

-- Add comments to table and columns
COMMENT ON TABLE public.site_data_5g IS '5G site data table for project dashboard containing 5G-specific site information and milestones';
COMMENT ON COLUMN public.site_data_5g.system_key IS 'System key (Primary Key)';
COMMENT ON COLUMN public.site_data_5g."SBOQ.project_type" IS 'SBOQ project type information';
COMMENT ON COLUMN public.site_data_5g.vendor_code IS 'Vendor identification code';
COMMENT ON COLUMN public.site_data_5g.vendor_name IS 'Vendor company name';
COMMENT ON COLUMN public.site_data_5g.wbs_status IS 'Work Breakdown Structure status';
COMMENT ON COLUMN public.site_data_5g.site_id IS 'Original site identifier';
COMMENT ON COLUMN public.site_data_5g.site_name IS 'Original site name';
COMMENT ON COLUMN public.site_data_5g.new_site_id IS 'New site identifier';
COMMENT ON COLUMN public.site_data_5g.new_site_name IS 'New site name';
COMMENT ON COLUMN public.site_data_5g.unique_id IS 'Unique identifier for the record';
COMMENT ON COLUMN public.site_data_5g.relo_id IS 'Relocation identifier';
COMMENT ON COLUMN public.site_data_5g.relo_name IS 'Relocation name';
COMMENT ON COLUMN public.site_data_5g.site_category IS 'Site category classification';
COMMENT ON COLUMN public.site_data_5g.po_number IS 'Purchase Order number';
COMMENT ON COLUMN public.site_data_5g.po_subline IS 'Purchase Order subline';
COMMENT ON COLUMN public.site_data_5g.network_header IS 'Network header information';
COMMENT ON COLUMN public.site_data_5g.year IS 'Project year';
COMMENT ON COLUMN public.site_data_5g.program_name IS 'Program name';
COMMENT ON COLUMN public.site_data_5g.project_name IS 'Project name';
COMMENT ON COLUMN public.site_data_5g.program IS 'Program information';
COMMENT ON COLUMN public.site_data_5g.program_report IS 'Program report information';
COMMENT ON COLUMN public.site_data_5g.ran_score IS 'RAN score';
COMMENT ON COLUMN public.site_data_5g.region IS 'Geographic region';
COMMENT ON COLUMN public.site_data_5g.region_wise IS 'Region-wise information';
COMMENT ON COLUMN public.site_data_5g.region_circle IS 'Region circle information';
COMMENT ON COLUMN public.site_data_5g.nano_cluster IS 'Nano cluster information';
COMMENT ON COLUMN public.site_data_5g.twr_owner IS 'Tower owner information';
COMMENT ON COLUMN public.site_data_5g.long IS 'Longitude coordinate';
COMMENT ON COLUMN public.site_data_5g.lat IS 'Latitude coordinate';
COMMENT ON COLUMN public.site_data_5g.scope_of_work IS 'Scope of work description';
COMMENT ON COLUMN public.site_data_5g.issue_category IS 'Issue category classification';
COMMENT ON COLUMN public.site_data_5g.site_status IS 'Current site status';
COMMENT ON COLUMN public.site_data_5g.highlevel_issue IS 'High-level issue description';
COMMENT ON COLUMN public.site_data_5g.ran_scope IS 'RAN scope information';
COMMENT ON COLUMN public.site_data_5g.scope_category IS 'Scope category classification';
COMMENT ON COLUMN public.site_data_5g.imp_ttp IS 'Implementation TTP information';
COMMENT ON COLUMN public.site_data_5g.mc_cluster IS 'MC cluster information';
COMMENT ON COLUMN public.site_data_5g.imp_integ_ff IS 'Implementation integration forecast date';
COMMENT ON COLUMN public.site_data_5g.imp_integ_af IS 'Implementation integration actual date';
COMMENT ON COLUMN public.site_data_5g.rfs_ff IS 'RFS forecast date';
COMMENT ON COLUMN public.site_data_5g.rfs_af IS 'RFS actual date';
COMMENT ON COLUMN public.site_data_5g.rfc_approved IS 'RFC approval date';
COMMENT ON COLUMN public.site_data_5g.hotnews_af IS 'Hot news actual date';
COMMENT ON COLUMN public.site_data_5g.endorse_af IS 'Endorsement actual date';
COMMENT ON COLUMN public.site_data_5g.pac_accepted_af IS 'PAC acceptance actual date';
COMMENT ON COLUMN public.site_data_5g.5g_readiness_date IS '5G readiness date';
COMMENT ON COLUMN public.site_data_5g.5g_activation_date IS '5G activation date';
COMMENT ON COLUMN public.site_data_5g.cx_submitted IS 'CX submission date';
COMMENT ON COLUMN public.site_data_5g.cx_approved IS 'CX approval date';
COMMENT ON COLUMN public.site_data_5g.cx_acceptance_status IS 'CX acceptance status';
COMMENT ON COLUMN public.site_data_5g.cx_remark IS 'CX remarks or notes';
COMMENT ON COLUMN public.site_data_5g."RF_Fusion.cutover_af" IS 'RF Fusion cutover actual date';
COMMENT ON COLUMN public.site_data_5g.rfs_bf IS 'RFS before date';
COMMENT ON COLUMN public.site_data_5g.mocn_activation_forecast IS 'MOCN activation forecast date';
COMMENT ON COLUMN public.site_data_5g.rfs_forecast_lock IS 'RFS forecast lock date';
COMMENT ON COLUMN public.site_data_5g.caf_approved IS 'CAF approval date';
COMMENT ON COLUMN public.site_data_5g.mos_af IS 'MOS actual date';
COMMENT ON COLUMN public.site_data_5g.cluster_acceptance_af IS 'Cluster acceptance actual date';
COMMENT ON COLUMN public.site_data_5g.ic_000040_af IS 'IC 000040 actual date';

-- Create indexes for better performance
CREATE INDEX idx_site_data_5g_system_key ON public.site_data_5g(system_key);
CREATE INDEX idx_site_data_5g_site_id ON public.site_data_5g(site_id);
CREATE INDEX idx_site_data_5g_site_name ON public.site_data_5g(site_name);
CREATE INDEX idx_site_data_5g_vendor_code ON public.site_data_5g(vendor_code);
CREATE INDEX idx_site_data_5g_site_status ON public.site_data_5g(site_status);
CREATE INDEX idx_site_data_5g_region ON public.site_data_5g(region);
CREATE INDEX idx_site_data_5g_year ON public.site_data_5g(year);
CREATE INDEX idx_site_data_5g_program_name ON public.site_data_5g(program_name);
CREATE INDEX idx_site_data_5g_created_at ON public.site_data_5g(created_at);

-- Create a function to automatically update updated_at timestamp (if not exists)
-- This function should already exist from site_data table creation
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = CURRENT_TIMESTAMP;
--     RETURN NEW;
-- END;
-- $$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_site_data_5g_updated_at 
    BEFORE UPDATE ON public.site_data_5g 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (optional)
-- INSERT INTO public.site_data_5g (system_key, site_id, site_name, vendor_name, site_status, region, year, program_name) 
-- VALUES 
--     ('5G_KEY001', '5G_SITE001', 'Jakarta 5G Tower', 'Vendor A', 'Active', 'Jakarta', '2025', '5G Rollout Program'),
--     ('5G_KEY002', '5G_SITE002', 'Bandung 5G Center', 'Vendor B', 'Planning', 'Bandung', '2025', '5G Rollout Program'),
--     ('5G_KEY003', '5G_SITE003', 'Surabaya 5G Hub', 'Vendor C', 'In Progress', 'Surabaya', '2025', '5G Rollout Program');

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON TABLE public.site_data_5g TO project_user;
-- GRANT USAGE, SELECT ON SEQUENCE public.site_data_5g_id_seq TO project_user; 