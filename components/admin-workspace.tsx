"use client";

import Link from "next/link";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ApiError,
  getAdminIndex,
  getAdminOverview,
  getAdminSeries,
  getErrorMessage,
  isDemoMode,
  reingestLaws,
  sendBroadcast,
  type IndexStatus,
  type Overview,
  type ReingestResult,
} from "@/lib/api";
import { Icon } from "@/components/icons";
import {
  updateDemoState,
  useDemoState,
  usePreferences,
  type Language,
  type TranslationKey,
} from "@/components/providers";

type Period = "daily" | "weekly" | "monthly";

const ranges: Record<Period, number[]> = {
  daily: [7, 30, 90],
  weekly: [4, 12, 26],
  monthly: [6, 12, 24],
};

function isAdminConfigurationError(error: unknown) {
  return error instanceof ApiError && [
    "ADMIN_GATE_NOT_CONFIGURED",
    "ADMIN_KEY_NOT_CONFIGURED",
    "API_BASE_NOT_CONFIGURED",
    "API_BASE_INVALID",
  ].includes(error.code ?? "");
}

function isAdminAccessError(error: unknown) {
  return error instanceof ApiError && error.code === "ADMIN_ACCESS_REQUIRED";
}

function AdminHeader() {
  const { language, setLanguage, theme, toggleTheme, t } = usePreferences();
  const queryClient = useQueryClient();
  const demoState = useDemoState();
  const [menuOpen, setMenuOpen] = useState(false);

  function changeDemoState(value: string) {
    updateDemoState(value);
    queryClient.invalidateQueries();
  }

  return (
    <header className="admin-header">
      <Link className="brand" href="/" aria-label={t("homeLabel")}>
        <span className="brand-mark"><Icon name="scale" /></span>
        <span className="brand-name">droit<span>clair</span></span>
      </Link>
      <span className="admin-header-label">{t("admin")}</span>
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
          <Icon name="globe" /><span className="sr-only">{t("language")}</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label={t("language")}>
            <option value="en">EN</option><option value="fr">FR</option>
          </select>
        </label>
        <button className="icon-button theme-toggle" onClick={toggleTheme} aria-label={theme === "light" ? t("darkTheme") : t("lightTheme")}>
          <Icon name={theme === "light" ? "moon" : "sun"} />
        </button>
        <button className="icon-button admin-menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label={t("toggleAdminMenu")} aria-expanded={menuOpen}>
          <Icon name={menuOpen ? "close" : "menu"} />
        </button>
      </div>
      {menuOpen && <AdminNavigation mobile onNavigate={() => setMenuOpen(false)} />}
    </header>
  );
}

function AdminNavigation({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const { t } = usePreferences();
  return (
    <nav className={mobile ? "admin-mobile-menu" : "admin-sidebar"} aria-label={t("adminNavigation")}>
      <span className="admin-nav-label">{t("admin")}</span>
      <a href="#overview" onClick={onNavigate}><Icon name="chart" />{t("usage")}</a>
      <a href="#index" onClick={onNavigate}><Icon name="layers" />{t("indexedChunks")}</a>
      <a href="#broadcast" onClick={onNavigate}><Icon name="message" />{t("broadcastTitle")}</a>
      <div className="sidebar-bottom">
        <span className="sidebar-lock"><Icon name="shield" /></span>
        <span>{t("adminUnavailableBody")}</span>
      </div>
    </nav>
  );
}

function AdminModal({
  title,
  description,
  confirmLabel,
  danger = false,
  disabled = false,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const { t } = usePreferences();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
      }
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ));
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
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <div className="confirm-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description">
        <span className={`modal-icon ${danger ? "danger" : ""}`}><Icon name={danger ? "info" : "shield"} /></span>
        <h2 id="modal-title">{title}</h2>
        <p id="modal-description">{description}</p>
        {children}
        <div className="modal-actions">
          <button className="button button-secondary" onClick={onCancel}>{t("cancel")}</button>
          <button
            ref={confirmRef}
            className={`button ${danger ? "button-destructive" : "button-primary"}`}
            onClick={onConfirm}
            disabled={disabled}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: "users" | "calendar" | "chart" | "layers" }) {
  return (
    <article className="stat-card">
      <span className="stat-icon"><Icon name={icon} /></span>
      <span className="stat-label">{label}</span>
      <strong>{value.toLocaleString()}</strong>
      <span className="stat-footnote">{usePreferences().t("country")}</span>
    </article>
  );
}

