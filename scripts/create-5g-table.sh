#!/bin/bash

echo "🗄️ Creating site_data_5g table in PostgreSQL..."
echo "=============================================="

# Check if PostgreSQL container is running
if ! docker ps | grep -q "project_dashboard_postgres_dev"; then
    echo "❌ PostgreSQL container is not running"
    echo "Please start it first: docker-compose -f docker-compose.dev.yml up -d postgres"
    exit 1
fi

echo "✅ PostgreSQL container is running"

# Check database connection
if ! docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Database connection failed"
    exit 1
fi

echo "✅ Database connection successful"

# Check if table already exists
if docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_data_5g');" 2>/dev/null | grep -q "t"; then
    echo "⚠️ Table site_data_5g already exists"
    echo "Dropping existing table..."
    docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "DROP TABLE IF EXISTS public.site_data_5g CASCADE;" > /dev/null 2>&1
    echo "✅ Existing table dropped"
fi

echo "📝 Creating site_data_5g table..."

# Create table directly with SQL
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "
CREATE TABLE public.site_data_5g (
    system_key text NOT NULL,
    \"SBOQ.project_type\" text NULL,
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
    \"5g_readiness_date\" timestamp without time zone NULL,
    \"5g_activation_date\" timestamp without time zone NULL,
    cx_submitted timestamp without time zone NULL,
    cx_approved timestamp without time zone NULL,
    cx_acceptance_status text NULL,
    cx_remark text NULL,
    created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
    \"RF_Fusion.cutover_af\" timestamp without time zone NULL,
    rfs_bf timestamp without time zone NULL,
    mocn_activation_forecast timestamp without time zone NULL,
    rfs_forecast_lock timestamp without time zone NULL,
    caf_approved timestamp without time zone NULL,
    mos_af timestamp without time zone NULL,
    cluster_acceptance_af timestamp without time zone NULL,
    ic_000040_af timestamp without time zone NULL,
    CONSTRAINT site_data_5g_pkey PRIMARY KEY (system_key)
);
"

if [ $? -eq 0 ]; then
    echo "✅ Table site_data_5g created successfully"
else
    echo "❌ Failed to create table"
    exit 1
fi

# Create indexes
echo "📊 Creating indexes..."
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "
CREATE INDEX idx_site_data_5g_system_key ON public.site_data_5g(system_key);
CREATE INDEX idx_site_data_5g_site_id ON public.site_data_5g(site_id);
CREATE INDEX idx_site_data_5g_site_name ON public.site_data_5g(site_name);
CREATE INDEX idx_site_data_5g_vendor_code ON public.site_data_5g(vendor_code);
CREATE INDEX idx_site_data_5g_site_status ON public.site_data_5g(site_status);
CREATE INDEX idx_site_data_5g_region ON public.site_data_5g(region);
CREATE INDEX idx_site_data_5g_year ON public.site_data_5g(year);
CREATE INDEX idx_site_data_5g_program_name ON public.site_data_5g(program_name);
CREATE INDEX idx_site_data_5g_created_at ON public.site_data_5g(created_at);
"

# Create trigger
echo "🔧 Creating trigger for updated_at..."
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "
CREATE TRIGGER update_site_data_5g_updated_at 
    BEFORE UPDATE ON public.site_data_5g 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
"

# Insert sample data
echo "📝 Inserting sample data..."
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "
INSERT INTO public.site_data_5g (system_key, site_id, site_name, vendor_name, site_status, region, year, program_name, \"SBOQ.project_type\", vendor_code) 
VALUES 
    ('5G_KEY001', '5G_SITE001', 'Jakarta 5G Tower', 'Vendor A', 'Active', 'Jakarta', '2025', '5G Rollout Program', '5G Infrastructure', 'VEND001'),
    ('5G_KEY002', '5G_SITE002', 'Bandung 5G Center', 'Vendor B', 'Planning', 'Bandung', '2025', '5G Rollout Program', '5G Infrastructure', 'VEND002'),
    ('5G_KEY003', '5G_SITE003', 'Surabaya 5G Hub', 'Vendor C', 'In Progress', 'Surabaya', '2025', '5G Rollout Program', '5G Infrastructure', 'VEND003');
"

# Verify table creation
echo "🔍 Verifying table creation..."
echo ""
echo "Table structure:"
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "\d public.site_data_5g"

echo ""
echo "Sample data:"
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT system_key, site_id, site_name, vendor_name, site_status, region FROM public.site_data_5g;"

echo ""
echo "🎉 Table site_data_5g created successfully!"
echo "✅ Ready for use in your project dashboard" 