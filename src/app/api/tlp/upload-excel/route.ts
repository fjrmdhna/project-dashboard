import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { SiteDataTLP } from '@/lib/supabase'
import { requireApiKey } from '@/lib/api-auth'

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const BATCH_SIZE = 500 // Insert in batches of 500
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
]

interface UploadResult {
  success: boolean
  totalRows: number
  insertedCount: number
  updatedCount: number
  skippedCount: number
  errors: Array<{
    row: number
    error: string
  }>
  message: string
}

// Helper function to normalize column names
function normalizeColumnName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

// Helper function to parse Excel file
// Note: Row 1 is empty, Row 2 is header, Row 3+ is data
function parseExcelFile(buffer: Buffer): any[] {
  try {
    // Use raw: true to get original values (strings or numbers) without Date conversion
    // This avoids timezone issues when Excel dates are converted to JavaScript Date objects
    const workbook = XLSX.read(buffer, { 
      type: 'buffer', 
      cellDates: false, // Don't auto-convert dates to avoid timezone issues
      cellNF: false,
      cellStyles: false,
    })
    const sheetName = workbook.SheetNames[0] // Use first sheet
    const worksheet = workbook.Sheets[sheetName]
    
    // Check if worksheet is empty
    if (!worksheet || !worksheet['!ref']) {
      throw new Error('Excel sheet is empty or invalid')
    }
    
    // Parse as array of arrays to have full control
    // Use raw: true to get original cell values (strings, numbers) without conversion
    const arrayData = XLSX.utils.sheet_to_json(worksheet, {
      raw: true, // Get raw values to avoid Date object conversion
      defval: null,
      header: 1, // Get as array of arrays
      blankrows: false,
    }) as any[][]
    
    if (arrayData.length === 0) {
      throw new Error('Excel file has no data')
    }
    
    // Row 1 (index 0) is empty - skip it
    // Row 2 (index 1) is header row
    // Row 3+ (index 2+) is data
    
    if (arrayData.length < 2) {
      throw new Error('Excel file must have at least a header row (row 2)')
    }
    
    // Get header row (row 2, index 1)
    const headerRow = arrayData[1] as any[]
    
    // Clean header row - remove null/undefined/empty values and trim
    const cleanHeaders = headerRow.map((h, idx) => {
      if (h === null || h === undefined || h === '') {
        // If header is empty, use column index as fallback
        return `Column_${idx + 1}`
      }
      return String(h).trim()
    })
    
    console.log('📋 Header row detected:', cleanHeaders.slice(0, 10))
    
    // Get data rows (starting from row 3, index 2)
    const dataRows = arrayData.slice(2) as any[][]
    
    // Convert rows to objects
    const data = dataRows
      .filter(row => {
        // Filter out completely empty rows
        return row && row.some(cell => cell !== null && cell !== undefined && cell !== '')
      })
      .map((row, rowIndex) => {
        const obj: any = {}
        cleanHeaders.forEach((header, idx) => {
          const value = row && row[idx] !== undefined ? row[idx] : null
          // Convert empty strings to null
          obj[header] = value !== null && value !== undefined && value !== '' ? value : null
        })
        return obj
      })
    
    console.log(`📊 Parsed ${data.length} data rows (starting from row 3)`)
    if (data.length > 0) {
      console.log('📋 Sample columns from first data row:', Object.keys(data[0]).slice(0, 10))
    }
    
    return data
  } catch (error) {
    console.error('❌ Error parsing Excel:', error)
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Helper function to validate row data
function validateRow(row: any, rowIndex: number): { valid: boolean; error?: string } {
  // system_key is required
  if (!row.system_key || typeof row.system_key !== 'string' || row.system_key.trim() === '') {
    return { valid: false, error: 'system_key is required' }
  }
  
  return { valid: true }
}

// Helper function to format date to YYYY-MM-DD without timezone issues
function formatDateToYYYYMMDD(year: number, month: number, day: number): string {
  const yearStr = String(year).padStart(4, '0')
  const monthStr = String(month).padStart(2, '0')
  const dayStr = String(day).padStart(2, '0')
  return `${yearStr}-${monthStr}-${dayStr}`
}

// Helper function to validate date components
function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  
  // Check if date is valid (e.g., Feb 30 is invalid)
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  // Handle leap year
  if (month === 2 && ((year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0))) {
    if (day > 29) return false
  } else {
    if (day > daysInMonth[month - 1]) return false
  }
  
  return true
}

// Helper function to convert Excel date serial number to YYYY-MM-DD
// Excel date serial number: days since 1900-01-01 (but Excel incorrectly treats 1900 as leap year)
// Reference: https://support.microsoft.com/en-us/office/date-systems-in-excel-e7fe7167-48a9-4b96-bb53-5612a800b487
function excelSerialToDate(serial: number): string | null {
  try {
    const serialInt = Math.floor(serial)
    
    // Excel epoch: January 1, 1900
    // Serial 1 = 1900-01-01
    // Serial 60 = 1900-02-29 (incorrect, but Excel treats 1900 as leap year)
    // Serial 61 = 1900-03-01
    
    // Excel incorrectly treats 1900 as a leap year
    // So serial 60 = Feb 29, 1900 (which doesn't exist in reality)
    // Serial 61 = March 1, 1900
    
    // Calculate actual days since 1900-01-01
    // Serial 1 = 0 days (same day as epoch)
    let actualDays = serialInt - 1
    
    // If serial is >= 60, we need to subtract 1 day because
    // Excel counts Feb 29, 1900 which doesn't actually exist
    if (serialInt >= 60) {
      actualDays = actualDays - 1
    }
    
    // Calculate the actual date using UTC to avoid timezone issues
    // Start from 1900-01-01 00:00:00 UTC
    const epoch = Date.UTC(1900, 0, 1)
    const targetTimestamp = epoch + (actualDays * 86400000) // 86400000 ms = 1 day
    
    // Create date from UTC timestamp
    const targetDate = new Date(targetTimestamp)
    
    // Extract UTC components (not local timezone)
    const year = targetDate.getUTCFullYear()
    const month = targetDate.getUTCMonth() + 1
    const day = targetDate.getUTCDate()
    
    // Verify the calculation is correct
    const expectedSerial = serialInt
    console.log(`📊 Excel serial ${expectedSerial} → ${year}-${month}-${day} (actualDays: ${actualDays})`)
    
    if (isValidDate(year, month, day)) {
      const result = formatDateToYYYYMMDD(year, month, day)
      console.log(`✅ Converted: ${result}`)
      return result
    }
    
    console.log(`❌ Invalid date: ${year}-${month}-${day}`)
    return null
  } catch (error) {
    console.error('❌ Error converting Excel serial to date:', serial, error)
    return null
  }
}

// Helper function to parse date from various formats
// Best practice: Avoid Date object conversion to prevent timezone issues
function parseDate(value: any): string | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  
  // Log the input value and type for debugging
  console.log('🔍 Parsing date:', value, 'Type:', typeof value)
  
  // If it's already a Date object (shouldn't happen with raw: true, but handle it)
  if (value instanceof Date) {
    console.log('⚠️ Date object detected, converting...')
    // Use UTC methods to avoid timezone issues
    const year = value.getUTCFullYear()
    const month = value.getUTCMonth() + 1
    const day = value.getUTCDate()
    if (isValidDate(year, month, day)) {
      const result = formatDateToYYYYMMDD(year, month, day)
      console.log('✅ Date object converted:', result)
      return result
    }
    return null
  }
  
  // If it's a number (Excel date serial number)
  if (typeof value === 'number') {
    console.log('🔢 Excel serial number detected:', value)
    // Check if it's a reasonable Excel date serial number
    // Excel dates range from 1 (1900-01-01) to ~2958465 (9999-12-31)
    if (value >= 1 && value <= 2958465) {
      const result = excelSerialToDate(value)
      console.log('✅ Excel serial converted:', result)
      return result
    }
    console.log('❌ Invalid Excel serial number range')
    return null
  }
  
  // If it's a string, parse it directly without Date object conversion
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    
    console.log('📝 String date detected:', trimmed)
    
    // Try DD/MM/YYYY format (most common in Indonesian Excel)
    const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    const ddmmyyyyMatch = trimmed.match(ddmmyyyy)
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1], 10)
      const month = parseInt(ddmmyyyyMatch[2], 10)
      const year = parseInt(ddmmyyyyMatch[3], 10)
      
      console.log(`📅 DD/MM/YYYY parsed: day=${day}, month=${month}, year=${year}`)
      
      if (isValidDate(year, month, day)) {
        // Format directly without Date object to avoid timezone issues
        const result = formatDateToYYYYMMDD(year, month, day)
        console.log('✅ DD/MM/YYYY converted:', result)
        return result
      } else {
        console.log('❌ Invalid date components')
      }
    }
    
    // Try YYYY-MM-DD format (ISO format)
    const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})$/
    const yyyymmddMatch = trimmed.match(yyyymmdd)
    if (yyyymmddMatch) {
      const year = parseInt(yyyymmddMatch[1], 10)
      const month = parseInt(yyyymmddMatch[2], 10)
      const day = parseInt(yyyymmddMatch[3], 10)
      
      if (isValidDate(year, month, day)) {
        const result = formatDateToYYYYMMDD(year, month, day)
        console.log('✅ YYYY-MM-DD converted:', result)
        return result
      }
    }
    
    // Try MM/DD/YYYY format (US format, just in case)
    const mmddyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    const mmddyyyyMatch = trimmed.match(mmddyyyy)
    if (mmddyyyyMatch && !ddmmyyyyMatch) {
      const month = parseInt(mmddyyyyMatch[1], 10)
      const day = parseInt(mmddyyyyMatch[2], 10)
      const year = parseInt(mmddyyyyMatch[3], 10)
      
      if (isValidDate(year, month, day)) {
        const result = formatDateToYYYYMMDD(year, month, day)
        console.log('✅ MM/DD/YYYY converted:', result)
        return result
      }
    }
    
    // Last resort: try JavaScript Date parsing (but this may have timezone issues)
    // Only use this if all other methods fail
    try {
      const date = new Date(trimmed)
      if (!isNaN(date.getTime())) {
        // Use UTC methods to minimize timezone issues
        const year = date.getUTCFullYear()
        const month = date.getUTCMonth() + 1
        const day = date.getUTCDate()
        if (isValidDate(year, month, day)) {
          const result = formatDateToYYYYMMDD(year, month, day)
          console.log('✅ JavaScript Date parsed:', result)
          return result
        }
      }
    } catch {
      // Invalid date
    }
    
    console.log('❌ Failed to parse date string:', trimmed)
  }
  
  return null
}

