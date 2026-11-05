# Upload Gateway Cutover (VPS Postgres)

Excel upload gateways now live on the project-dashboard VPS app and write to local Postgres via PostgREST.

## Endpoints

Base URL: `https://nd-dashboard.cloud`

| Method | Path | Table | Header |
|---|---|---|---|
| POST | `/api/upload-5g` | `site_data_5g` | `x-api-key: $PMIS_5G_API_KEY` |
| POST | `/api/upload-aop` | `site_data_aop` | `x-api-key: $PMIS_AOP_API_KEY` |
| POST | `/api/upload-tlp` | `site_data_tlp` | `x-api-key: $PMIS_TLP_API_KEY` |
| POST | `/api/upload` | `site_data` | `x-api-key: $PMIS_API_KEY` |
| POST | `/api/upload-cme` | `site_data_cme` | `x-api-key: $PMIS_CME_API_KEY` |
| GET/POST | `/api/cme-data` | `site_data_cme` | `x-api-key: $PMIS_CME_API_KEY` |

Multipart field name: `file` (Excel `.xlsx` / `.xls` / `.xlsm`).

## Caller change

Point upload clients from the old swap_progress host to:

```
https://nd-dashboard.cloud
```

Keep the same paths and API keys.

## Server env (VPS `.env`)

```
NEXT_PUBLIC_SUPABASE_URL=https://nd-dashboard.cloud
SUPABASE_SERVICE_ROLE_KEY=<postgrest service_role JWT>
PMIS_5G_API_KEY=...
PMIS_AOP_API_KEY=...
PMIS_TLP_API_KEY=...
PMIS_API_KEY=...
PMIS_CME_API_KEY=...
```

Writes always use the service_role JWT against PostgREST (`/rest/v1`).
