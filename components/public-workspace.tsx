"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  askLegalQuestion,
  getErrorMessage,
  isDemoMode,
  searchLaws,
  type SearchResult,
} from "@/lib/api";
import { Icon } from "@/components/icons";
import {
  updateDemoState,
  useDemoState,
  usePreferences,
  type TranslationKey,
} from "@/components/providers";

type View = "ask" | "search";
type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status?: "pending" | "error";
  citations?: unknown[];
  related?: unknown[];
  confidence?: number;
  error?: string;
};

const examples: TranslationKey[] = [
  "exampleWork",
  "exampleLand",
  "exampleBusiness",
  "exampleRent",
  "exampleFamily",
  "exampleContract",
];
const topics: TranslationKey[] = [
  "topicWork",
  "topicLand",
  "topicBusiness",
  "topicFamily",
  "topicRent",
];

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function decodeSearchResults(value: unknown): SearchResult[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SearchResult =>
    Boolean(
      item &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      typeof item.lawName === "string" &&
      typeof item.articleNumber === "string" &&
      typeof item.content === "string" &&
      typeof item.source === "string" &&
      typeof item.distance === "number",
    ),
  );
}

function printableSource(source: unknown) {
  if (typeof source === "string") return source;
  if (source === null || source === undefined) return "";
  try {
    return JSON.stringify(source, null, 2);
  } catch {
    return String(source);
  }
}

function sourceLabel(source: unknown, index: number, t: (key: TranslationKey) => string) {
  if (typeof source === "string" && source.trim()) return source;
  return `${t("source")} ${index + 1}`;
}

function Confidence({ value }: { value?: number }) {
  const { t } = usePreferences();
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = value > 1 ? value / 100 : value;
  const level = normalized < 0.4 ? "low" : normalized < 0.75 ? "medium" : "high";
  return (
    <span className={`confidence confidence-${level}`}>
      <Icon name="shield" />
      {t("confidence")}: {t(level)}
    </span>
  );
}

function SourcePanel({
  value,
  title,
  onClose,
}: {
  value: unknown;
  title: string;
  onClose: () => void;
}) {
  const { t } = usePreferences();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const panel = closeRef.current?.closest<HTMLElement>(".source-panel");
        const focusable = panel
          ? Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
          : [];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="panel-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="source-panel" role="dialog" aria-modal="true" aria-labelledby="source-panel-title">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{t("sources")}</span>
            <h2 id="source-panel-title">{title}</h2>
          </div>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label={t("close")}>
            <Icon name="close" />
          </button>
        </div>
        <div className="source-panel-body">
          {typeof value === "string" ? (
            <p className="legal-copy">{value}</p>
          ) : (
            <pre className="source-raw">{printableSource(value)}</pre>
          )}
        </div>
      </aside>
    </div>
  );
}

function SiteHeader({ active }: { active: View }) {
  const { language, setLanguage, theme, toggleTheme, t } = usePreferences();
  const queryClient = useQueryClient();
  const demoState = useDemoState();

  function changeDemoState(value: string) {
    updateDemoState(value);
    queryClient.invalidateQueries();
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/" aria-label={t("homeLabel")}>
          <span className="brand-mark"><Icon name="scale" /></span>
          <span className="brand-name">droit<span>clair</span></span>
        </Link>
        <nav className="desktop-nav" aria-label={t("mainNavigation")}>
          <Link className={active === "ask" ? "nav-link active" : "nav-link"} href="/">
            {t("ask")}
          </Link>
          <Link className={active === "search" ? "nav-link active" : "nav-link"} href="/search">
            {t("search")}
          </Link>
        </nav>
        <div className="header-actions">
          {isDemoMode() && (
            <label className="demo-select">
              <span>{t("demoPreview")}</span>
              <select value={demoState} onChange={(event) => changeDemoState(event.target.value)} aria-label={t("demoPreview")}>
                <option value="success">{t("stateSuccess")}</option>
                <option value="empty">{t("stateEmpty")}</option>
                <option value="loading">{t("stateLoading")}</option>
                <option value="error">{t("stateError")}</option>
              </select>
            </label>
          )}
          <label className="language-select">
            <Icon name="globe" />
            <span className="sr-only">{t("language")}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as "en" | "fr")} aria-label={t("language")}>
              <option value="en">EN</option>
              <option value="fr">FR</option>
            </select>
          </label>
          <button
            className="icon-button theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "light" ? t("darkTheme") : t("lightTheme")}
          >
            <Icon name={theme === "light" ? "moon" : "sun"} />
          </button>
        </div>
      </div>
    </header>
  );
}

