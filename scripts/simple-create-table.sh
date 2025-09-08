#!/bin/bash

echo "🗄️ Creating site_data table in PostgreSQL..."
echo "============================================="

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

# Check if table exists
if docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_data');" 2>/dev/null | grep -q "t"; then
    echo "⚠️ Table site_data already exists"
    echo "Dropping existing table..."
    docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "DROP TABLE IF EXISTS public.site_data CASCADE;" > /dev/null 2>&1
    echo "✅ Existing table dropped"
fi

echo "📝 Creating site_data table..."

# Create table directly with SQL
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "
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
    \"5g_activation_date\" timestamp without time zone NULL,
    \"5g_readiness_date\" timestamp without time zone NULL,
    CONSTRAINT site_data_pkey PRIMARY KEY (system_key)
);
"

if [ $? -eq 0 ]; then
    echo "✅ Table site_data created successfully"
else
    echo "❌ Failed to create table"
    exit 1
fi

# Create indexes
echo "📊 Creating indexes..."
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "
CREATE INDEX idx_site_data_site_id ON public.site_data(site_id);
CREATE INDEX idx_site_data_site_name ON public.site_data(site_name);
CREATE INDEX idx_site_data_site_status ON public.site_data(site_status);
CREATE INDEX idx_site_data_sales_area ON public.site_data(sales_area);
CREATE INDEX idx_site_data_year ON public.site_data(year);
CREATE INDEX idx_site_data_created_at ON public.site_data(created_at);
"

# Create trigger function and trigger
echo "🔧 Creating trigger for updated_at..."
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
\$\$ language 'plpgsql';

CREATE TRIGGER update_site_data_updated_at 
    BEFORE UPDATE ON public.site_data 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
"

# Insert sample data
echo "📝 Inserting sample data..."
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "
INSERT INTO public.site_data (site_id, site_name, system_key, site_status, sales_area, year, mc_cluster, scope_of_work) 
VALUES 
    ('SITE001', 'Jakarta Central Tower', 'KEY001', 'Active', 'Jakarta', '2025', 'Cluster A', 'Site Modernization'),
    ('SITE002', 'Bandung City Center', 'KEY002', 'Planning', 'Bandung', '2025', 'Cluster B', 'New Site Installation'),
    ('SITE003', 'Surabaya Business District', 'KEY003', 'In Progress', 'Surabaya', '2025', 'Cluster C', 'Equipment Upgrade');
"

# Verify table creation
echo "🔍 Verifying table creation..."
echo ""
echo "Table structure:"
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "\d public.site_data"

echo ""
echo "Sample data:"
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT site_id, site_name, system_key, site_status, sales_area FROM public.site_data;"

echo ""
echo "🎉 Table site_data created successfully!"
echo "✅ Ready for use in your project dashboard" 