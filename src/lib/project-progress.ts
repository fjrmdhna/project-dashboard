import { supabase } from "./supabase"
import { EXCLUDED_PROGRAM_REPORTS } from "./hermes-5g-constants"
import { getCacheOrFetch } from "./redis"

export interface ProjectProgress {
  scope: number
  readiness: number
  activated: number
  progress: number
}

export type ProgressComputationMode = "activation_only" | "readiness_and_activation"

export interface ProjectProgressOptions {
  readinessColumn?: string
  activatedColumn?: string
  mode?: ProgressComputationMode
}

export interface ProjectProgressFilters {
  program_name?: string | string[]
  program_name_match?: "exact" | "contains" // exact untuk eq, contains untuk ilike
  program_report?: string | string[]
  program_report_match?: "exact" | "contains"
  exclude_program_reports?: string[] // Program reports to exclude
  [key: string]: string | string[] | undefined
}

/**
 * Fetch progress data untuk satu project dari tabel tertentu
 * Menggunakan query COUNT yang sangat efisien - hanya hitung, tidak fetch data
 * 
 * @param tableName - Nama tabel di Supabase
 * @param filters - Optional filters untuk query (e.g., program_name)
 * @returns Object berisi scope, activated, dan progress percentage
 */
export async function getProjectProgress(
  tableName: string,
  filters?: ProjectProgressFilters,
  options?: ProjectProgressOptions
): Promise<ProjectProgress> {
  // Generate cache key based on table name and filters
  const normalizedOptions: Required<ProjectProgressOptions> = {
    readinessColumn: options?.readinessColumn ?? "imp_integ_af",
    activatedColumn: options?.activatedColumn ?? "rfs_af",
    mode: options?.mode ?? "activation_only",
  }
  const cacheKey = `project-progress:${tableName}:${JSON.stringify(filters || {})}:${JSON.stringify(normalizedOptions)}`
  const CACHE_TTL_SECONDS = 5 * 60 // 5 minutes cache
  
  // Try to get from cache first
  return await getCacheOrFetch(
    cacheKey,
    async () => {
      return await fetchProjectProgressFromDB(tableName, filters, normalizedOptions)
    },
    CACHE_TTL_SECONDS
  )
}

async function fetchProjectProgressFromDB(
  tableName: string,
  filters?: ProjectProgressFilters,
  options?: Required<ProjectProgressOptions>
): Promise<ProjectProgress> {
  try {
    const readinessColumn = options?.readinessColumn ?? "imp_integ_af"
    const activatedColumn = options?.activatedColumn ?? "rfs_af"
    const mode = options?.mode ?? "activation_only"

    // Build base query untuk scope count
    let scopeQuery = supabase
      .from(tableName)
      .select("system_key", { count: "exact", head: true })
      .not("system_key", "is", null)
      .neq("system_key", "")

    // Build base query untuk readiness count
    let readinessQuery = supabase
      .from(tableName)
      .select(readinessColumn, { count: "exact", head: true })
      .not(readinessColumn, "is", null)

    // Build base query untuk activated count
    let activatedQuery = supabase
      .from(tableName)
      .select(activatedColumn, { count: "exact", head: true })
      .not(activatedColumn, "is", null)

    // Apply exclude filters first
    if (filters?.exclude_program_reports && filters.exclude_program_reports.length > 0) {
      filters.exclude_program_reports.forEach((excludedProgram) => {
        scopeQuery = scopeQuery.neq("program_report", excludedProgram)
        readinessQuery = readinessQuery.neq("program_report", excludedProgram)
        activatedQuery = activatedQuery.neq("program_report", excludedProgram)
      })
    }

    // Apply other filters jika ada
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== "program_name_match" && key !== "program_report_match" && key !== "exclude_program_reports") {
          // Handle program_name / program_report dengan ilike untuk contains match
          if (
            (key === "program_name" && filters.program_name_match === "contains") ||
            (key === "program_report" && filters.program_report_match === "contains")
          ) {
            const searchValue = Array.isArray(value) ? value[0] : value
            if (searchValue) {
              scopeQuery = scopeQuery.ilike(key, `%${searchValue}%`)
              readinessQuery = readinessQuery.ilike(key, `%${searchValue}%`)
              activatedQuery = activatedQuery.ilike(key, `%${searchValue}%`)
            }
          } else if (key === "wbs_status") {
            const searchValue = Array.isArray(value) ? value[0] : value
            if (searchValue) {
              scopeQuery = scopeQuery.ilike(key, searchValue)
              readinessQuery = readinessQuery.ilike(key, searchValue)
              activatedQuery = activatedQuery.ilike(key, searchValue)
            }
          } else if (Array.isArray(value) && value.length > 0) {
            // Handle array dengan in()
            scopeQuery = scopeQuery.in(key, value)
            readinessQuery = readinessQuery.in(key, value)
            activatedQuery = activatedQuery.in(key, value)
          } else if (typeof value === "string") {
            // Handle single value dengan eq()
            scopeQuery = scopeQuery.eq(key, value)
            readinessQuery = readinessQuery.eq(key, value)
            activatedQuery = activatedQuery.eq(key, value)
          }
        }
      })
    }

    // Execute queries
    const { count: scopeCount, error: scopeError } = await scopeQuery
    const { count: readinessCount, error: readinessError } = await readinessQuery
    const { count: activatedCount, error: activatedError } = await activatedQuery

    if (scopeError || readinessError || activatedError) {
      console.error(`Error fetching progress from ${tableName}:`, scopeError || readinessError || activatedError)
      // Fallback ke method yang lebih reliable
      return await getProjectProgressFallback(tableName, filters, options)
    }

    const scope = scopeCount || 0
    const readiness = readinessCount || 0
    const activated = activatedCount || 0

    // Hitung progress percentage:
    // - activation_only: activated/scope
    // - readiness_and_activation: rata-rata readiness% dan activated%
    const progress =
      scope > 0
        ? mode === "readiness_and_activation"
          ? Math.round((((readiness / scope) + (activated / scope)) * 50) * 10) / 10
          : Math.round((activated / scope) * 1000) / 10
        : 0

    return { scope, readiness, activated, progress }
  } catch (error) {
    console.error(`Error in getProjectProgress for ${tableName}:`, error)
    // Fallback ke method yang lebih reliable
    return await getProjectProgressFallback(tableName, filters, options)
  }
}

