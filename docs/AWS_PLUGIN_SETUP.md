# AWS Plugin MCP – Setup & Troubleshooting

## Why awsiac & awspricing Show "Error"

Both servers run via **`uvx`** (from [uv](https://docs.astral.sh/uv/) by Astral). The error:

```text
'uvx' is not recognized as an internal or external command
```

means **uv is not installed** or **uv is installed but not on the PATH** that Cursor uses when starting MCP (e.g. winget installs uv but Cursor may not see it until PATH is updated and Cursor restarted).

---

## Fix applied on this machine

1. **Full path in MCP config**  
   Plugin config was updated to call `uvx.exe` by full path so Cursor does not depend on PATH:
   `C:\Users\ACER\AppData\Local\Microsoft\WinGet\Packages\astral-sh.uv_Microsoft.Winget.Source_8wekyb3d8bbwe\uvx.exe`

2. **User PATH**  
   That same folder was added to your Windows User PATH so `uvx` works in new terminals and survives plugin updates.

**Langkah Anda:** Tutup Cursor sepenuhnya lalu buka lagi, lalu cek MCP (Settings → MCP). awsiac dan awspricing seharusnya hijau.

---

## Fix (Best Practice) – if error appears again

### 1. Install uv (includes uvx)

**Option A – Windows (recommended)**  
In PowerShell or Command Prompt:

```powershell
winget install --id=astral-sh.uv -e --accept-source-agreements --accept-package-agreements
```

**Option B – Official install script**

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**Option C – pip (if you use Python)**

```bash
pip install uv
```

### 2. Restart Cursor

- Fully close Cursor (all windows).
- Open Cursor again so it picks up the updated PATH and can find `uvx`.

### 3. Verify

In a **new** terminal:

```bash
uvx --version
```

If this works, the AWS plugin should be able to start **awsiac** and **awspricing**.

### 4. Reload MCP (optional)

- Open **Cursor Settings → MCP**.
- For **awsiac** and **awspricing**, use "Show Output" to confirm no more `uvx` errors, or toggle the server off/on to force a reconnect.

---

## Summary

| Component     | Depends on | Status after installing uv   |
|-------------|------------|------------------------------|
| awsknowledge| None       | Already works (5 tools)      |
| awsiac      | `uvx`      | Should work after uv + restart |
| awspricing  | `uvx`      | Should work after uv + restart |

---

## Reference

- [Installing uv](https://docs.astral.sh/uv/getting-started/installation/)
- [uvx – run tools without installing](https://docs.astral.sh/uv/guides/tools/)