// Date columns that need parsing
const DATE_COLUMNS = [
  'bauf_date',
  'lease_start_date',
  'iom_date',
  'baps_submit_date',
  'baps_date',
]

// Helper function to map Excel columns to database columns
function mapExcelToDatabase(row: any): Partial<SiteDataTLP> {
  const mapped: Partial<SiteDataTLP> = {}
  
  // Direct mapping for columns that match exactly
  const directMapping: Record<string, keyof SiteDataTLP> = {
    'system_key': 'system_key',
    'SBOQ.project_type': 'SBOQ.project_type',
    'network_header': 'network_header',
    'project_name': 'project_name',
    'program_name': 'program_name',
    'program_group': 'program_group',
    'site_id': 'site_id',
    'site_name': 'site_name',
    'wbs_status': 'wbs_status',
    'year': 'year',
    'new_site_id': 'new_site_id',
    'new_site_name': 'new_site_name',
    'region': 'region',
    'ran_vendor': 'ran_vendor',
    'site_category': 'site_category',
    'twr_owner': 'twr_owner',
    'vendor_code': 'vendor_code',
    'wo_number_1': 'wo_number_1',
    'ic_000010_bf': 'ic_000010_bf',
    'ic_000010_ff': 'ic_000010_ff',
    'ic_000010_af': 'ic_000010_af',
    'rfi_accepted': 'rfi_accepted',
    'site_status': 'site_status',
    'return_replacement_status': 'return_replacement_status',
    'progress_status': 'progress_status',
    'price_month_actual': 'price_month_actual',
    'site_id_tlp': 'site_id_tlp',
    'bauf_date': 'bauf_date',
    'lease_start_clause': 'lease_start_clause',
    'lease_start_date': 'lease_start_date',
    'administration_status': 'administration_status',
    'booking_status': 'booking_status',
    'issue_ny_sc': 'issue_ny_sc',
    'iom_date': 'iom_date',
    'iom_number': 'iom_number',
    'sc_number': 'sc_number',
    'po_number': 'po_number',
    'baps_submit_date': 'baps_submit_date',
    'baps_number': 'baps_number',
    'baps_date': 'baps_date',
    'baps_status': 'baps_status',
    'audit': 'audit',
  }
  
  // Normalize and map columns
  Object.keys(row).forEach(key => {
    // Try exact match first
    if (directMapping[key]) {
      const dbColumn = directMapping[key]
      let value = row[key]
      
      // Convert empty strings to null
      if (value === '' || value === undefined) {
        value = null
      }
      
      // Parse date columns
      if (DATE_COLUMNS.includes(dbColumn as string)) {
        const originalValue = value
        value = parseDate(value)
        // Log for debugging if parsing fails or produces unexpected result
        if (originalValue && !value) {
          console.warn(`⚠️ Failed to parse date for ${dbColumn}:`, originalValue, typeof originalValue)
        }
      } else {
        // Trim string values for non-date columns
        if (typeof value === 'string') {
          value = value.trim() || null
        }
      }
      
      mapped[dbColumn] = value as any
    } else {
      // Try normalized match
      const normalizedKey = normalizeColumnName(key)
      const normalizedMapping: Record<string, keyof SiteDataTLP> = {
        'systemkey': 'system_key',
        'sboqproject_type': 'SBOQ.project_type',
        'networkheader': 'network_header',
        'projectname': 'project_name',
        'programname': 'program_name',
        'programgroup': 'program_group',
        'siteid': 'site_id',
        'sitename': 'site_name',
        'wbsstatus': 'wbs_status',
        'newsiteid': 'new_site_id',
        'newsitename': 'new_site_name',
        'ranvendor': 'ran_vendor',
        'sitecategory': 'site_category',
        'twrowner': 'twr_owner',
        'vendorcode': 'vendor_code',
        'wonumber1': 'wo_number_1',
        'ic000010bf': 'ic_000010_bf',
        'ic000010ff': 'ic_000010_ff',
        'ic000010af': 'ic_000010_af',
        'rfiaccepted': 'rfi_accepted',
        'sitestatus': 'site_status',
        'returnreplacementstatus': 'return_replacement_status',
        'progressstatus': 'progress_status',
        'pricemonthactual': 'price_month_actual',
        'siteidtlp': 'site_id_tlp',
        'baufdate': 'bauf_date',
        'leasestartclause': 'lease_start_clause',
        'leasestartdate': 'lease_start_date',
        'administrationstatus': 'administration_status',
        'bookingstatus': 'booking_status',
        'issuenysc': 'issue_ny_sc',
        'iomdate': 'iom_date',
        'iomnumber': 'iom_number',
        'scnumber': 'sc_number',
        'ponumber': 'po_number',
        'bapssubmitdate': 'baps_submit_date',
        'bapsnumber': 'baps_number',
        'bapsdate': 'baps_date',
        'bapsstatus': 'baps_status',
      }
      
      if (normalizedMapping[normalizedKey]) {
        const dbColumn = normalizedMapping[normalizedKey]
        let value = row[key]
        
        if (value === '' || value === undefined) {
          value = null
        }
        
        // Parse date columns
        if (DATE_COLUMNS.includes(dbColumn as string)) {
          const originalValue = value
          value = parseDate(value)
          // Log for debugging if parsing fails or produces unexpected result
          if (originalValue && !value) {
            console.warn(`⚠️ Failed to parse date for ${dbColumn}:`, originalValue, typeof originalValue)
          }
        } else {
          // Trim string values for non-date columns
          if (typeof value === 'string') {
            value = value.trim() || null
          }
        }
        
        mapped[dbColumn] = value as any
      }
    }
  })
  
  // Ensure system_key exists
  if (!mapped.system_key) {
    mapped.system_key = row.system_key || row.systemkey || ''
  }
  
  return mapped
}