/**
 * Fallback method: fetch minimal data jika COUNT tidak bekerja
 * Hanya select kolom yang dibutuhkan (system_key, rfs_af, dan filter columns)
 */
async function getProjectProgressFallback(
  tableName: string,
  filters?: ProjectProgressFilters,
  options?: Required<ProjectProgressOptions>
): Promise<ProjectProgress> {
  try {
    const readinessColumn = options?.readinessColumn ?? "imp_integ_af"
    const activatedColumn = options?.activatedColumn ?? "rfs_af"
    const mode = options?.mode ?? "activation_only"

    // Select minimal columns yang dibutuhkan
    const selectColumns = ["system_key", readinessColumn, activatedColumn]
    
    // Add filter columns jika ada
    if (filters) {
      Object.keys(filters).forEach((key) => {
        if (!selectColumns.includes(key)) {
          selectColumns.push(key)
        }
      })
    }

    let query = supabase
      .from(tableName)
      .select(selectColumns.join(", "))

    // Apply exclude filters first
    if (filters?.exclude_program_reports && filters.exclude_program_reports.length > 0) {
      filters.exclude_program_reports.forEach((excludedProgram) => {
        query = query.neq("program_report", excludedProgram)
      })
    }

    // Apply other filters jika ada
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== "program_name_match" && key !== "program_report_match" && key !== "exclude_program_reports") {
          // Handle program_name / program_report dengan ilike untuk contains match
          if (
            (key === "program_name" && filters.program_name_match === "contains") ||
            (key === "program_report" && filters.program_report_match === "contains")
          ) {
            const searchValue = Array.isArray(value) ? value[0] : value
            if (searchValue) {
              query = query.ilike(key, `%${searchValue}%`)
            }
          } else if (key === "wbs_status") {
            const searchValue = Array.isArray(value) ? value[0] : value
            if (searchValue) {
              query = query.ilike(key, searchValue)
            }
          } else if (Array.isArray(value) && value.length > 0) {
            // Handle array dengan in()
            query = query.in(key, value)
          } else if (typeof value === "string") {
            // Handle single value dengan eq()
            query = query.eq(key, value)
          }
        }
      })
    }

    const { data, error } = await query

    if (error) {
      console.error(`Error in fallback for ${tableName}:`, error)
      return { scope: 0, readiness: 0, activated: 0, progress: 0 }
    }

    if (!data || data.length === 0) {
      return { scope: 0, readiness: 0, activated: 0, progress: 0 }
    }

    // Hitung scope (system_key yang tidak null/undefined dan tidak kosong)
    const scope = data.filter((row: any) => {
      const systemKey = row.system_key
      return systemKey != null && systemKey !== "" && typeof systemKey === "string"
    }).length

    // Hitung readiness + activated dengan kolom yang dikonfigurasi
    const readiness = data.filter((row: any) => row[readinessColumn] != null).length
    const activated = data.filter((row: any) => row[activatedColumn] != null).length

    // Hitung progress percentage sesuai mode
    const progress =
      scope > 0
        ? mode === "readiness_and_activation"
          ? Math.round((((readiness / scope) + (activated / scope)) * 50) * 10) / 10
          : Math.round((activated / scope) * 1000) / 10
        : 0

    return { scope, readiness, activated, progress }
  } catch (error) {
    console.error(`Error in fallback for ${tableName}:`, error)
    return { scope: 0, readiness: 0, activated: 0, progress: 0 }
  }
}

