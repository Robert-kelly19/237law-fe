const json = (body: Record<string, unknown>, status: number) =>
  Response.json(body, { status });

const publicRoutes = new Set(["GET /rag/search", "POST /rag/ask-agent"]);
const adminRoutes = new Set([
  "GET /rag/ingest-status",
  "POST /rag/reingest-all",
  "GET /admin/analytics/overview",
  "GET /admin/analytics/daily",
  "GET /admin/analytics/weekly",
  "GET /admin/analytics/monthly",
  "POST /admin/broadcast",
]);

function isInRange(value: string | null, min: number, max: number) {
  if (value === null) return true;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

async function handle(request: Request, path: string[]) {
  const url = new URL(request.url);
  const isAdmin = path[0] === "admin";
  const requestedPath = path.slice(1).join("/");
  const upstreamPath = isAdmin
    ? path[1] === "analytics" || path[1] === "broadcast"
      ? `/admin/${requestedPath}`
      : `/${requestedPath}`
    : `/${path.join("/")}`;
  const routeKey = `${request.method} ${upstreamPath}`;

  if (isAdmin && !adminRoutes.has(routeKey)) {
    return json({ code: "ROUTE_NOT_AVAILABLE", message: "This operation is not available." }, 404);
  }
  if (!isAdmin && (path[0] !== "rag" || !publicRoutes.has(routeKey))) {
    return json({ code: "ROUTE_NOT_AVAILABLE", message: "This operation is not available." }, 404);
  }

  if (isAdmin) {
    const gatewayToken = process.env.ADMIN_ACCESS_GATE_TOKEN;
    if (!gatewayToken) {
      return json(
        {
          code: "ADMIN_GATE_NOT_CONFIGURED",
          message: "Admin access is not enabled for this deployment.",
        },
        503,
      );
    }
    if (request.headers.get("x-admin-gateway-token") !== gatewayToken) {
      return json(
        { code: "ADMIN_ACCESS_REQUIRED", message: "Use the approved admin access route." },
        401,
      );
    }
    if (!process.env.LAW_ADMIN_API_KEY) {
      return json(
        {
          code: "ADMIN_KEY_NOT_CONFIGURED",
          message: "The server-side admin API key is not configured.",
        },
        503,
      );
    }
  }

  const apiBase = process.env.LAW_API_BASE_URL;
  if (!apiBase) {
    return json(
      { code: "API_BASE_NOT_CONFIGURED", message: "The legal service URL is not configured." },
      503,
    );
  }

  if (upstreamPath === "/rag/search") {
    const query = url.searchParams.get("query");
    if (!query?.trim() || query.length > 1000) {
      return json(
        { code: "INVALID_QUERY", message: "Enter a search of 1 to 1000 characters." },
        400,
      );
    }
  }
  if (upstreamPath === "/admin/analytics/daily" && !isInRange(url.searchParams.get("days"), 1, 365)) {
    return json({ code: "INVALID_RANGE", message: "Days must be between 1 and 365." }, 400);
  }
  if (upstreamPath === "/admin/analytics/weekly" && !isInRange(url.searchParams.get("weeks"), 1, 52)) {
    return json({ code: "INVALID_RANGE", message: "Weeks must be between 1 and 52." }, 400);
  }
  if (upstreamPath === "/admin/analytics/monthly" && !isInRange(url.searchParams.get("months"), 1, 24)) {
    return json({ code: "INVALID_RANGE", message: "Months must be between 1 and 24." }, 400);
  }

  let body: string | undefined;
  if (request.method === "POST") {
    if (upstreamPath === "/rag/ask-agent" || upstreamPath === "/admin/broadcast") {
      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        return json({ code: "INVALID_JSON", message: "The request body must be valid JSON." }, 400);
      }

      if (upstreamPath === "/rag/ask-agent") {
        if (
          !payload ||
          typeof payload !== "object" ||
          !("query" in payload) ||
          typeof payload.query !== "string" ||
          !payload.query.trim() ||
          payload.query.length > 1000 ||
          !("userId" in payload) ||
          typeof payload.userId !== "string" ||
          !payload.userId ||
          !("sessionId" in payload) ||
          typeof payload.sessionId !== "string" ||
          !payload.sessionId
        ) {
          return json(
            { code: "INVALID_QUESTION", message: "A question of 1 to 1000 characters is required." },
            400,
          );
        }
        body = JSON.stringify(payload);
      } else {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
            ? payload.message.trim()
            : "";
        if (!message || message.length > 1600) {
          return json(
            { code: "INVALID_BROADCAST", message: "The message must contain 1 to 1600 characters." },
            400,
          );
        }
        body = JSON.stringify({ message });
      }
    }
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(`${apiBase.replace(/\/+$/, "")}${upstreamPath}`);
  } catch {
    return json(
      { code: "API_BASE_INVALID", message: "The configured legal service URL is invalid." },
      503,
    );
  }
  if (isAdmin || upstreamPath === "/rag/search") {
    url.searchParams.forEach((value, key) => upstreamUrl.searchParams.set(key, value));
  }

  const headers = new Headers();
  if (request.method === "POST" && body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (isAdmin) headers.set("x-admin-api-key", process.env.LAW_ADMIN_API_KEY!);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
    });
  } catch {
    return json(
      { code: "UPSTREAM_UNAVAILABLE", message: "The legal service could not be reached. Please try again." },
      502,
    );
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { path } = await params;
  return handle(request, path);
}

export async function POST(request: Request, { params }: RouteContext) {
  const { path } = await params;
  return handle(request, path);
}