// Helper function to insert data in batches
async function insertBatch(
  data: Partial<SiteDataTLP>[]
): Promise<{ inserted: number; updated: number; errors: Array<{ row: number; error: string }> }> {
  let inserted = 0
  let updated = 0
  const errors: Array<{ row: number; error: string }> = []
  
  try {
    // Use upsert to handle both insert and update
    const { data: result, error } = await supabase
      .from('site_data_tlp')
      .upsert(data, {
        onConflict: 'system_key',
        ignoreDuplicates: false,
      })
      .select()
    
    if (error) {
      throw error
    }
    
    inserted = result?.length || 0
    updated = 0 // Supabase upsert doesn't return this info directly
    
  } catch (error) {
    // If batch fails, try individual inserts
    for (let i = 0; i < data.length; i++) {
      try {
        const { error: rowError } = await supabase
          .from('site_data_tlp')
          .upsert([data[i]], {
            onConflict: 'system_key',
            ignoreDuplicates: false,
          })
        
        if (rowError) {
          errors.push({
            row: i,
            error: rowError.message,
          })
        } else {
          inserted++
        }
      } catch (rowError) {
        errors.push({
          row: i,
          error: rowError instanceof Error ? rowError.message : 'Unknown error',
        })
      }
    }
  }
  
  return { inserted, updated, errors }
}

