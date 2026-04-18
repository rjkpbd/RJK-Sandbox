"""
Cin7 Core MCP Server

Remote MCP server exposing Cin7 Core V2 API as tools for Claude.

Deployment:
    pip install -r requirements.txt
    export CIN7_ACCOUNT_ID="…"
    export CIN7_APP_KEY="…"
    export MCP_BEARER_TOKEN="…"
    python cin7_mcp_server.py

Credentials can alternatively be stored in the Supabase `mcp_servers` table
(set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) and will be loaded/refreshed
automatically every 5 minutes — no redeploy needed.
"""

import os
import time
import asyncio
from typing import Optional, Annotated

import httpx
from fastmcp import FastMCP
from starlette.applications import Starlette
from starlette.routing import Route, Mount
from starlette.requests import Request
from starlette.responses import JSONResponse

# ─── Credential loading (Supabase-first, env-var fallback) ───────────────────

_cred_cache: dict = {}
_cred_cache_at: float = 0
_CACHE_TTL = 300  # 5 minutes


def _load_from_env() -> dict:
    return {
        "cin7_account_id": os.environ.get("CIN7_ACCOUNT_ID", ""),
        "cin7_app_key": os.environ.get("CIN7_APP_KEY", ""),
        "mcp_bearer_token": os.environ.get("MCP_BEARER_TOKEN", ""),
    }


def _load_from_supabase() -> dict | None:
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        return None
    try:
        from supabase import create_client  # type: ignore
        sb = create_client(supabase_url, supabase_key)
        result = (
            sb.table("mcp_servers")
            .select("credentials,bearer_token")
            .eq("name", "cin7-core")
            .single()
            .execute()
        )
        if result.data:
            creds = result.data.get("credentials") or {}
            # bearer_token column = what the home app sends to this MCP server
            creds.setdefault("mcp_bearer_token", result.data.get("bearer_token") or "")
            return creds
    except Exception as e:
        print(f"[cin7-mcp] Supabase credential load failed: {e}")
    return None


def get_credentials() -> dict:
    global _cred_cache, _cred_cache_at
    if time.time() - _cred_cache_at > _CACHE_TTL:
        creds = _load_from_supabase() or _load_from_env()
        _cred_cache = creds
        _cred_cache_at = time.time()
    return _cred_cache


# ─── HTTP client factory (rebuilt when credentials rotate) ────────────────────

_client: httpx.AsyncClient | None = None
_client_creds_key: str = ""


