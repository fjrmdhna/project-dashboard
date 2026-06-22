import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'fs'

const FILE_PATH = 'C:/Users/ACER/Downloads/Commercial_Acceptance_PCG_Tracking_2025_Dedup.xlsx'
const SHEET_NAME = 'Hermes Headers'

const HEADERS = `system_key,SBOQ.project_type,vendor_code,vendor_name,wbs_status,site_id,site_name,new_site_id,new_site_name,unique_id,relo_id,relo_name,site_category,po_number,po_subline,network_header,year,program_name,project_name,program,program_report,ran_score,region,region_wise,region_circle,nano_cluster,twr_owner,long,lat,scope_of_work,issue_category,site_status,highlevel_issue,ran_scope,scope_category,imp_ttp,mc_cluster,imp_integ_ff,imp_integ_af,rfs_ff,rfs_af,ready_for_acpt_date,rfc_approved,fatp_accepted_af,hotnews_af,endorse_af,pac_accepted_af,patp_accepted_af,5g_readiness_date,5g_activation_date,cx_submitted,cx_approved,cx_acceptance_status,cx_remark,created_at,updated_at,RF_Fusion.cutover_af,rfs_bf,mocn_activation_forecast,rfs_forecast_lock,caf_approved,mos_af,cluster_acceptance_af,ic_000040_af,rfs_forecast,readiness_2600_af,activation_2600_af,po,ne_number,NE,REMARKS,site_id_ioh,site_name_ioh,RFS_Date,MaterialOnSite,FATP_Accepted_BF,FATP_Accepted_AF,PATP_Accepted_BF,Endorse_bF,CME_000030_AF,CME_000030_BF,Tgl_Migrasi,me_migration_bf,tx_000010_AF,tx_000010_BF,cme_000010_af,cme_000010_bf,ic_000070_bf,hotnews_req,TX_000050_BF,project_owner`.split(',')

const buffer = readFileSync(FILE_PATH)
const workbook = XLSX.read(buffer, { type: 'buffer' })

if (workbook.SheetNames.includes(SHEET_NAME)) {
  delete workbook.Sheets[SHEET_NAME]
  workbook.SheetNames = workbook.SheetNames.filter((name) => name !== SHEET_NAME)
}

const rows = HEADERS.map((header) => [header])
const worksheet = XLSX.utils.aoa_to_sheet(rows)
worksheet['!cols'] = [{ wch: 40 }]

XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME)

const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
writeFileSync(FILE_PATH, out)

console.log(`Added sheet "${SHEET_NAME}" with ${HEADERS.length} headers to:`)
console.log(FILE_PATH)
