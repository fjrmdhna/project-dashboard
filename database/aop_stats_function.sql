-- Migration: AOP Stats Database Function
-- Description: Membuat database function untuk menghitung stats AOP di database (lebih cepat daripada di memory)
-- Created: 2025-01-XX

-- Function untuk menghitung stats AOP berdasarkan filter
-- Function ini akan menghitung semua stats di database menggunakan aggregation
-- sehingga tidak perlu fetch semua data ke memory
CREATE OR REPLACE FUNCTION get_aop_stats(
  p_vendor_names TEXT[] DEFAULT NULL,
  p_program_reports TEXT[] DEFAULT NULL,
  p_circles TEXT[] DEFAULT NULL,
  p_site_categories TEXT[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_sites BIGINT,
  caf_count BIGINT,
  mos_count BIGINT,
  install_count BIGINT,
  readiness_count BIGINT,
  activated_count BIGINT,
  rfc_count BIGINT,
  hotnews_count BIGINT,
  endorse_count BIGINT,
  pac_count BIGINT,
  cluster_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_data AS (
    SELECT *
    FROM site_data_aop
    WHERE 
      -- Filter by vendor_names (array)
      (p_vendor_names IS NULL OR array_length(p_vendor_names, 1) IS NULL OR vendor_name = ANY(p_vendor_names))
      -- Filter by program_reports (array)
      AND (p_program_reports IS NULL OR array_length(p_program_reports, 1) IS NULL OR program_report = ANY(p_program_reports))
      -- Filter by circles (array)
      AND (p_circles IS NULL OR array_length(p_circles, 1) IS NULL OR region_circle = ANY(p_circles))
      -- Filter by site_categories (array)
      AND (p_site_categories IS NULL OR array_length(p_site_categories, 1) IS NULL OR site_category = ANY(p_site_categories))
      -- Filter by search text (ILIKE untuk case-insensitive search)
      AND (p_search IS NULL OR p_search = '' OR
           system_key ILIKE '%' || p_search || '%' OR
           site_id ILIKE '%' || p_search || '%' OR
           site_name ILIKE '%' || p_search || '%' OR
           vendor_name ILIKE '%' || p_search || '%')
  )
  SELECT 
    COUNT(*)::BIGINT as total_sites,
    COUNT(*) FILTER (WHERE rfi_accepted IS NOT NULL)::BIGINT as caf_count,
    COUNT(*) FILTER (WHERE mos_af IS NOT NULL)::BIGINT as mos_count,
    COUNT(*) FILTER (WHERE ic_000040_af IS NOT NULL)::BIGINT as install_count,
    COUNT(*) FILTER (WHERE imp_integ_af IS NOT NULL)::BIGINT as readiness_count,
    COUNT(*) FILTER (WHERE rfs_af IS NOT NULL)::BIGINT as activated_count,
    COUNT(*) FILTER (WHERE rfc_approved IS NOT NULL)::BIGINT as rfc_count,
    COUNT(*) FILTER (WHERE hotnews_af IS NOT NULL)::BIGINT as hotnews_count,
    COUNT(*) FILTER (WHERE endorse_af IS NOT NULL)::BIGINT as endorse_count,
    COUNT(*) FILTER (WHERE pac_accepted_af IS NOT NULL)::BIGINT as pac_count,
    COUNT(DISTINCT region_circle) FILTER (WHERE region_circle IS NOT NULL)::BIGINT as cluster_count
  FROM filtered_data;
END;
$$ LANGUAGE plpgsql;

-- Comment untuk dokumentasi
COMMENT ON FUNCTION get_aop_stats IS 'Menghitung stats AOP berdasarkan filter. Menggunakan database aggregation untuk performa optimal.';
