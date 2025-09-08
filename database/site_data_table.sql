-- =====================================================
-- Table: site_data
-- Description: Site data table for project dashboard
-- Created: 2025-09-02
-- =====================================================

-- Drop table if exists (for development/testing)
-- DROP TABLE IF EXISTS public.site_data;

-- Create the site_data table
CREATE TABLE public.site_data (
    id serial NOT NULL,
    site_id text NULL,
    site_name text NULL,
    mc_cluster text NULL,
    dati_ii text NULL,
    scope_of_work text NULL,
    ran_scope text NULL,
    latitude double precision NULL,
    longitude double precision NULL,
    nano_cluster text NULL,
    survey_ff timestamp without time zone NULL,
    survey_bf timestamp without time zone NULL,
    survey_af timestamp without time zone NULL,
    mos_ff timestamp without time zone NULL,
    mos_bf timestamp without time zone NULL,
    mos_af timestamp without time zone NULL,
    cutover_ff timestamp without time zone NULL,
    cutover_bf timestamp without time zone NULL,
    cutover_af timestamp without time zone NULL,
    site_dismantle_ff timestamp without time zone NULL,
    site_dismantle_bf timestamp without time zone NULL,
    site_dismantle_af timestamp without time zone NULL,
    created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
    system_key text NOT NULL,
    cx_approved timestamp without time zone NULL,
    site_status text NULL,
    hotnews_af timestamp without time zone NULL,
    sales_area text NULL,
    year text NULL,
    swap_weekly_plan text NULL,
    swap_monthly_plan text NULL,
    swap_time_sec1_ff text NULL,
    swap_time_sec2_ff text NULL,
    swap_time_sec3_ff text NULL,
    swap_time_sec1_af text NULL,
    swap_time_sec2_af text NULL,
    swap_time_sec3_af text NULL,
    area text NULL,
    rfs_af timestamp without time zone NULL,
    ready_for_acpt_date timestamp without time zone NULL,
    rfc_submitted timestamp without time zone NULL,
    rfc_approved timestamp without time zone NULL,
    endorse_af timestamp without time zone NULL,
    pac_accepted_af timestamp without time zone NULL,
    cluster_acceptance_af timestamp without time zone NULL,
    fac_af timestamp without time zone NULL,
    site_blocking text NULL,
    scope_strategy text NULL,
    wbs_status text NULL,
    mocn_activation_forecast timestamp without time zone NULL,
    hybrid_optimization_af timestamp without time zone NULL,
    site_program text NULL,
    remarks text NULL,
    5g_activation_date timestamp without time zone NULL,
    5g_readiness_date timestamp without time zone NULL,
    CONSTRAINT site_data_pkey PRIMARY KEY (system_key)
);

-- Add comments to table and columns
COMMENT ON TABLE public.site_data IS 'Site data table for project dashboard containing site information and milestones';
COMMENT ON COLUMN public.site_data.id IS 'Auto-incrementing primary key';
COMMENT ON COLUMN public.site_data.site_id IS 'Unique site identifier';
COMMENT ON COLUMN public.site_data.site_name IS 'Name of the site';
COMMENT ON COLUMN public.site_data.mc_cluster IS 'MC cluster information';
COMMENT ON COLUMN public.site_data.dati_ii IS 'DATI II information';
COMMENT ON COLUMN public.site_data.scope_of_work IS 'Scope of work description';
COMMENT ON COLUMN public.site_data.ran_scope IS 'RAN scope information';
COMMENT ON COLUMN public.site_data.latitude IS 'Site latitude coordinate';
COMMENT ON COLUMN public.site_data.longitude IS 'Site longitude coordinate';
COMMENT ON COLUMN public.site_data.nano_cluster IS 'Nano cluster information';
COMMENT ON COLUMN public.site_data.system_key IS 'System key (Primary Key)';
COMMENT ON COLUMN public.site_data.site_status IS 'Current status of the site';
COMMENT ON COLUMN public.site_data.sales_area IS 'Sales area information';
COMMENT ON COLUMN public.site_data.year IS 'Year information';
COMMENT ON COLUMN public.site_data.area IS 'Area information';
COMMENT ON COLUMN public.site_data.remarks IS 'Additional remarks or notes';

-- Create indexes for better performance
CREATE INDEX idx_site_data_site_id ON public.site_data(site_id);
CREATE INDEX idx_site_data_site_name ON public.site_data(site_name);
CREATE INDEX idx_site_data_site_status ON public.site_data(site_status);
CREATE INDEX idx_site_data_sales_area ON public.site_data(sales_area);
CREATE INDEX idx_site_data_year ON public.site_data(year);
CREATE INDEX idx_site_data_created_at ON public.site_data(created_at);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_site_data_updated_at 
    BEFORE UPDATE ON public.site_data 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (optional)
-- INSERT INTO public.site_data (site_id, site_name, system_key, site_status, sales_area, year) 
-- VALUES 
--     ('SITE001', 'Sample Site 1', 'KEY001', 'Active', 'Area A', '2025'),
--     ('SITE002', 'Sample Site 2', 'KEY002', 'Planning', 'Area B', '2025');

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON TABLE public.site_data TO project_user;
-- GRANT USAGE, SELECT ON SEQUENCE public.site_data_id_seq TO project_user; 