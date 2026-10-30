"use client";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Language = "en" | "fr";
export type Theme = "light" | "dark";

type Preferences = {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: Theme;
  toggleTheme: () => void;
};

const PreferencesContext = createContext<Preferences | null>(null);

function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const savedLanguage = window.localStorage.getItem("law-language");
  return savedLanguage === "fr" || savedLanguage === "en"
    ? savedLanguage
    : navigator.language.toLowerCase().startsWith("fr")
      ? "fr"
      : "en";
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const savedTheme = window.localStorage.getItem("law-theme");
  return savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
}

function subscribePreferences(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("law-preferences-change", onChange);
  const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
  colorScheme.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("law-preferences-change", onChange);
    colorScheme.removeEventListener("change", onChange);
  };
}

function publishPreferenceChange() {
  window.dispatchEvent(new Event("law-preferences-change"));
}

function subscribeDemoState(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === "law-demo-state") onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("law-demo-state-change", onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("law-demo-state-change", onChange);
  };
}

function getDemoStateSnapshot() {
  return window.localStorage.getItem("law-demo-state") ?? "success";
}

export function useDemoState() {
  return useSyncExternalStore(subscribeDemoState, getDemoStateSnapshot, () => "success");
}

export function updateDemoState(value: string) {
  window.localStorage.setItem("law-demo-state", value);
  window.dispatchEvent(new Event("law-demo-state-change"));
}

const en = {
  ask: "Ask a question",
  search: "Search laws",
  askNav: "Ask",
  searchNav: "Search",
  admin: "Admin",
  language: "Language",
  lightTheme: "Switch to light theme",
  darkTheme: "Switch to dark theme",
  welcomeEyebrow: "A clearer path through the law",
  welcomeTitle: "What would you like to understand about Cameroonian law?",
  welcomeBody: "Ask in your own words. Get a clear explanation grounded in the laws of Cameroon.",
  exampleTitle: "Try a question",
  exampleWork: "What does the law say about overtime?",
  exampleLand: "How do I register a land sale?",
  exampleBusiness: "What do I need to start a business?",
  exampleRent: "What are a tenant’s rights?",
  exampleFamily: "How is child support determined?",
  exampleContract: "When is an employment contract required?",
  askPlaceholder: "Ask about a law, a right, or a situation…",
  characterLimit: "characters",
  disclaimer: "General legal information, not a substitute for advice from a qualified lawyer.",
  disclaimerLong: "This assistant shares general legal information to help you understand your options. It is not legal advice and does not replace a qualified lawyer.",
  close: "Close",
  newConversation: "New conversation",
  clearData: "Clear saved conversation",
  send: "Send question",
  pending: "Finding relevant parts of the law",
  sources: "Sources",
  related: "Related articles",
  noSources: "This answer is not tied to a specific article. Please verify important details.",
  confidence: "Confidence",
  low: "Low",
  medium: "Medium",
  high: "High",
  copy: "Copy answer",
  copied: "Copied",
  copyFailed: "Copying failed. Select and copy the answer text instead.",
  retry: "Try again",
  searchTitle: "Find a law or article",
  searchBody: "Search across laws and legal materials in plain language.",
  searchPlaceholder: "Try “notice period” or “land registration”…",
  suggestions: "Popular topics",
  topicWork: "Work & employment",
  topicLand: "Land & property",
  topicBusiness: "Starting a business",
  topicFamily: "Family matters",
  topicRent: "Renting a home",
  searchButton: "Search",
  noResults: "No matching articles found. Try different words or ask the assistant.",
  searchInitial: "Search for a topic to see relevant parts of the law.",
  readMore: "Read more",
  readLess: "Read less",
  source: "Source",
  askAboutArticle: "Ask the assistant about this",
  clearSearches: "Clear recent searches",
  recentSearches: "Recent searches",
  adminTitle: "Admin workspace",
  adminIntro: "A private place to monitor usage and maintain the legal index.",
  adminUnavailable: "Admin features need deployment configuration",
  adminUnavailableBody: "These tools are disabled until the deployment has an approved admin access gateway and server-side API credentials. No admin key is sent to this browser.",
  adminGateNeeded: "Admin access is available only through the approved access gateway.",
  backToAsk: "Back to legal assistant",
  totalUsers: "Total users",
  today: "Today",
  thisWeek: "This week",
  thisMonth: "This month",
  usage: "Usage",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  chartTable: "View as table",
  chartGraph: "View chart",
  indexedChunks: "Indexed sections",
  indexSources: "Sections by source",
  emptyIndex: "The index is empty",
  emptyIndexBody: "No law sections are indexed yet. Add the source PDFs, then re-ingest the index.",
  maintenance: "Maintenance",
  reingest: "Re-ingest all PDFs",
  reingestConfirm: "This may take a while and affects the live legal index. Continue only if you’re ready.",
  cancel: "Cancel",
  confirm: "Confirm",
  ingested: "Ingested",
  skipped: "Skipped",
  failed: "Failed",
  alreadyRunning: "An ingestion is already running. Check back in a moment.",
  broadcastTitle: "WhatsApp broadcast",
  broadcastBody: "Send an update to everyone who has opted in to WhatsApp messages.",
  broadcastPlaceholder: "Write a clear, helpful message…",
  preview: "Message preview",
  sendBroadcast: "Send broadcast",
  broadcastConfirm: "This message will be sent to all WhatsApp users and cannot be undone. Type SEND to confirm.",
  recipients: "Total recipients",
  sent: "Sent",
  failedRecipients: "Failed",
  stateSuccess: "Success",
  stateEmpty: "Empty",
  stateLoading: "Loading",
  stateError: "Error",
  demoPreview: "Demo preview",
  searchEyebrow: "Cameroonian law, made clear",
  resultCount: "results",
  resultCountSingular: "result",
  privateWorkspace: "Private admin workspace",
  collectionLabel: "Legal collection",
  indexReady: "Index ready",
  sourceCount: "sources",
  chartDate: "Date",
  chartWeek: "Week starting",
  chartMonth: "Month",
  country: "Cameroon",
  adminStep1: "Configure a trusted admin access gateway that authenticates administrators and injects the server-only gateway token.",
  adminStep2: "Set the legal service URL, admin API key and gateway token on the server only.",
  adminStep3: "Ensure the gateway removes client-supplied gateway-token headers before injecting its own.",
  privacy: "Privacy",
  homeLabel: "Droit clair home",
  mainNavigation: "Main navigation",
  adminNavigation: "Admin navigation",
  toggleAdminMenu: "Toggle admin menu",
  period: "Period",
  dataPoints: "data points",
  checkConfiguration: "Checking admin configuration…",
  serviceError: "Something went wrong. Please try again.",
  networkError: "Couldn’t reach the service. Check your connection and try again.",
  serverError: "The service is having trouble. Please try again shortly.",
  validationError: "Please check your question and try again.",
  validationLong: "Please keep your question under 1000 characters.",
  rateLimitError: "The service is receiving a lot of questions. Wait a moment, then try again.",
  firstVisit: "A note before you begin",
  gotIt: "I understand",
} as const;