export async function POST(request: Request) {
  try {
    // Validate API key
    const authError = requireApiKey(request)
    if (authError) {
      return authError
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    
    if (!file) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'No file provided',
        },
        { status: 400 }
      )
    }
    
    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Invalid file type. Please upload an Excel file (.xlsx, .xls, .xlsm)',
        },
        { status: 400 }
      )
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          status: 'error',
          message: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      )
    }
    
    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Parse Excel file
    let rawData: any[]
    try {
      rawData = parseExcelFile(buffer)
    } catch (error) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        { status: 400 }
      )
    }
    
    if (rawData.length === 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Excel file is empty or has no data rows',
        },
        { status: 400 }
      )
    }
    
    // Process and validate data
    const processedData: Partial<SiteDataTLP>[] = []
    const validationErrors: Array<{ row: number; error: string }> = []
    
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i]
      // Row number = i + 3 because:
      // - Row 1 is empty (skipped)
      // - Row 2 is header (skipped)
      // - Row 3+ is data (i starts from 0, so first data row is i=0 which is row 3)
      const excelRowNumber = i + 3
      const validation = validateRow(row, excelRowNumber)
      
      if (!validation.valid) {
        validationErrors.push({
          row: excelRowNumber,
          error: validation.error || 'Validation failed',
        })
        continue
      }
      
      const mapped = mapExcelToDatabase(row)
      if (mapped.system_key) {
        processedData.push(mapped)
      }
    }
    
    if (processedData.length === 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'No valid data rows found after validation',
          validationErrors,
        },
        { status: 400 }
      )
    }
    
    // Insert data in batches
    let totalInserted = 0
    let totalUpdated = 0
    const allErrors: Array<{ row: number; error: string }> = [...validationErrors]
    
    for (let i = 0; i < processedData.length; i += BATCH_SIZE) {
      const batch = processedData.slice(i, i + BATCH_SIZE)
      const batchResult = await insertBatch(batch)
      
      totalInserted += batchResult.inserted
      totalUpdated += batchResult.updated
      allErrors.push(...batchResult.errors.map(err => {
        // Adjust row number: batch index (i) + error row index (err.row) + 3
        // because data starts from row 3 (row 1 empty, row 2 header)
        const excelRowNumber = i + err.row + 3
        return {
          row: excelRowNumber,
          error: err.error,
        }
      }))
    }
    
    const result: UploadResult = {
      success: allErrors.length === 0,
      totalRows: rawData.length,
      insertedCount: totalInserted,
      updatedCount: totalUpdated,
      skippedCount: rawData.length - processedData.length,
      errors: allErrors,
      message: allErrors.length === 0
        ? `Successfully uploaded ${totalInserted} rows to site_data_tlp`
        : `Uploaded ${totalInserted} rows with ${allErrors.length} errors`,
    }
    
    return NextResponse.json({
      status: result.success ? 'success' : 'partial_success',
      ...result,
      timestamp: new Date().toISOString(),
    })
    
  } catch (error) {
    console.error('Error uploading Excel file:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to upload Excel file',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