def get_client() -> httpx.AsyncClient:
    global _client, _client_creds_key
    creds = get_credentials()
    key = f"{creds.get('cin7_account_id')}:{creds.get('cin7_app_key')}"
    if _client is None or key != _client_creds_key:
        if _client:
            asyncio.create_task(_client.aclose())
        _client = httpx.AsyncClient(
            base_url="https://inventory.dearsystems.com/ExternalApi/v2",
            headers={
                "api-auth-accountid": creds.get("cin7_account_id", ""),
                "api-auth-applicationkey": creds.get("cin7_app_key", ""),
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(30.0),
            transport=httpx.AsyncHTTPTransport(retries=2),
        )
        _client_creds_key = key
    return _client


# ─── MCP server ───────────────────────────────────────────────────────────────

mcp = FastMCP(
    name="cin7-core",
    instructions=(
        "Tools for Cin7 Core (DEAR) inventory. Use for products, stock levels, "
        "sales orders, purchase orders, and invoices. Always paginate large "
        "result sets; default page size is 100, max is 1000."
    ),
)


# ── Auth middleware ────────────────────────────────────────────────────────────

@mcp.middleware("request")
async def auth_middleware(request, call_next):
    from fastmcp.server.dependencies import get_http_headers  # type: ignore
    headers = get_http_headers()
    token = headers.get("authorization", "").removeprefix("Bearer ").strip()
    expected = get_credentials().get("mcp_bearer_token", "")
    if not expected or token != expected:
        return {"error": "Unauthorized"}, 401
    return await call_next(request)


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get(path: str, params: dict | None = None) -> dict:
    r = await get_client().get(path, params=params or {})
    r.raise_for_status()
    return r.json()


async def _post(path: str, body: dict) -> dict:
    r = await get_client().post(path, json=body)
    r.raise_for_status()
    return r.json()


async def _put(path: str, body: dict) -> dict:
    r = await get_client().put(path, json=body)
    r.raise_for_status()
    return r.json()


# ─── PRODUCTS & STOCK ─────────────────────────────────────────────────────────

@mcp.tool
async def list_products(
    search: Annotated[Optional[str], "Search by SKU, name, or barcode"] = None,
    page: int = 1,
    limit: Annotated[int, "1–1000"] = 100,
) -> dict:
    """List products from Cin7 Core."""
    params: dict = {"Page": page, "Limit": limit}
    if search:
        params["Search"] = search
    return await _get("/product", params)


@mcp.tool
async def get_product(product_id: str) -> dict:
    """Retrieve a single product by ID (GUID)."""
    return await _get("/product", {"ID": product_id})


@mcp.tool
async def get_stock_on_hand(
    sku: Annotated[Optional[str], "Exact SKU"] = None,
    location: Annotated[Optional[str], "Location name, omit for all"] = None,
    include_zero: bool = False,
) -> dict:
    """Return stock on hand by SKU and location."""
    params: dict = {"Limit": 1000, "IncludeZeroOnHand": include_zero}
    if sku:
        params["Sku"] = sku
    if location:
        params["Location"] = location
    return await _get("/ref/productavailability", params)


# ─── SALES ORDERS & INVOICES ──────────────────────────────────────────────────

@mcp.tool
async def list_sales(
    status: Annotated[
        Optional[str],
        "e.g. DRAFT, AUTHORISED, ORDERED, INVOICED, COMPLETED, VOIDED",
    ] = None,
    customer: Optional[str] = None,
    created_since: Annotated[Optional[str], "ISO date, e.g. 2026-04-01"] = None,
    page: int = 1,
    limit: int = 100,
) -> dict:
    """List sales orders."""
    params: dict = {"Page": page, "Limit": limit}
    if status:
        params["Status"] = status
    if customer:
        params["Customer"] = customer
    if created_since:
        params["CreatedSince"] = created_since
    return await _get("/saleList", params)


@mcp.tool
async def get_sale(sale_id: str) -> dict:
    """Retrieve a full sale (order + invoice + fulfilment) by ID."""
    return await _get("/sale", {"ID": sale_id})


@mcp.tool
async def create_sale(
    customer: str,
    lines: Annotated[
        list[dict],
        "List of {SKU, Quantity, Price, Discount?, Tax?}",
    ],
    reference: Optional[str] = None,
    location: Optional[str] = None,
) -> dict:
    """Create a draft sale order. Review before authorising."""
    body: dict = {"Customer": customer, "Lines": lines, "Status": "DRAFT"}
    if reference:
        body["CustomerReference"] = reference
    if location:
        body["Location"] = location
    return await _post("/sale", body)


# ─── PURCHASE ORDERS ──────────────────────────────────────────────────────────

@mcp.tool
async def list_purchases(
    status: Optional[str] = None,
    supplier: Optional[str] = None,
    page: int = 1,
    limit: int = 100,
) -> dict:
    """List purchase orders."""
    params: dict = {"Page": page, "Limit": limit}
    if status:
        params["Status"] = status
    if supplier:
        params["Supplier"] = supplier
    return await _get("/purchaseList", params)


@mcp.tool
async def get_purchase(purchase_id: str) -> dict:
    """Retrieve a full purchase order."""
    return await _get("/purchase", {"ID": purchase_id})


# ─── Starlette app (MCP + /health) ───────────────────────────────────────────

async def health_endpoint(request: Request) -> JSONResponse:
    creds = get_credentials()
    configured = bool(creds.get("cin7_account_id") and creds.get("cin7_app_key"))
    return JSONResponse({
        "status": "ok",
        "name": "cin7-core",
        "configured": configured,
        "credential_source": "supabase" if _load_from_supabase() else "env",
    })


mcp_asgi = mcp.http_app(path="/mcp")

app = Starlette(
    routes=[
        Route("/health", health_endpoint),
        Mount("/", app=mcp_asgi),
    ]
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
    )
