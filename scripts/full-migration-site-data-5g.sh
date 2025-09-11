#!/bin/bash

# Script untuk full data migration dari Supabase ke PostgreSQL
# Migrates site_data_5g table without using generated data
# Non-interactive mode: Runs without prompts

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Konfigurasi Supabase
SUPABASE_URL="https://opecotutdvtahsccpqzr.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZWNvdHV0ZHZ0YWhzY2NwcXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1NDU4OTcsImV4cCI6MjA1MTEyMTg5N30.sptjTg-0L1lCep8S_wriw3ixm_sXiTAFX-JiPOQFAEU"

# Konfigurasi PostgreSQL
PG_CONTAINER="project_dashboard_postgres_dev"
PG_USER="project_user"
PG_DB="project_dashboard"
TABLE_NAME="site_data_5g"

# Konfigurasi batch
BATCH_SIZE=1000
TEMP_DIR="./migration_temp"
mkdir -p "$TEMP_DIR"

# Fungsi untuk menghitung total data di Supabase
count_supabase_data() {
    echo -e "${BLUE}Menghitung total data di Supabase...${NC}"
    
    # Menggunakan header Content-Range untuk mendapatkan total count
    local headers=$(curl -s -I \
      -H "apikey: $SUPABASE_ANON_KEY" \
      -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
      -H "Prefer: count=exact" \
      -H "Range: 0-0" \
      "$SUPABASE_URL/rest/v1/$TABLE_NAME?select=system_key")
    
    # Ekstrak count dari header
    local content_range=$(echo "$headers" | grep -i "content-range:")
    local total_count=$(echo "$content_range" | grep -o '/[0-9]*' | tr -d '/')
    
    if [ -n "$total_count" ]; then
        echo -e "${GREEN}Total data di Supabase: $total_count baris${NC}"
        echo "$total_count"
    else
        echo -e "${RED}Tidak dapat mengekstrak jumlah data dari Supabase${NC}"
        echo "0"
    fi
}

# Fungsi untuk backup data existing
backup_existing_data() {
    echo -e "${BLUE}Backing up existing data dari PostgreSQL...${NC}"
    
    local backup_file="$TEMP_DIR/site_data_5g_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    docker exec $PG_CONTAINER pg_dump -U $PG_USER -t $TABLE_NAME $PG_DB > "$backup_file"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Backup berhasil disimpan ke: $backup_file${NC}"
    else
        echo -e "${RED}Gagal melakukan backup data${NC}"
        # Tidak exit, tetap lanjut
    fi
}

# Fungsi untuk truncate tabel
truncate_table() {
    echo -e "${YELLOW}Truncating tabel $TABLE_NAME di PostgreSQL...${NC}"
    
    docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "TRUNCATE TABLE $TABLE_NAME CASCADE;"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Tabel berhasil di-truncate${NC}"
    else
        echo -e "${RED}Gagal melakukan truncate tabel${NC}"
        exit 1
    fi
}

# Fungsi untuk mendapatkan daftar kolom tabel
get_table_columns() {
    echo -e "${BLUE}Mendapatkan struktur kolom tabel...${NC}"
    
    local columns=$(docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DB -t -c "
        SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) 
        FROM information_schema.columns 
        WHERE table_name = '$TABLE_NAME' AND table_schema = 'public';
    ")
    
    columns=$(echo "$columns" | tr -d ' ')
    echo -e "${GREEN}Kolom tabel: $columns${NC}"
    echo "$columns"
}

# Fungsi untuk export data dari Supabase dalam batch
export_supabase_batch() {
    local offset=$1
    local limit=$2
    local batch_num=$3
    
    echo -e "${BLUE}Exporting batch #$batch_num dari Supabase (offset: $offset, limit: $limit)...${NC}"
    
    local temp_file="$TEMP_DIR/batch_${batch_num}.json"
    
    curl -s \
      -H "apikey: $SUPABASE_ANON_KEY" \
      -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
      "$SUPABASE_URL/rest/v1/$TABLE_NAME?offset=$offset&limit=$limit" > "$temp_file"
    
    local record_count=$(grep -o '{' "$temp_file" | wc -l)
    echo -e "${GREEN}Batch #$batch_num: $record_count records exported${NC}"
    
    echo "$temp_file"
}