function SeriesChart({
  period,
  range,
  isFrench,
  t,
}: {
  period: Period;
  range: number;
  isFrench: boolean;
  t: (key: TranslationKey) => string;
}) {
  const series = useQuery({
    queryKey: ["admin-series", period, range],
    queryFn: () => getAdminSeries(period, range),
  });
  const [showTable, setShowTable] = useState(false);
  const rows = useMemo(() => {
    if (period === "daily") return series.data?.days?.map(({ date, users }) => ({ label: date, users })) ?? [];
    if (period === "weekly") return series.data?.weeks?.map(({ weekStart, users }) => ({ label: weekStart, users })) ?? [];
    return series.data?.months?.map(({ month, users }) => ({ label: month, users })) ?? [];
  }, [period, series.data]);
  const max = Math.max(1, ...rows.map((row) => row.users));
  const width = 720;
  const height = 250;
  const left = 42;
  const right = 18;
  const top = 18;
  const bottom = 36;
  const points = rows.map((row, index) => {
    const x = rows.length <= 1
      ? width / 2
      : left + index * (width - left - right) / (rows.length - 1);
    const y = top + (max - row.users) * (height - top - bottom) / max;
    return { ...row, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const heading = `${t(period)} · ${range} ${period === "daily" ? (isFrench ? "jours" : "days") : period === "weekly" ? (isFrench ? "semaines" : "weeks") : (isFrench ? "mois" : "months")}`;

  return (
    <section className="panel chart-panel">
      <div className="panel-title-row">
        <div>
          <span className="eyebrow">{t("usage")}</span>
          <h2>{heading}</h2>
        </div>
        <button className="chart-view-toggle" onClick={() => setShowTable((value) => !value)}>
          <Icon name={showTable ? "chart" : "layers"} />{showTable ? t("chartGraph") : t("chartTable")}
        </button>
      </div>
      {series.isPending && <div className="skeleton chart-skeleton" />}
      {series.isError && (
        <div className="chart-error" role="alert">
          <span>{getErrorMessage(series.error, isFrench ? "fr" : "en", t("serviceError"))}</span>
          <button className="text-button" onClick={() => series.refetch()}>{t("retry")}</button>
        </div>
      )}
      {!series.isPending && !series.isError && showTable && (
        <div className="chart-table-scroll">
          <table>
            <thead><tr><th>{t(period === "daily" ? "chartDate" : period === "weekly" ? "chartWeek" : "chartMonth")}</th><th>{t("totalUsers")}</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.users}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {!series.isPending && !series.isError && !showTable && rows.length > 0 && (
        <div className="chart-canvas">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${heading}, ${rows.length} ${t("dataPoints")}`}
            preserveAspectRatio="none"
          >
            {[0, 0.5, 1].map((fraction) => {
              const y = top + fraction * (height - top - bottom);
              return <g key={fraction}><line x1={left} y1={y} x2={width - right} y2={y} className="chart-grid" /><text x="0" y={y + 4} className="chart-axis-label">{Math.round(max * (1 - fraction))}</text></g>;
            })}
            <path d={`${path} L ${points[points.length - 1]?.x ?? left} ${height - bottom} L ${points[0]?.x ?? left} ${height - bottom} Z`} className="chart-area" />
            <path d={path} className="chart-line" />
            {points.map((point) => (
              <g key={point.label}>
                <circle cx={point.x} cy={point.y} r="4" className="chart-point"><title>{point.label}: {point.users}</title></circle>
              </g>
            ))}
            {points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 5) === 0).map((point) => (
              <text key={`label-${point.label}`} x={point.x} y={height - 8} textAnchor="middle" className="chart-axis-label">{point.label.slice(5)}</text>
            ))}
          </svg>
        </div>
      )}
      {!series.isPending && !series.isError && rows.length === 0 && (
        <div className="chart-empty">{t("noResults")}</div>
      )}
      <div className="chart-legend"><span><i />{t("totalUsers")}</span></div>
    </section>
  );
}

function ResultLists({ result, isFrench }: { result: ReingestResult; isFrench: boolean }) {
  const { t } = usePreferences();
  if (result.message === "Ingestion already running") {
    return <p className="info-message"><Icon name="info" />{t("alreadyRunning")}</p>;
  }
  const groups = [
    { key: "ingested", label: t("ingested"), items: result.ingested ?? [], tone: "success" },
    { key: "skipped", label: t("skipped"), items: result.skipped ?? [], tone: "neutral" },
    { key: "failed", label: t("failed"), items: result.failed ?? [], tone: "danger" },
  ];
  return (
    <div className="ingest-results">
      {groups.map((group) => (
        <details className={`ingest-result ${group.tone}`} key={group.key} open={group.items.length > 0 && group.key === "failed"}>
          <summary><span>{group.label}</span><strong>{group.items.length}</strong><Icon name="chevron" /></summary>
          {!!group.items.length && <ul>{group.items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}
        </details>
      ))}
      {!result.success && !result.message && <p className="error-inline">{isFrench ? "L’indexation n’a pas abouti. Vérifiez le résultat puis réessayez." : "Ingestion did not complete. Review the result and try again."}</p>}
    </div>
  );
}

function AdminConfiguration({ accessDenied = false }: { accessDenied?: boolean }) {
  const { t } = usePreferences();
  return (
    <main className="admin-disabled">
      <span className="disabled-icon"><Icon name={accessDenied ? "shield" : "layers"} /></span>
      <span className="eyebrow">{t("admin")}</span>
      <h1>{accessDenied ? t("adminGateNeeded") : t("adminUnavailable")}</h1>
      <p>{t("adminUnavailableBody")}</p>
      <div className="configuration-steps">
        <div><span>01</span><p>{t("adminStep1")}</p></div>
        <div><span>02</span><p>{t("adminStep2")} (<code>LAW_API_BASE_URL</code>, <code>LAW_ADMIN_API_KEY</code>, <code>ADMIN_ACCESS_GATE_TOKEN</code>).</p></div>
        <div><span>03</span><p>{t("adminStep3")}</p></div>
      </div>
      <Link href="/" className="button button-secondary"><Icon name="arrow" />{t("backToAsk")}</Link>
    </main>
  );
}

export function AdminWorkspace() {
  const { language, t } = usePreferences();
  const isFrench = language === "fr";
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: getAdminOverview });
  const index = useQuery({ queryKey: ["admin-index"], queryFn: getAdminIndex });
  const [period, setPeriod] = useState<Period>("daily");
  const [range, setRange] = useState(ranges.daily[1]);
  const [reingestOpen, setReingestOpen] = useState(false);
  const [ingestResult, setIngestResult] = useState<ReingestResult | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [sendConfirmation, setSendConfirmation] = useState("");
  const [broadcastResult, setBroadcastResult] = useState<{ totalRecipients: number; sent: number; failed: number } | null>(null);
  const [broadcastError, setBroadcastError] = useState("");

  const reingestMutation = useMutation({
    mutationFn: reingestLaws,
    onSuccess: (result) => {
      setIngestResult(result);
      setReingestOpen(false);
      void index.refetch();
    },
    onError: (error) => {
      setReingestOpen(false);
      setIngestResult({
        success: false,
        failed: [getErrorMessage(error, language, t("serviceError"))],
      });
    },
  });
  const broadcastMutation = useMutation({
    mutationFn: sendBroadcast,
    onSuccess: (result) => {
      setBroadcastResult(result);
      setBroadcastError("");
      setBroadcastOpen(false);
      setSendConfirmation("");
      setBroadcastMessage("");
    },
    onError: (error) => setBroadcastError(getErrorMessage(error, language, t("serviceError"))),
  });
  const isConfiguredError = isAdminConfigurationError(overview.error) || isAdminConfigurationError(index.error);
  const isAccessError = isAdminAccessError(overview.error) || isAdminAccessError(index.error);

  function selectPeriod(next: Period) {
    setPeriod(next);
    setRange(ranges[next][1]);
  }

  function submitBroadcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = broadcastMessage.trim();
    if (!trimmed || trimmed.length > 1600) {
      setBroadcastError(isFrench ? "Le message doit contenir de 1 à 1600 caractères après suppression des espaces." : "The trimmed message must contain 1 to 1600 characters.");
      return;
    }
    setBroadcastError("");
    setBroadcastOpen(true);
  }

  function confirmBroadcast() {
    const trimmed = broadcastMessage.trim();
    if (sendConfirmation !== "SEND" || trimmed.length < 1 || trimmed.length > 1600) return;
    broadcastMutation.mutate(trimmed);
  }

  const overviewData: Overview | undefined = overview.data;
  const indexData: IndexStatus | undefined = index.data;

  if (overview.isPending || index.isPending) {
    return (
      <div className="app-shell admin-shell">
        <AdminHeader />
        <div className="admin-loading"><div className="skeleton admin-welcome-skeleton" /><div className="skeleton admin-card-skeleton" /><p>{t("checkConfiguration")}</p></div>
      </div>
    );
  }
  if (isConfiguredError || isAccessError) {
    return (
      <div className="app-shell admin-shell">
        <AdminHeader />
        <AdminConfiguration accessDenied={isAccessError} />
      </div>
    );
  }
  if (overview.isError || index.isError) {
    return (
      <div className="app-shell admin-shell">
        <AdminHeader />
        <main className="admin-disabled">
          <span className="disabled-icon"><Icon name="info" /></span>
          <h1>{t("serviceError")}</h1>
          <p>{getErrorMessage(overview.error ?? index.error, language, t("serviceError"))}</p>
          <button className="button button-secondary" onClick={() => {
            void overview.refetch();
            void index.refetch();
          }}><Icon name="retry" />{t("retry")}</button>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell admin-shell">
      <AdminHeader />
      <AdminNavigation />
      <main className="admin-content">
        <section className="admin-welcome" id="overview">
          <div>
            <span className="eyebrow"><Icon name="shield" /> {t("privateWorkspace")}</span>
            <h1>{t("adminTitle")}</h1>
            <p>{t("adminIntro")}</p>
          </div>
          <span className="secure-pill"><i />{isFrench ? "Accès sécurisé" : "Secure access"}</span>
        </section>

        <section className="stats-grid" aria-label={t("usage")}>
          <StatCard label={t("totalUsers")} value={overviewData?.totalUsers ?? 0} icon="users" />
          <StatCard label={t("today")} value={overviewData?.todayUsers ?? 0} icon="calendar" />
          <StatCard label={t("thisWeek")} value={overviewData?.thisWeekUsers ?? 0} icon="chart" />
          <StatCard label={t("thisMonth")} value={overviewData?.thisMonthUsers ?? 0} icon="layers" />
        </section>

        <section className="admin-section">
          <div className="section-title-row admin-section-heading">
            <div><span className="eyebrow">{t("usage")}</span><h2>{isFrench ? "Utilisation au fil du temps" : "Usage over time"}</h2></div>
            <div className="segmented-control" role="tablist" aria-label={t("usage")}>
              {(["daily", "weekly", "monthly"] as const).map((item) => (
                <button
                  key={item}
                  role="tab"
                  aria-selected={period === item}
                  className={period === item ? "selected" : ""}
                  onClick={() => selectPeriod(item)}
                >{t(item)}</button>
              ))}
            </div>
          </div>
          <div className="range-row">
            <label htmlFor="chart-range">{t("period")}</label>
            <select id="chart-range" value={range} onChange={(event) => setRange(Number(event.target.value))}>
              {ranges[period].map((item) => (
                <option key={item} value={item}>
                  {item} {period === "daily" ? (isFrench ? "jours" : "days") : period === "weekly" ? (isFrench ? "semaines" : "weeks") : (isFrench ? "mois" : "months")}
                </option>
              ))}
            </select>
          </div>
          <SeriesChart key={`${period}-${range}`} period={period} range={range} isFrench={isFrench} t={t} />
        </section>

        <section className="admin-section" id="index">
          <div className="section-title-row admin-section-heading">
            <div><span className="eyebrow">{isFrench ? "COLLECTION JURIDIQUE" : "LEGAL COLLECTION"}</span><h2>{isFrench ? "État de l’index" : "Index status"}</h2></div>
          </div>
          <div className="index-layout">
            <article className="panel index-total">
              <span className="stat-icon"><Icon name="layers" /></span>
              <span className="stat-label">{t("indexedChunks")}</span>
              <strong>{(indexData?.totalChunks ?? 0).toLocaleString()}</strong>
              <span className={`index-status-pill ${indexData?.isEmpty ? "empty" : "ready"}`}>
                <i />{indexData?.isEmpty ? t("emptyIndex") : t("indexReady")}
              </span>
            </article>
            <article className="panel source-breakdown">
              <div className="panel-title-row">
                <div><span className="eyebrow">{t("indexedChunks")}</span><h3>{t("indexSources")}</h3></div>
                <span className="source-count">{indexData?.lawsBySource.length ?? 0} {t("sourceCount")}</span>
              </div>
              {indexData?.isEmpty ? (
                <div className="index-empty">
                  <Icon name="info" /><strong>{t("emptyIndex")}</strong><span>{t("emptyIndexBody")}</span>
                </div>
              ) : (
                <div className="source-bars">
                  {(indexData?.lawsBySource ?? []).map((item, indexItem) => (
                    <div className="source-bar-row" key={`${item.source}-${indexItem}`}>
                      <div className="source-bar-label"><span>{item.source}</span><strong>{item.chunks.toLocaleString()}</strong></div>
                      <div className="source-bar-track"><span style={{ width: `${indexData?.totalChunks ? Math.max(2, item.chunks / indexData.totalChunks * 100) : 0}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
          <div className="maintenance-zone">
            <div>
              <span className="maintenance-label">{t("maintenance")}</span>
              <p>{isFrench ? "Relancez l’indexation des documents de loi disponibles." : "Rebuild the index from the available law documents."}</p>
            </div>
            <button className="button button-destructive" onClick={() => setReingestOpen(true)} disabled={reingestMutation.isPending}>
              {reingestMutation.isPending ? <span className="button-spinner" /> : <Icon name="retry" />}{t("reingest")}
            </button>
          </div>
          {ingestResult && <ResultLists result={ingestResult} isFrench={isFrench} />}
          {reingestMutation.isError && <p className="error-inline" role="alert">{getErrorMessage(reingestMutation.error, language, t("serviceError"))}</p>}
        </section>

        <section className="admin-section" id="broadcast">
          <div className="section-title-row admin-section-heading">
            <div><span className="eyebrow">WHATSAPP</span><h2>{t("broadcastTitle")}</h2><p>{t("broadcastBody")}</p></div>
          </div>
          <div className="broadcast-layout">
            <form className="panel broadcast-form" onSubmit={submitBroadcast}>
              <label htmlFor="broadcast-message">{isFrench ? "Votre message" : "Your message"}</label>
              <textarea
                id="broadcast-message"
                maxLength={1600}
                value={broadcastMessage}
                onChange={(event) => {
                  setBroadcastMessage(event.target.value);
                  setBroadcastError("");
                }}
                placeholder={t("broadcastPlaceholder")}
              />
              <div className="broadcast-form-bottom">
                <span className={broadcastMessage.trim().length > 1600 ? "character-count limit" : "character-count"}>
                  {broadcastMessage.trim().length}/1600
                </span>
                <button className="button button-destructive" disabled={!broadcastMessage.trim() || broadcastMutation.isPending}>
                  <Icon name="send" />{t("sendBroadcast")}
                </button>
              </div>
              {broadcastError && <p className="error-inline" role="alert">{broadcastError}</p>}
            </form>
            <aside className="broadcast-preview">
              <span className="eyebrow">{t("preview")}</span>
              <div className="whatsapp-frame">
                <div className="whatsapp-top"><span className="wa-avatar">DC</span><span><strong>Droit clair</strong><small>WhatsApp</small></span></div>
                <div className="whatsapp-bubble">
                  <p>{broadcastMessage.trim() || t("broadcastPlaceholder")}</p>
                  <small>09:41 ✓✓</small>
                </div>
              </div>
            </aside>
          </div>
          {broadcastResult && (
            <article className="broadcast-result" aria-live="polite">
              <div className="broadcast-result-icon"><Icon name="check" /></div>
              <div><span className="eyebrow">{isFrench ? "DIFFUSION TERMINÉE" : "BROADCAST COMPLETE"}</span><h3>{broadcastResult.sent.toLocaleString()} / {broadcastResult.totalRecipients.toLocaleString()} {t("sent").toLowerCase()}</h3></div>
              <div className="broadcast-result-stats">
                <span>{t("recipients")} <strong>{broadcastResult.totalRecipients.toLocaleString()}</strong></span>
                <span>{t("sent")} <strong>{broadcastResult.sent.toLocaleString()}</strong></span>
                <span>{t("failedRecipients")} <strong>{broadcastResult.failed.toLocaleString()}</strong></span>
              </div>
              <div className="delivery-track" aria-label={`${broadcastResult.sent} of ${broadcastResult.totalRecipients} sent`}>
                <span style={{ width: `${broadcastResult.totalRecipients ? broadcastResult.sent / broadcastResult.totalRecipients * 100 : 0}%` }} />
              </div>
            </article>
          )}
        </section>

        <footer className="admin-footer"><Icon name="shield" />{t("adminUnavailableBody")}</footer>
      </main>

      {reingestOpen && (
        <AdminModal
          title={t("reingest")}
          description={t("reingestConfirm")}
          confirmLabel={reingestMutation.isPending ? (isFrench ? "Traitement…" : "Working…") : t("confirm")}
          danger
          onCancel={() => setReingestOpen(false)}
          onConfirm={() => reingestMutation.mutate()}
          disabled={reingestMutation.isPending}
        />
      )}
      {broadcastOpen && (
        <AdminModal
          title={t("sendBroadcast")}
          description={t("broadcastConfirm")}
          confirmLabel={broadcastMutation.isPending ? (isFrench ? "Envoi…" : "Sending…") : t("sendBroadcast")}
          danger
          disabled={sendConfirmation !== "SEND" || broadcastMutation.isPending}
          onCancel={() => {
            setBroadcastOpen(false);
            setSendConfirmation("");
          }}
          onConfirm={confirmBroadcast}
        >
          <label className="confirm-input-label" htmlFor="send-confirmation">{isFrench ? "Saisissez SEND pour confirmer" : "Type SEND to confirm"}</label>
          <input id="send-confirmation" autoComplete="off" value={sendConfirmation} onChange={(event) => setSendConfirmation(event.target.value)} />
        </AdminModal>
      )}
    </div>
  );
}
