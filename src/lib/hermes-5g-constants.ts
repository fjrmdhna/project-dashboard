export const EXCLUDED_PROGRAM_REPORTS = [
  'Hermes H1 Project 5G : 1202 sites'
] as const

export const shouldExcludeProgramReport = (value?: string | null): boolean => {
  if (!value) {
    return false
  }
  return EXCLUDED_PROGRAM_REPORTS.includes(value.trim() as typeof EXCLUDED_PROGRAM_REPORTS[number])
}

export const filterExcludedProgramReports = (values?: (string | null | undefined)[]): string[] => {
  if (!values || values.length === 0) {
    return []
  }

  return values
    .filter((program): program is string => Boolean(program && !shouldExcludeProgramReport(program)))
    .map(program => program.trim())
}