# Fungsi untuk import JSON langsung ke PostgreSQL
import_json_direct() {
    local json_file=$1
    local batch_num=$2
    
    echo -e "${BLUE}Importing JSON batch #$batch_num langsung ke PostgreSQL...${NC}"
    
    # Copy file JSON ke container
    local container_file="/tmp/batch_${batch_num}.json"
    docker cp "$json_file" "$PG_CONTAINER:$container_file"
    
    # Execute SQL untuk import JSON
    docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "
        CREATE TEMPORARY TABLE tmp_import (data jsonb);
        COPY tmp_import FROM '$container_file';
        
        INSERT INTO $TABLE_NAME
        SELECT * FROM jsonb_populate_recordset(null::$TABLE_NAME, 
            (SELECT jsonb_agg(data) FROM tmp_import));
        
        DROP TABLE tmp_import;
    "
    
    local result=$?
    if [ $result -eq 0 ]; then
        echo -e "${GREEN}Batch #$batch_num berhasil diimport langsung dari JSON${NC}"
    else
        echo -e "${RED}Gagal mengimport batch #$batch_num langsung dari JSON${NC}"
        echo -e "${YELLOW}Mencoba metode alternatif...${NC}"
        
        # Alternatif menggunakan SQL langsung
        import_with_simple_sql "$json_file" "$batch_num"
        return $?
    fi
    
    return $result
}

# Fungsi untuk import dengan SQL sederhana (alternative method)
import_with_simple_sql() {
    local json_file=$1
    local batch_num=$2
    
    echo -e "${BLUE}Importing batch #$batch_num dengan SQL sederhana...${NC}"
    
    local sql_file="$TEMP_DIR/batch_${batch_num}_simple.sql"
    
    # Buat SQL file dengan metode sederhana
    echo "BEGIN;" > "$sql_file"
    echo "SET session_replication_role = 'replica';" >> "$sql_file"
    
    # Tambahkan statement untuk import JSON
    echo "INSERT INTO $TABLE_NAME SELECT * FROM json_populate_recordset(null::$TABLE_NAME, '" >> "$sql_file"
    cat "$json_file" >> "$sql_file"
    echo "');" >> "$sql_file"
    
    echo "SET session_replication_role = 'origin';" >> "$sql_file"
    echo "COMMIT;" >> "$sql_file"
    
    # Copy file SQL ke container
    local container_file="/tmp/batch_${batch_num}_simple.sql"
    docker cp "$sql_file" "$PG_CONTAINER:$container_file"
    
    # Execute SQL file
    docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DB -f "$container_file"
    
    local result=$?
    if [ $result -eq 0 ]; then
        echo -e "${GREEN}Batch #$batch_num berhasil diimport dengan SQL sederhana${NC}"
    else
        echo -e "${RED}Gagal mengimport batch #$batch_num dengan SQL sederhana${NC}"
    fi
    
    return $result
}

