export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "App";

export const APP_LOGO = "📊";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

// Configurações do Firebase (mantendo as credenciais originais)
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAHq-utRHf-rDVJ9YtNdD8PCIRvboGqLuI",
  authDomain: "gestor-pro-51706.firebaseapp.com",
  projectId: "gestor-pro-51706",
  storageBucket: "gestor-pro-51706.appspot.com",
  messagingSenderId: "519113320151",
  appId: "1:519113320151:web:d22638842180572b9338fd"
};

// Tipos de roles do GestFin
export type GestfinRole = "admin" | "padrao" | "leitura";

// Funções utilitárias para valores monetários
export function formatCurrency(valueInCents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valueInCents / 100);
}

export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100);
}

// Formata data para input
export function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Formata data para exibição
export function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

// Formata timestamp do banco
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('pt-BR');
}