function MobileTabs({ active }: { active: View }) {
  const { t } = usePreferences();
  return (
    <nav className="mobile-tabs" aria-label={t("mainNavigation")}>
      <Link href="/" className={active === "ask" ? "mobile-tab active" : "mobile-tab"}>
        <Icon name="message" /><span>{t("askNav")}</span>
      </Link>
      <Link href="/search" className={active === "search" ? "mobile-tab active" : "mobile-tab"}>
        <Icon name="search" /><span>{t("searchNav")}</span>
      </Link>
    </nav>
  );
}

function DemoError({ onRetry, message }: { onRetry: () => void; message?: string }) {
  const { t } = usePreferences();
  return (
    <div className="inline-error" role="alert">
      <span>{message ?? t("serviceError")}</span>
      <button className="text-button" onClick={onRetry}>{t("retry")}</button>
    </div>
  );
}

function highlightText(text: string, query: string) {
  const terms = query.trim().split(/\s+/).filter((term) => term.length > 1);
  if (!terms.length) return text;
  const expression = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(expression).map((part, index) =>
    terms.some((term) => part.toLowerCase() === term.toLowerCase())
      ? <mark key={`${part}-${index}`}>{part}</mark>
      : part,
  );
}

function SearchScreen({
  setPanel,
}: {
  setPanel: (value: { value: unknown; title: string } | null) => void;
}) {
  const { language, t } = usePreferences();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem("law-recent-searches") ?? "[]");
        if (Array.isArray(saved)) setRecent(saved.filter((item): item is string => typeof item === "string").slice(0, 5));
      } catch {
        setRecent([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const query = useQuery({
    queryKey: ["law-search", submitted],
    queryFn: async () => decodeSearchResults(await searchLaws(submitted)),
    enabled: submitted.length > 0,
  });

  const performSearch = useCallback((value: string) => {
    const normalized = value.trim();
    if (!normalized || normalized.length > 1000) return;
    setDraft(normalized);
    setSubmitted(normalized);
    const next = [normalized, ...recent.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 5);
    setRecent(next);
    window.localStorage.setItem("law-recent-searches", JSON.stringify(next));
  }, [recent]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    performSearch(draft);
  }

  function askAbout(result: SearchResult) {
    const question = `Please explain ${result.articleNumber} of ${result.lawName} in plain language.`;
    window.sessionStorage.setItem("law-pending-question", question.slice(0, 1000));
    router.push("/");
  }

  const results = query.data ?? [];
  const hasSubmitted = submitted.length > 0;
  const queryError = query.error
    ? getErrorMessage(query.error, language, t("serviceError"))
    : "";

  return (
    <section className="search-page">
      <div className="page-intro">
        <span className="eyebrow"><Icon name="book" /> {t("searchEyebrow")}</span>
        <h1>{t("searchTitle")}</h1>
        <p>{t("searchBody")}</p>
      </div>

      <form className="search-form" onSubmit={submit}>
        <Icon name="search" className="search-form-icon" />
        <input
          value={draft}
          maxLength={1000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchTitle")}
        />
        {draft && (
          <button type="button" className="icon-button clear-search" aria-label={t("close")} onClick={() => {
            setDraft("");
            setSubmitted("");
          }}>
            <Icon name="close" />
          </button>
        )}
        <span className="search-count">{draft.length}/1000</span>
        <button className="button button-primary search-submit" disabled={!draft.trim() || query.isFetching}>
          <span>{t("searchButton")}</span><Icon name="arrow" />
        </button>
      </form>

      {!hasSubmitted && (
        <div className="topic-area">
          <div className="section-title-row">
            <h2>{t("suggestions")}</h2>
            <Icon name="layers" />
          </div>
          <div className="topic-list">
            {topics.map((topic) => (
              <button key={topic} className="topic-chip" onClick={() => performSearch(t(topic))}>
                {t(topic)}<Icon name="arrow" />
              </button>
            ))}
          </div>
          {recent.length > 0 && (
            <div className="recent-area">
              <div className="recent-heading">
                <h3>{t("recentSearches")}</h3>
                <button className="text-button" onClick={() => {
                  setRecent([]);
                  window.localStorage.removeItem("law-recent-searches");
                }}>{t("clearSearches")}</button>
              </div>
              <div className="recent-list">
                {recent.map((item) => (
                  <button key={item} className="recent-item" onClick={() => performSearch(item)}>
                    <Icon name="clock" />{item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {hasSubmitted && (
        <div className="results-area" aria-live="polite">
          <div className="results-heading">
            <div>
              <span className="eyebrow">{query.isFetching ? t("pending") : `${results.length} ${results.length === 1 ? t("resultCountSingular") : t("resultCount")}`}</span>
              <h2>“{submitted}”</h2>
            </div>
          </div>
          {query.isFetching && (
            <div className="result-skeletons" aria-label={t("pending")}>
              {[0, 1, 2].map((item) => <div className="skeleton result-skeleton" key={item} />)}
            </div>
          )}
          {query.isError && <DemoError message={queryError} onRetry={() => query.refetch()} />}
          {!query.isFetching && !query.isError && results.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon"><Icon name="search" /></span>
              <h3>{t("noResults")}</h3>
              <p>{t("searchInitial")}</p>
              <Link className="button button-secondary" href="/">{t("ask")}</Link>
            </div>
          )}
          {!query.isFetching && results.length > 0 && (
            <div className="result-list">
              {results.map((result) => {
                const isExpanded = expanded.includes(result.id);
                const text = isExpanded ? result.content : result.content.slice(0, 290);
                const needsMore = result.content.length > 290;
                return (
                  <article className="article-card" key={result.id}>
                    <div className="article-card-top">
                      <span className="article-badge">{result.articleNumber}</span>
                      <button
                        className="article-open"
                        aria-label={`${t("source")}: ${result.lawName} ${result.articleNumber}`}
                        onClick={() => setPanel({
                          title: `${result.lawName} · ${result.articleNumber}`,
                          value: result.content,
                        })}
                      >
                        <Icon name="arrow" />
                      </button>
                    </div>
                    <h3>{result.lawName}</h3>
                    <p className="article-excerpt">{highlightText(text, submitted)}{needsMore && !isExpanded ? "…" : ""}</p>
                    {needsMore && (
                      <button className="text-button read-more" onClick={() => setExpanded((current) =>
                        isExpanded ? current.filter((id) => id !== result.id) : [...current, result.id],
                      )}>{isExpanded ? t("readLess") : t("readMore")}</button>
                    )}
                    <div className="article-card-footer">
                      <span><Icon name="file" />{result.source}</span>
                      <button className="ask-article" onClick={() => askAbout(result)}>
                        {t("askAboutArticle")}<Icon name="chevron" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ChatScreen({
  setPanel,
}: {
  setPanel: (value: { value: unknown; title: string } | null) => void;
}) {
  const { language, t } = usePreferences();
  const [question, setQuestion] = useState("");
  const [userId, setUserId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState(false);
  const [firstVisitNotice, setFirstVisitNotice] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState("");
  const [copyError, setCopyError] = useState<{ id: string; message: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const noticeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedUserId = window.localStorage.getItem("law-user-id") || makeId();
      const savedSessionId = window.localStorage.getItem("law-session-id") || makeId();
      window.localStorage.setItem("law-user-id", savedUserId);
      window.localStorage.setItem("law-session-id", savedSessionId);
      setUserId(savedUserId);
      setSessionId(savedSessionId);
      try {
        const stored = JSON.parse(window.localStorage.getItem(`law-messages-${savedSessionId}`) ?? "[]");
        if (Array.isArray(stored)) setMessages(stored.filter((item): item is Message =>
          item && typeof item.id === "string" &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.text === "string" &&
          item.status !== "pending",
        ));
      } catch {
        setMessages([]);
      }
      setNoticeDismissed(window.localStorage.getItem("law-disclaimer-dismissed") === "true");
      setFirstVisitNotice(window.localStorage.getItem("law-first-visit-seen") !== "true");
      setReady(true);

      const pendingQuestion = window.sessionStorage.getItem("law-pending-question");
      if (pendingQuestion) {
        setQuestion(pendingQuestion);
        window.sessionStorage.removeItem("law-pending-question");
        window.setTimeout(() => textareaRef.current?.focus(), 0);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready && sessionId) {
      window.localStorage.setItem(`law-messages-${sessionId}`, JSON.stringify(messages));
    }
  }, [messages, ready, sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!firstVisitNotice) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    noticeButtonRef.current?.focus();
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Tab") {
        event.preventDefault();
        noticeButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [firstVisitNotice]);

  const mutation = useMutation({
    mutationFn: (variables: { query: string; userId: string; sessionId: string; assistantId: string }) =>
      askLegalQuestion({ query: variables.query, userId: variables.userId, sessionId: variables.sessionId }),
    onSuccess: (result, variables) => {
      const answer = typeof result?.data?.answer === "string" ? result.data.answer : "";
      if (!answer) {
        setMessages((items) => items.map((item) => item.id === variables.assistantId
          ? { ...item, status: "error", error: t("serviceError") }
          : item));
        return;
      }
      const confidence = result?.data?.reasoning?.confidence;
      setMessages((items) => items.map((item) => item.id === variables.assistantId
        ? {
            ...item,
            text: answer,
            status: undefined,
            citations: Array.isArray(result.data.citations) ? result.data.citations : [],
            related: Array.isArray(result.data.relatedArticles) ? result.data.relatedArticles : [],
            confidence: typeof confidence === "number" ? confidence : undefined,
          }
        : item));
    },
    onError: (error, variables) => {
      setMessages((items) => items.map((item) => item.id === variables.assistantId
        ? { ...item, status: "error", error: getErrorMessage(error, language, t("serviceError")) }
        : item));
    },
  });

  const send = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || mutation.isPending) return;
    if (trimmed.length > 1000) {
      setQuestion(trimmed.slice(0, 1000));
      return;
    }
    if (!userId || !sessionId) return;
    const userMessage: Message = { id: makeId(), role: "user", text: trimmed };
    const assistantId = makeId();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      text: "",
      status: "pending",
    };
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setQuestion("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    mutation.mutate({ query: trimmed, userId, sessionId, assistantId });
  }, [mutation, sessionId, userId]);

  function retryMessage(index: number) {
    const assistant = messages[index];
    const user = messages[index - 1];
    if (!assistant || !user || user.role !== "user" || assistant.role !== "assistant") return;
    setMessages((current) => current.map((item) => item.id === assistant.id
      ? { ...item, status: "pending", error: undefined }
      : item));
    mutation.mutate({ query: user.text, userId, sessionId, assistantId: assistant.id });
  }

  function newConversation() {
    const nextId = makeId();
    window.localStorage.setItem("law-session-id", nextId);
    setSessionId(nextId);
    setMessages([]);
    setQuestion("");
    textareaRef.current?.focus();
  }

  function clearSavedData() {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("law-messages-") || key === "law-user-id" || key === "law-session-id") {
        window.localStorage.removeItem(key);
      }
    }
    const nextUser = makeId();
    const nextSession = makeId();
    window.localStorage.setItem("law-user-id", nextUser);
    window.localStorage.setItem("law-session-id", nextSession);
    setUserId(nextUser);
    setSessionId(nextSession);
    setMessages([]);
  }

  function resizeTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(question);
    }
  }

  async function copyAnswer(text: string, messageId: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setCopyError(null);
    } catch {
      setCopyError({ id: messageId, message: t("copyFailed") });
    }
  }

  return (
    <section className="chat-page">
      <div className="chat-topline">
        <div className="chat-title">
          <span className="assistant-avatar"><Icon name="scale" /></span>
          <div>
            <strong>Droit clair</strong>
            <span className="assistant-status"><i /> {language === "fr" ? "Assistant juridique" : "Legal assistant"}</span>
          </div>
        </div>
        <div className="chat-actions">
          {messages.length > 0 && (
            <button className="header-text-button" onClick={clearSavedData} title={t("clearData")}>
              <Icon name="close" /><span>{t("clearData")}</span>
            </button>
          )}
          <button className="button button-secondary new-chat" onClick={newConversation}>
            <Icon name="plus" /><span>{t("newConversation")}</span>
          </button>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="chat-empty">
          <div className="hero-orb"><Icon name="scale" /></div>
          <span className="eyebrow">{t("welcomeEyebrow")}</span>
          <h1>{t("welcomeTitle")}</h1>
          <p>{t("welcomeBody")}</p>
          <div className="example-area">
            <span className="example-label">{t("exampleTitle")}</span>
            <div className="example-list">
              {examples.map((key) => (
                <button className="example-chip" key={key} onClick={() => send(t(key))}>
                  <span>{t(key)}</span><Icon name="arrow" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="conversation" aria-live="polite">
          {messages.map((message, index) => (
            <div className={`message-row ${message.role}`} key={message.id}>
              {message.role === "assistant" && (
                <span className="message-avatar"><Icon name="scale" /></span>
              )}
              <div className="message-content">
                <div className={`message-bubble ${message.role} ${message.status === "error" ? "message-error" : ""}`}>
                  {message.status === "pending" ? (
                    <div className="typing-state" aria-label={t("pending")}>
                      <span className="typing-dots"><i /><i /><i /></span><span>{t("pending")}</span>
                    </div>
                  ) : message.status === "error" ? (
                    <div className="error-message" role="alert">
                      <span>{message.error}</span>
                      <button className="text-button retry-button" onClick={() => retryMessage(index)}>
                        <Icon name="retry" />{t("retry")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <ReactMarkdown
                        components={{
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noreferrer">{children}</a>
                          ),
                          img: () => null,
                        }}
                      >
                        {message.text}
                      </ReactMarkdown>
                      {message.role === "assistant" && (
                        <div className="answer-meta">
                          <Confidence value={message.confidence} />
                          {message.citations?.length ? (
                            <div className="citation-section">
                              <span className="citation-label">{t("sources")}</span>
                              <div className="citation-list">
                                {message.citations.map((citation, citationIndex) => {
                                  const label = sourceLabel(citation, citationIndex, t);
                                  return (
                                    <button
                                      className="citation-chip"
                                      key={`${message.id}-${citationIndex}`}
                                      onClick={() => setPanel({ title: label, value: citation })}
                                    >
                                      <Icon name="book" /><span>{label}</span><Icon name="arrow" />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <p className="no-citation-note"><Icon name="info" />{t("noSources")}</p>
                          )}
                          {!!message.related?.length && (
                            <details className="related-articles">
                              <summary>{t("related")} <Icon name="chevron" /></summary>
                              <div className="related-list">
                                {message.related.map((article, relatedIndex) => {
                                  const label = sourceLabel(article, relatedIndex, t);
                                  return (
                                    <button
                                      className="related-chip"
                                      key={`${message.id}-related-${relatedIndex}`}
                                      onClick={() => setPanel({ title: label, value: article })}
                                    >{label}</button>
                                  );
                                })}
                              </div>
                            </details>
                          )}
                          <button className="copy-answer" onClick={() => void copyAnswer(message.text, message.id)} aria-label={t("copy")}>
                            <Icon name="copy" />{copiedMessageId === message.id ? t("copied") : t("copy")}
                          </button>
                          {copyError?.id === message.id && <p className="copy-error" role="status">{copyError.message}</p>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      <div className="composer-wrap">
        <form className="composer" onSubmit={(event) => {
          event.preventDefault();
          send(question);
        }}>
          <textarea
            ref={textareaRef}
            value={question}
            maxLength={1000}
            onChange={(event) => {
              setQuestion(event.target.value);
              resizeTextarea();
            }}
            onKeyDown={onInputKeyDown}
            placeholder={t("askPlaceholder")}
            aria-label={t("askPlaceholder")}
            rows={1}
            disabled={mutation.isPending}
          />
          <div className="composer-bottom">
            <span className="composer-hint">{language === "fr" ? "Entrée pour envoyer · Maj + Entrée pour un saut de ligne" : "Enter to send · Shift + Enter for a new line"}</span>
            <div className="composer-right">
              {question.length >= 850 && <span className={`character-count ${question.length >= 1000 ? "limit" : ""}`}>{question.length}/1000</span>}
              <button className="send-button" type="submit" disabled={!question.trim() || mutation.isPending} aria-label={t("send")}>
                <Icon name="send" />
              </button>
            </div>
          </div>
        </form>
        <p className="composer-disclaimer"><Icon name="shield" />{t("disclaimer")}</p>
      </div>
      {firstVisitNotice && (
        <div className="notice-backdrop">
          <section className="notice-modal" role="dialog" aria-modal="true" aria-labelledby="first-visit-title">
            <span className="notice-icon"><Icon name="shield" /></span>
            <span className="eyebrow">{t("firstVisit")}</span>
            <h2 id="first-visit-title">{t("disclaimer")}</h2>
            <p>{t("disclaimerLong")}</p>
            <button ref={noticeButtonRef} className="button button-primary" onClick={() => {
              window.localStorage.setItem("law-first-visit-seen", "true");
              setFirstVisitNotice(false);
            }}>{t("gotIt")}</button>
          </section>
        </div>
      )}
      {!noticeDismissed && !firstVisitNotice && (
        <div className="disclaimer-toast" role="status">
          <Icon name="info" /><span>{t("disclaimer")}</span>
          <button className="icon-button" onClick={() => {
            window.localStorage.setItem("law-disclaimer-dismissed", "true");
            setNoticeDismissed(true);
          }} aria-label={t("close")}><Icon name="close" /></button>
        </div>
      )}
    </section>
  );
}

export function PublicWorkspace({ initialView }: { initialView: View }) {
  const { t } = usePreferences();
  const [panel, setPanel] = useState<{ value: unknown; title: string } | null>(null);
  const [footerDismissed, setFooterDismissed] = useState(false);
  const onClosePanel = useCallback(() => setPanel(null), []);

  return (
    <div className="app-shell public-shell">
      <SiteHeader active={initialView} />
      <main className={`main-content ${initialView === "ask" ? "main-chat" : "main-search"}`}>
        {initialView === "ask" ? <ChatScreen setPanel={setPanel} /> : <SearchScreen setPanel={setPanel} />}
      </main>
      <footer className={`site-footer ${footerDismissed ? "dismissed" : ""}`}>
        <Icon name="shield" /><span>{t("disclaimer")}</span>
        <Link href="/privacy">{t("privacy")}</Link>
        {!footerDismissed && (
          <button className="footer-close" onClick={() => setFooterDismissed(true)} aria-label={t("close")}><Icon name="close" /></button>
        )}
      </footer>
      <MobileTabs active={initialView} />
      {panel && <SourcePanel value={panel.value} title={panel.title} onClose={onClosePanel} />}
    </div>
  );
}