const fr: Record<keyof typeof en, string> = {
  ask: "Poser une question",
  search: "Rechercher dans les lois",
  askNav: "Question",
  searchNav: "Recherche",
  admin: "Admin",
  language: "Langue",
  lightTheme: "Passer au thème clair",
  darkTheme: "Passer au thème sombre",
  welcomeEyebrow: "Mieux comprendre le droit",
  welcomeTitle: "Que souhaitez-vous comprendre du droit camerounais ?",
  welcomeBody: "Posez votre question avec vos mots. Recevez une explication claire fondée sur les lois du Cameroun.",
  exampleTitle: "Essayez une question",
  exampleWork: "Que prévoit la loi sur les heures supplémentaires ?",
  exampleLand: "Comment enregistrer une vente de terrain ?",
  exampleBusiness: "De quoi ai-je besoin pour créer une entreprise ?",
  exampleRent: "Quels sont les droits d’un locataire ?",
  exampleFamily: "Comment la pension alimentaire est-elle fixée ?",
  exampleContract: "Quand un contrat de travail est-il nécessaire ?",
  askPlaceholder: "Question sur une loi, un droit ou une situation…",
  characterLimit: "caractères",
  disclaimer: "Informations juridiques générales, sans remplacer les conseils d’un avocat qualifié.",
  disclaimerLong: "Cet assistant partage des informations juridiques générales pour vous aider à comprendre vos options. Il ne remplace pas les conseils d’un avocat qualifié.",
  close: "Fermer",
  newConversation: "Nouvelle conversation",
  clearData: "Effacer la conversation enregistrée",
  send: "Envoyer la question",
  pending: "Recherche des textes pertinents",
  sources: "Sources",
  related: "Articles associés",
  noSources: "Cette réponse ne renvoie pas à un article précis. Vérifiez les informations importantes.",
  confidence: "Niveau de confiance",
  low: "Faible",
  medium: "Moyen",
  high: "Élevé",
  copy: "Copier la réponse",
  copied: "Copié",
  copyFailed: "La copie a échoué. Sélectionnez le texte de la réponse pour le copier.",
  retry: "Réessayer",
  searchTitle: "Trouver une loi ou un article",
  searchBody: "Recherchez dans les lois et documents juridiques avec des mots simples.",
  searchPlaceholder: "Ex. « préavis » ou « immatriculation foncière »…",
  suggestions: "Sujets fréquents",
  topicWork: "Travail et emploi",
  topicLand: "Terrain et propriété",
  topicBusiness: "Créer une entreprise",
  topicFamily: "Questions familiales",
  topicRent: "Louer un logement",
  searchButton: "Rechercher",
  noResults: "Aucun article correspondant. Essayez d’autres mots ou posez votre question à l’assistant.",
  searchInitial: "Recherchez un sujet pour trouver les textes pertinents.",
  readMore: "Lire la suite",
  readLess: "Réduire",
  source: "Source",
  askAboutArticle: "Poser une question sur cet article",
  clearSearches: "Effacer les recherches récentes",
  recentSearches: "Recherches récentes",
  adminTitle: "Espace d’administration",
  adminIntro: "Un espace privé pour suivre l’utilisation et gérer l’index juridique.",
  adminUnavailable: "Configuration requise pour l’administration",
  adminUnavailableBody: "Ces outils sont désactivés tant que le déploiement ne dispose pas d’une passerelle d’accès administrateur approuvée et d’identifiants API côté serveur. Aucune clé admin n’est envoyée à ce navigateur.",
  adminGateNeeded: "L’accès admin est uniquement disponible via la passerelle approuvée.",
  backToAsk: "Retour à l’assistant juridique",
  totalUsers: "Utilisateurs au total",
  today: "Aujourd’hui",
  thisWeek: "Cette semaine",
  thisMonth: "Ce mois-ci",
  usage: "Utilisation",
  daily: "Jour",
  weekly: "Semaine",
  monthly: "Mois",
  chartTable: "Afficher le tableau",
  chartGraph: "Afficher le graphique",
  indexedChunks: "Sections indexées",
  indexSources: "Sections par source",
  emptyIndex: "L’index est vide",
  emptyIndexBody: "Aucune section de loi n’est encore indexée. Ajoutez les PDF sources, puis relancez l’indexation.",
  maintenance: "Maintenance",
  reingest: "Réindexer tous les PDF",
  reingestConfirm: "Cela peut prendre du temps et modifier l’index juridique en ligne. Continuez uniquement si vous êtes prêt.",
  cancel: "Annuler",
  confirm: "Confirmer",
  ingested: "Indexés",
  skipped: "Ignorés",
  failed: "Échecs",
  alreadyRunning: "Une indexation est déjà en cours. Revenez dans un instant.",
  broadcastTitle: "Diffusion WhatsApp",
  broadcastBody: "Envoyez une information aux personnes inscrites aux messages WhatsApp.",
  broadcastPlaceholder: "Rédigez un message clair et utile…",
  preview: "Aperçu du message",
  sendBroadcast: "Envoyer la diffusion",
  broadcastConfirm: "Ce message sera envoyé à tous les utilisateurs WhatsApp et ne pourra pas être annulé. Saisissez SEND pour confirmer.",
  recipients: "Destinataires au total",
  sent: "Envoyés",
  failedRecipients: "Échecs",
  stateSuccess: "Réussite",
  stateEmpty: "Vide",
  stateLoading: "Chargement",
  stateError: "Erreur",
  demoPreview: "Aperçu de démonstration",
  searchEyebrow: "Le droit camerounais en clair",
  resultCount: "résultats",
  resultCountSingular: "résultat",
  privateWorkspace: "Espace d’administration privé",
  collectionLabel: "Collection juridique",
  indexReady: "Index disponible",
  sourceCount: "sources",
  chartDate: "Date",
  chartWeek: "Début de semaine",
  chartMonth: "Mois",
  country: "Cameroun",
  adminStep1: "Configurez une passerelle d’accès admin approuvée qui authentifie les administrateurs et injecte le jeton réservé au serveur.",
  adminStep2: "Configurez l’URL du service juridique, la clé API admin et le jeton de passerelle uniquement côté serveur.",
  adminStep3: "Vérifiez que la passerelle retire les jetons fournis par les clients avant d’injecter son propre jeton.",
  privacy: "Confidentialité",
  homeLabel: "Accueil Droit clair",
  mainNavigation: "Navigation principale",
  adminNavigation: "Navigation admin",
  toggleAdminMenu: "Ouvrir ou fermer le menu admin",
  period: "Période",
  dataPoints: "points de données",
  checkConfiguration: "Vérification de la configuration admin…",
  serviceError: "Un problème est survenu. Veuillez réessayer.",
  networkError: "Connexion au service impossible. Vérifiez votre connexion puis réessayez.",
  serverError: "Le service rencontre un problème. Veuillez réessayer bientôt.",
  validationError: "Vérifiez votre question et réessayez.",
  validationLong: "Votre question doit contenir au maximum 1000 caractères.",
  rateLimitError: "Le service reçoit beaucoup de questions. Attendez un instant, puis réessayez.",
  firstVisit: "Une précision avant de commencer",
  gotIt: "J’ai compris",
};

export type TranslationKey = keyof typeof en;

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside Providers");
  return {
    ...context,
    t: (key: TranslationKey) => (context.language === "fr" ? fr[key] : en[key]),
  };
}

export function Providers({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore<Language>(subscribePreferences, getStoredLanguage, () => "en");
  const theme = useSyncExternalStore<Theme>(subscribePreferences, getStoredTheme, () => "light");
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  }));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
  }, [language, theme]);

  const setLanguage = (next: Language) => {
    window.localStorage.setItem("law-language", next);
    publishPreferenceChange();
  };
  const toggleTheme = () => {
    const next = getStoredTheme() === "light" ? "dark" : "light";
    window.localStorage.setItem("law-theme", next);
    publishPreferenceChange();
  };

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesContext.Provider
        value={{
          language,
          setLanguage,
          theme,
          toggleTheme,
        }}
      >
        {children}
      </PreferencesContext.Provider>
    </QueryClientProvider>
  );
}
