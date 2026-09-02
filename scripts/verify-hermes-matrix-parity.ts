/**
 * Lightweight parity checks for Hermes dashboard filters and matrix export stats.
 * Run: npx --yes tsx scripts/verify-hermes-matrix-parity.ts
 */

import { computeHermesMatrixExportStats } from '../src/lib/hermes-matrix-export-stats'
import { NR_2600_MILESTONE_FIELDS } from '../src/lib/hermes-milestone-fields'
import { expandProgramReportFilterValues } from '../src/lib/hermes-program-mapping'
import {
  buildHermesSearchOrFilter,
  matchesHermesCircleFilter,
  matchesHermesDashboardSearch,
} from '../src/lib/hermes-shared-filters'

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

const sampleMainRows = [
  {
    system_key: 'A1',
    program_report: 'NR 13k batch 1',
    vendor_name: 'Huawei',
    imp_ttp: 'Jakarta',
    region_circle: 'Java',
    caf_approved: '2025-01-01',
    mos_af: '2025-01-02',
    ic_000040_af: '2025-01-03',
    readiness_2600_af: '2025-01-04',
    activation_2600_af: '2025-01-05',
    ftr_submit: '2025-01-06',
    rfc_approved: '2025-01-07',
    site_id: 'SITE-001',
    site_name: 'Tower Alpha',
  },
  {
    system_key: 'A2',
    program_report: 'NR 13k batch 2',
    vendor_name: 'Ericsson',
    imp_ttp: 'Bandung',
    region_circle: 'Java',
    caf_approved: '2025-01-01',
  },
]

const sampleSupplementalRows = [
  {
    system_key: 'N1',
    program_report: 'NR700',
    ic_000040_af: '2025-02-01',
    rfs_af: '2025-02-02',
  },
  {
    system_key: 'N2',
    program_report: 'NR700',
  },
]

function testSearchParity() {
  assert(matchesHermesDashboardSearch(sampleMainRows[0], 'tower alpha'), 'search should match site_name')
  assert(matchesHermesDashboardSearch(sampleMainRows[0], 'SITE-001'), 'search should match site_id')
  assert(!matchesHermesDashboardSearch(sampleMainRows[1], 'tower alpha'), 'search should exclude non-matching rows')
  assert(
    buildHermesSearchOrFilter('abc').includes('site_id.ilike.%abc%'),
    'export search filter should include site_id'
  )
}

function testCircleParity() {
  assert(matchesHermesCircleFilter('JAVA', ['Java']), 'circle filter should normalize casing')
  assert(!matchesHermesCircleFilter('Sumatra', ['Java']), 'circle filter should reject other regions')
}

function testProgramExpansion() {
  const allPrograms = ['Hermes H1 2026', 'NR 13k batch 1']
  const expanded = expandProgramReportFilterValues(['Hermes H1 2026'], allPrograms)
  assert(expanded.includes('Hermes H1 2026'), 'mapped display name should expand to program_report')
}

function testMatrixStats() {
  const stats = computeHermesMatrixExportStats(
    sampleMainRows,
    sampleSupplementalRows,
    NR_2600_MILESTONE_FIELDS
  )

  const byLabel = Object.fromEntries(stats.map((row) => [row.label, row.count]))

  assert(byLabel['TOTAL SITES'] === 2, 'TOTAL SITES should equal main row count')
  assert(byLabel['READINESS 2600'] === 1, 'READINESS 2600 should count achieved rows in main scope')
  assert(byLabel['FTR'] === 1, 'FTR should count ftr_submit in main scope')
  assert(byLabel['READINESS 700'] === 1, 'READINESS 700 should count NR700 ic_000040_af rows')
  assert(byLabel['ACTIVATED 700'] === 1, 'ACTIVATED 700 should count NR700 rfs_af rows')
  assert(byLabel['SSV Released'] === 1, 'SSV Released should use rfc_approved column')
}

function main() {
  testSearchParity()
  testCircleParity()
  testProgramExpansion()
  testMatrixStats()
  console.log('Hermes matrix/filter parity checks passed.')
}

main()