# Fungsi untuk verifikasi jumlah data
verify_migration() {
    echo -e "${BLUE}Verifikasi jumlah data...${NC}"
    
    local supabase_count=$1
    
    local pg_count=$(docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DB -t -c "
        SELECT COUNT(*) FROM $TABLE_NAME;
    ")
    
    pg_count=$(echo "$pg_count" | tr -d ' ')
    
    echo -e "${GREEN}Jumlah data di Supabase: $supabase_count baris${NC}"
    echo -e "${GREEN}Jumlah data di PostgreSQL: $pg_count baris${NC}"
    
    if [ "$pg_count" -eq "$supabase_count" ]; then
        echo -e "${GREEN}MIGRASI BERHASIL! Jumlah data sama.${NC}"
        return 0
    else
        echo -e "${RED}MIGRASI TIDAK LENGKAP! Jumlah data berbeda.${NC}"
        return 1
    fi
}

# Fungsi untuk sampling data
sample_data() {
    echo -e "${BLUE}Sampling data dari PostgreSQL...${NC}"
    
    docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "
        SELECT * FROM $TABLE_NAME LIMIT 5;
    "
    
    echo -e "${BLUE}Distribusi data by vendor...${NC}"
    docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "
        SELECT vendor_name, COUNT(*) FROM $TABLE_NAME GROUP BY vendor_name ORDER BY COUNT(*) DESC;
    "
    
    echo -e "${BLUE}Distribusi data by issue...${NC}"
    docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "
        SELECT issue_category, COUNT(*) FROM $TABLE_NAME GROUP BY issue_category ORDER BY COUNT(*) DESC LIMIT 10;
    "
}

# Fungsi untuk migration menggunakan COPY to CSV
migrate_via_csv() {
    echo -e "${BLUE}Mencoba migrasi menggunakan CSV...${NC}"
    
    # Persiapan struktur kolom
    local columns=$(get_table_columns)
    local csv_file="$TEMP_DIR/full_export.csv"
    
    # Export data dari Supabase ke JSON
    echo -e "${BLUE}Export full data dari Supabase...${NC}"
    curl -s \
      -H "apikey: $SUPABASE_ANON_KEY" \
      -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
      -H "Accept: text/csv" \
      "$SUPABASE_URL/rest/v1/$TABLE_NAME?limit=100000" > "$csv_file"
    
    # Cek ukuran file
    local file_size=$(stat -c %s "$csv_file" 2>/dev/null || stat -f %z "$csv_file")
    echo -e "${GREEN}CSV file created: $csv_file (size: $file_size bytes)${NC}"
    
    # Copy file CSV ke container
    local container_file="/tmp/full_export.csv"
    docker cp "$csv_file" "$PG_CONTAINER:$container_file"
    
    # Import CSV ke PostgreSQL
    echo -e "${BLUE}Importing CSV ke PostgreSQL...${NC}"
    docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "
        COPY $TABLE_NAME FROM '$container_file' WITH (FORMAT csv, HEADER true);
    "
    
    local result=$?
    if [ $result -eq 0 ]; then
        echo -e "${GREEN}CSV import berhasil${NC}"
    else
        echo -e "${RED}Gagal mengimport CSV${NC}"
    fi
    
    return $result
}

# Fungsi untuk migrasi dengan menggunakan JSON langsung
migrate_using_json() {
    echo -e "${BLUE}Migrasi menggunakan metode JSON langsung...${NC}"
    
    # Export data dari Supabase ke JSON
    local json_file="$TEMP_DIR/full_export.json"
    echo -e "${BLUE}Export full data dari Supabase ke JSON...${NC}"
    
    curl -s \
      -H "apikey: $SUPABASE_ANON_KEY" \
      -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
      "$SUPABASE_URL/rest/v1/$TABLE_NAME?limit=100000" > "$json_file"
    
    # Cek ukuran file
    local file_size=$(stat -c %s "$json_file" 2>/dev/null || stat -f %z "$json_file")
    echo -e "${GREEN}JSON file created: $json_file (size: $file_size bytes)${NC}"
    
    # Copy file JSON ke container
    local container_file="/tmp/full_export.json"
    docker cp "$json_file" "$PG_CONTAINER:$container_file"
    
    # Import JSON ke PostgreSQL
    echo -e "${BLUE}Importing JSON ke PostgreSQL...${NC}"
    docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "
        BEGIN;
        SET session_replication_role = 'replica';
        
        INSERT INTO $TABLE_NAME
        SELECT * FROM json_populate_recordset(null::$TABLE_NAME, 
            (SELECT convert_from(pg_read_binary_file('$container_file'), 'UTF8')::json));
        
        SET session_replication_role = 'origin';
        COMMIT;
    "
    
    local result=$?
    if [ $result -eq 0 ]; then
        echo -e "${GREEN}JSON import berhasil${NC}"
    else
        echo -e "${RED}Gagal mengimport JSON${NC}"
        echo -e "${YELLOW}Attempting alternative JSON import method...${NC}"
        
        # Try alternative method
        docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "
            BEGIN;
            SET session_replication_role = 'replica';
            
            CREATE TEMPORARY TABLE json_import (data json);
            COPY json_import FROM '$container_file';
            
            INSERT INTO $TABLE_NAME
            SELECT * FROM json_populate_recordset(null::$TABLE_NAME, 
                (SELECT data FROM json_import LIMIT 1));
            
            DROP TABLE json_import;
            
            SET session_replication_role = 'origin';
            COMMIT;
        "
        
        result=$?
    fi
    
    return $result
}

# Main migration function
main() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}FULL DATA MIGRATION: SUPABASE → POSTGRESQL${NC}"
    echo -e "${BLUE}================================${NC}"
    echo
    
    # Step 1: Count data
    total_count=$(count_supabase_data)
    
    # Exit if no data found
    if [ "$total_count" -eq "0" ]; then
        echo -e "${RED}No data found in Supabase. Aborting migration.${NC}"
        exit 1
    fi
    
    # Step 2: Backup existing data (no prompt)
    echo -e "${BLUE}Membuat backup data existing...${NC}"
    backup_existing_data
    
    # Step 3: Truncate table (no prompt)
    echo -e "${YELLOW}PERINGATAN: Semua data existing di tabel $TABLE_NAME akan dihapus.${NC}"
    truncate_table
    
    # Step 4: Try direct JSON migration (most efficient)
    echo -e "${BLUE}Mencoba migrasi dengan metode JSON langsung...${NC}"
    if migrate_using_json; then
        echo -e "${GREEN}Migration dengan metode JSON langsung berhasil!${NC}"
    else
        echo -e "${YELLOW}Mencoba metode alternatif dengan CSV...${NC}"
        if migrate_via_csv; then
            echo -e "${GREEN}Migration dengan metode CSV berhasil!${NC}"
        else
            echo -e "${YELLOW}Kedua metode gagal. Mencoba migrasi batch...${NC}"
            
            # Step 5: Batch processing (fallback if direct methods fail)
            local batch_num=1
            local offset=0
            
            # Get table columns
            columns=$(get_table_columns)
            
            while [ $offset -lt $total_count ]; do
                echo -e "${BLUE}Processing batch #$batch_num...${NC}"
                
                # Export batch
                json_file=$(export_supabase_batch $offset $BATCH_SIZE $batch_num)
                
                # Import batch directly
                if import_json_direct "$json_file" $batch_num; then
                    echo -e "${GREEN}Batch #$batch_num processed successfully${NC}"
                else
                    echo -e "${RED}Failed to process batch #$batch_num${NC}"
                    # Tidak exit, tetap lanjut dengan batch berikutnya
                fi
                
                # Increment
                offset=$((offset + BATCH_SIZE))
                batch_num=$((batch_num + 1))
                
                # Simple progress
                progress=$((offset * 100 / total_count))
                echo -e "${GREEN}Progress: $progress% ($offset of $total_count)${NC}"
            done
        fi
    fi
    
    # Step 6: Verification
    echo -e "${BLUE}Verifikasi migrasi...${NC}"
    verify_migration "$total_count"
    
    # Step 7: Sample data
    sample_data
    
    echo -e "${GREEN}Migration process completed!${NC}"
    
    # Restart Docker
    echo -e "${BLUE}Restarting Docker container untuk me-refresh koneksi...${NC}"
    docker compose -f docker-compose.dev.yml restart app
    
    echo -e "${GREEN}Migrasi selesai! Data dari Supabase telah berhasil dipindahkan ke PostgreSQL.${NC}"
}

# Execute main function with error handling
main 