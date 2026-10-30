import type { Language } from "@/components/providers";

export type SearchResult = {
  id: string;
  lawName: string;
  articleNumber: string;
  content: string;
  source: string;
  distance: number;
};

export type AskResponse = {
  success: boolean;
  data: {
    answer: string;
    citations?: unknown[];
    relatedArticles?: unknown[];
    reasoning?: { confidence?: number };
    conversationTurnId?: string;
  };
};

export type Overview = {
  totalUsers: number;
  todayUsers: number;
  thisWeekUsers: number;
  thisMonthUsers: number;
};

export type TimeSeries = {
  days?: Array<{ date: string; users: number }>;
  weeks?: Array<{ weekStart: string; users: number }>;
  months?: Array<{ month: string; users: number }>;
};

export type IndexStatus = {
  totalChunks: number;
  lawsBySource: Array<{ source: string; chunks: number }>;
  isEmpty: boolean;
};

export type ReingestResult = {
  success: boolean;
  message?: string;
  ingested?: string[];
  skipped?: string[];
  failed?: string[];
};

export type BroadcastResult = {
  totalRecipients: number;
  sent: number;
  failed: number;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const isDemo = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function demoScenario() {
  if (!isDemo || typeof window === "undefined") return "success";
  return window.localStorage.getItem("law-demo-state") ?? "success";
}

async function demoDelay() {
  await new Promise((resolve) => window.setTimeout(resolve, 900));
}

function demoThrow(scenario: string): never {
  if (scenario === "error") throw new ApiError("Demo service error", 503, "DEMO_ERROR");
  throw new Error("Invalid demo scenario");
}

function getDemoData<T>(path: string, query?: string): T {
  const scenario = demoScenario();
  const pathname = path.split("?")[0];
  if (scenario === "error") demoThrow(scenario);
  if (scenario === "empty") {
    if (pathname === "/api/rag/search") return [] as T;
    if (pathname === "/api/admin/analytics/overview") {
      return { totalUsers: 0, todayUsers: 0, thisWeekUsers: 0, thisMonthUsers: 0 } as T;
    }
    if (pathname === "/api/admin/rag/ingest-status") {
      return { totalChunks: 0, lawsBySource: [], isEmpty: true } as T;
    }
  }

  const params = new URLSearchParams(query);
  if (pathname === "/api/rag/search") {
    return [
      {
        id: "demo-work",
        lawName: "Labour Code of Cameroon",
        articleNumber: "Article 80",
        content: "The normal working hours of employees shall be fixed by decree, taking into account the specific characteristics of each sector of activity.",
        source: "Labour Code",
        distance: 0.12,
      },
      {
        id: "demo-land",
        lawName: "Land Tenure Ordinance",
        articleNumber: "Section 8",
        content: "The State guarantees the right to property. Land may be registered in accordance with the conditions laid down by law.",
        source: "Land legislation",
        distance: 0.18,
      },
      {
        id: "demo-company",
        lawName: "Commercial Companies Act",
        articleNumber: "Article 5",
        content: "Commercial companies are formed by an agreement between two or more persons, subject to the provisions of this Act.",
        source: "Commercial law",
        distance: 0.23,
      },
    ].filter((item) => !params.get("query") || `${item.lawName} ${item.content}`.toLowerCase().includes(params.get("query")!.toLowerCase())) as T;
  }
  if (pathname === "/api/rag/ask-agent") {
    const noCitations = scenario === "empty";
    return {
      success: true,
      data: {
        answer: "Cameroon’s Labour Code sets a general framework for working hours, while specific limits can vary by sector. Check the rules that apply to your type of work, and keep a record of the hours you work.\n\nIf you share your sector and the hours involved, I can help you find the most relevant provisions.",
        citations: noCitations ? [] : ["Labour Code of Cameroon — Article 80"],
        relatedArticles: [],
        reasoning: { confidence: 0.82, toolsUsed: [], steps: [] },
      },
    } as T;
  }
  if (pathname === "/api/admin/analytics/overview") {
    return { totalUsers: 1248, todayUsers: 38, thisWeekUsers: 214, thisMonthUsers: 781 } as T;
  }
  if (pathname === "/api/admin/rag/ingest-status") {
    return {
      totalChunks: 3862,
      lawsBySource: [
        { source: "Labour Code", chunks: 1264 },
        { source: "Land legislation", chunks: 1098 },
        { source: "Commercial law", chunks: 842 },
        { source: "Other sources", chunks: 658 },
      ],
      isEmpty: false,
    } as T;
  }
  if (pathname.startsWith("/api/admin/analytics/")) {
    const isDaily = pathname.endsWith("daily");
    const isWeekly = pathname.endsWith("weekly");
    const count = Number(params.get(isDaily ? "days" : isWeekly ? "weeks" : "months")) || (isDaily ? 30 : 12);
    if (isDaily) return { days: Array.from({ length: Math.min(count, 30) }, (_, index) => ({ date: new Date(Date.now() - (Math.min(count, 30) - index - 1) * 86_400_000).toISOString().slice(0, 10), users: 18 + ((index * 7) % 31) })) } as T;
    if (isWeekly) return { weeks: Array.from({ length: Math.min(count, 12) }, (_, index) => ({ weekStart: new Date(Date.now() - (Math.min(count, 12) - index - 1) * 604_800_000).toISOString().slice(0, 10), users: 110 + ((index * 19) % 75) })) } as T;
    return { months: Array.from({ length: Math.min(count, 12) }, (_, index) => ({ month: new Date(Date.now() - (Math.min(count, 12) - index - 1) * 2_592_000_000).toISOString().slice(0, 7), users: 380 + ((index * 53) % 220) })) } as T;
  }
  if (pathname === "/api/admin/rag/reingest-all") {
    return { success: true, ingested: ["Labour Code.pdf", "Land legislation.pdf"], skipped: ["Commercial law.pdf"], failed: [] } as T;
  }
  if (pathname === "/api/admin/broadcast") {
    return { totalRecipients: 420, sent: 416, failed: 4 } as T;
  }
  throw new Error(`No demo fixture configured for ${path}`);
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (isDemo) {
    const scenario = demoScenario();
    if (scenario === "loading") await demoDelay();
    return getDemoData<T>(path, path.includes("?") ? path.split("?")[1] : "");
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("The legal service could not be reached.", 0, "NETWORK_ERROR");
  }

  const raw = await response.text();
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }
  if (!response.ok) {
    const record = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const rawMessage = record.message;
    const message = typeof rawMessage === "string"
      ? rawMessage
      : Array.isArray(rawMessage)
        ? rawMessage.filter((part): part is string => typeof part === "string").join(" ")
        : "The request could not be completed.";
    throw new ApiError(message, response.status, typeof record.code === "string" ? record.code : undefined);
  }
  return data as T;
}

function responseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("The legal service returned an unexpected response.", 502, "INVALID_RESPONSE");
  }
  return value as Record<string, unknown>;
}

function responseNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function responseStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function searchLaws(query: string) {
  return requestJson<unknown>(`/api/rag/search?query=${encodeURIComponent(query)}`);
}

export async function askLegalQuestion(payload: { query: string; userId: string; sessionId: string }) {
  const raw = await requestJson<unknown>("/api/rag/ask-agent", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const record = responseRecord(raw);
  if (record.success !== true) {
    throw new ApiError("The legal service returned an unexpected response.", 502, "INVALID_RESPONSE");
  }
  const data = responseRecord(record.data);
  if (typeof data.answer !== "string") {
    throw new ApiError("The legal service returned an unexpected response.", 502, "INVALID_RESPONSE");
  }
  const response: AskResponse = { success: true, data: { answer: data.answer } };
  if (Array.isArray(data.citations)) response.data.citations = data.citations;
  if (Array.isArray(data.relatedArticles)) response.data.relatedArticles = data.relatedArticles;
  if (typeof data.conversationTurnId === "string") response.data.conversationTurnId = data.conversationTurnId;
  if (data.reasoning && typeof data.reasoning === "object" && !Array.isArray(data.reasoning)) {
    const confidence = (data.reasoning as Record<string, unknown>).confidence;
    if (typeof confidence === "number" && Number.isFinite(confidence)) response.data.reasoning = { confidence };
  }
  return response;
}

export async function getAdminOverview() {
  const raw = responseRecord(await requestJson<unknown>("/api/admin/analytics/overview"));
  if (![raw.totalUsers, raw.todayUsers, raw.thisWeekUsers, raw.thisMonthUsers].every(responseNumber)) {
    throw new ApiError("The legal service returned an unexpected response.", 502, "INVALID_RESPONSE");
  }
  return raw as Overview;
}

export async function getAdminIndex() {
  const raw = responseRecord(await requestJson<unknown>("/api/admin/rag/ingest-status"));
  if (
    !responseNumber(raw.totalChunks) ||
    typeof raw.isEmpty !== "boolean" ||
    !Array.isArray(raw.lawsBySource) ||
    !raw.lawsBySource.every((item) =>
      item && typeof item === "object" &&
      typeof item.source === "string" &&
      responseNumber(item.chunks),
    )
  ) {
    throw new ApiError("The legal service returned an unexpected response.", 502, "INVALID_RESPONSE");
  }
  return raw as IndexStatus;
}

export async function getAdminSeries(period: "daily" | "weekly" | "monthly", range: number) {
  const param = period === "daily" ? "days" : period === "weekly" ? "weeks" : "months";
  const raw = responseRecord(await requestJson<unknown>(`/api/admin/analytics/${period}?${param}=${range}`));
  const key = period === "daily" ? "days" : period === "weekly" ? "weeks" : "months";
  const dateKey = period === "daily" ? "date" : period === "weekly" ? "weekStart" : "month";
  const rows = raw[key];
  if (
    !Array.isArray(rows) ||
    !rows.every((item) =>
      item && typeof item === "object" &&
      typeof item[dateKey] === "string" &&
      responseNumber(item.users),
    )
  ) {
    throw new ApiError("The legal service returned an unexpected response.", 502, "INVALID_RESPONSE");
  }
  return raw as TimeSeries;
}

export async function reingestLaws() {
  const raw = responseRecord(await requestJson<unknown>("/api/admin/rag/reingest-all", { method: "POST" }));
  if (
    typeof raw.success !== "boolean" ||
    (raw.message !== undefined && typeof raw.message !== "string") ||
    (raw.ingested !== undefined && !responseStringArray(raw.ingested)) ||
    (raw.skipped !== undefined && !responseStringArray(raw.skipped)) ||
    (raw.failed !== undefined && !responseStringArray(raw.failed))
  ) {
    throw new ApiError("The legal service returned an unexpected response.", 502, "INVALID_RESPONSE");
  }
  return raw as ReingestResult;
}

export async function sendBroadcast(message: string) {
  const raw = responseRecord(await requestJson<unknown>("/api/admin/broadcast", {
    method: "POST",
    body: JSON.stringify({ message }),
  }));
  if (![raw.totalRecipients, raw.sent, raw.failed].every(responseNumber)) {
    throw new ApiError("The legal service returned an unexpected response.", 502, "INVALID_RESPONSE");
  }
  return raw as BroadcastResult;
}

export function getErrorMessage(error: unknown, language: Language, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === "NETWORK_ERROR" || error.status === 0) {
    return language === "fr"
      ? "Connexion au service impossible. Vérifiez votre connexion puis réessayez."
      : "Couldn’t reach the service. Check your connection and try again.";
  }
  if (error.status === 400 || error.status === 422) {
    return language === "fr"
      ? "Vérifiez votre question et réessayez."
      : "Please check your question and try again.";
  }
  if (error.status === 429) {
    return language === "fr"
      ? "Le service reçoit beaucoup de questions. Attendez un instant, puis réessayez."
      : "The service is receiving a lot of questions. Wait a moment, then try again.";
  }
  if (error.status >= 500) {
    return language === "fr"
      ? "Le service rencontre un problème. Veuillez réessayer bientôt."
      : "The service is having trouble. Please try again shortly.";
  }
  return fallback;
}

export function isDemoMode() {
  return isDemo;
}
