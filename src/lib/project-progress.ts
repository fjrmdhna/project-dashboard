import { supabase } from "./supabase"

export interface ProjectProgress {
  scope: number
  activated: number
  progress: number
}

export interface ProjectProgressFilters {
  program_name?: string | string[]
  program_name_match?: "exact" | "contains" // exact untuk eq, contains untuk ilike
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
  filters?: ProjectProgressFilters
): Promise<ProjectProgress> {
  try {
    // Build base query untuk scope count
    let scopeQuery = supabase
      .from(tableName)
      .select("system_key", { count: "exact", head: true })
      .not("system_key", "is", null)
      .neq("system_key", "")

    // Build base query untuk activated count
    let activatedQuery = supabase
      .from(tableName)
      .select("rfs_af", { count: "exact", head: true })
      .not("rfs_af", "is", null)

    // Apply filters jika ada
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== "program_name_match") {
          // Handle program_name dengan ilike untuk contains match
          if (key === "program_name" && filters.program_name_match === "contains") {
            const searchValue = Array.isArray(value) ? value[0] : value
            if (searchValue) {
              scopeQuery = scopeQuery.ilike(key, `%${searchValue}%`)
              activatedQuery = activatedQuery.ilike(key, `%${searchValue}%`)
            }
          } else if (Array.isArray(value) && value.length > 0) {
            // Handle array dengan in()
            scopeQuery = scopeQuery.in(key, value)
            activatedQuery = activatedQuery.in(key, value)
          } else if (typeof value === "string") {
            // Handle single value dengan eq()
            scopeQuery = scopeQuery.eq(key, value)
            activatedQuery = activatedQuery.eq(key, value)
          }
        }
      })
    }

    // Execute queries
    const { count: scopeCount, error: scopeError } = await scopeQuery
    const { count: activatedCount, error: activatedError } = await activatedQuery

    if (scopeError || activatedError) {
      console.error(`Error fetching progress from ${tableName}:`, scopeError || activatedError)
      // Fallback ke method yang lebih reliable
      return await getProjectProgressFallback(tableName, filters)
    }

    const scope = scopeCount || 0
    const activated = activatedCount || 0

    // Hitung progress percentage dengan pembulatan
    const progress = scope > 0 ? Math.round((activated / scope) * 100) : 0

    return { scope, activated, progress }
  } catch (error) {
    console.error(`Error in getProjectProgress for ${tableName}:`, error)
    // Fallback ke method yang lebih reliable
    return await getProjectProgressFallback(tableName, filters)
  }
}

/**
 * Fallback method: fetch minimal data jika COUNT tidak bekerja
 * Hanya select kolom yang dibutuhkan (system_key, rfs_af, dan filter columns)
 */
async function getProjectProgressFallback(
  tableName: string,
  filters?: ProjectProgressFilters
): Promise<ProjectProgress> {
  try {
    // Select minimal columns yang dibutuhkan
    const selectColumns = ["system_key", "rfs_af"]
    
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

    // Apply filters jika ada
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== "program_name_match") {
          // Handle program_name dengan ilike untuk contains match
          if (key === "program_name" && filters.program_name_match === "contains") {
            const searchValue = Array.isArray(value) ? value[0] : value
            if (searchValue) {
              query = query.ilike(key, `%${searchValue}%`)
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
      return { scope: 0, activated: 0, progress: 0 }
    }

    if (!data || data.length === 0) {
      return { scope: 0, activated: 0, progress: 0 }
    }

    // Hitung scope (system_key yang tidak null/undefined dan tidak kosong)
    const scope = data.filter((row) => {
      const systemKey = row.system_key
      return systemKey != null && systemKey !== "" && typeof systemKey === "string"
    }).length

    // Hitung activated (rfs_af yang tidak null/undefined)
    // rfs_af adalah timestamp, jadi cukup cek IS NOT NULL
    const activated = data.filter((row) => row.rfs_af != null).length

    // Hitung progress percentage dengan pembulatan
    const progress = scope > 0 ? Math.round((activated / scope) * 100) : 0

    return { scope, activated, progress }
  } catch (error) {
    console.error(`Error in fallback for ${tableName}:`, error)
    return { scope: 0, activated: 0, progress: 0 }
  }
}

