# MCPs

Remote MCP servers that extend the home site with tool capabilities.

Each server lives in its own subfolder and is deployed as a separate Cloud Run service.
The home site's Admin → Settings page manages the list of registered MCP servers
(URL, bearer token, credentials) via the `mcp_servers` Supabase table.

## Servers

| Folder | Name | Upstream API |
|---|---|---|
| `cin7/` | Cin7 Core | inventory.dearsystems.com/ExternalApi/v2 |

## Architecture

```
Claude.ai / Claude Code
    │  Authorization: Bearer <MCP_BEARER_TOKEN>
    ▼
MCP Server (Cloud Run)   ← reads Cin7 creds from Supabase or env vars
    │  api-auth-accountid / api-auth-applicationkey
    ▼
Cin7 Core V2 API
```

## Deploying a new MCP server

1. Create a folder under `mcps/<name>/`
2. Add a `Dockerfile` and deploy to Cloud Run
3. Register the server in the home app:
   - Go to **Admin → Settings → MCP Servers**
   - Add the URL and bearer token
   - Paste in any upstream API credentials

## Running locally

```bash
cd mcps/cin7
cp .env.example .env     # fill in credentials
pip install -r requirements.txt
python cin7_mcp_server.py
# Health check: curl http://localhost:8000/health
```
