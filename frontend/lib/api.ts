import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

function saveToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("token", token);
  // Ecrire aussi dans un cookie accessible par le middleware Next.js
  document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  document.cookie = "token=; path=/; max-age=0";
}

// ── Authentification ────────────────────────────────────────────────────────

export async function login(data: any) {
  const response = await api.post("/auth/login", data);
  if (response.data?.token) saveToken(response.data.token);
  return response.data;
}

export async function register(data: any) {
  const response = await api.post("/auth/register", data);
  if (response.data?.token) saveToken(response.data.token);
  return response.data;
}

export async function getMe() {
  const response = await api.get("/auth/me");
  return response.data;
}

export function logout() {
  clearToken();
}

// ── Profile ─────────────────────────────────────────────────────────────────

export async function updateProfile(data: { firstName?: string; lastName?: string }) {
  const response = await api.put("/auth/profile", data);
  return response.data;
}

export async function changePassword(data: { currentPassword: string; newPassword: string }) {
  const response = await api.put("/auth/password", data);
  return response.data;
}

// ── Admin ───────────────────────────────────────────────────────────────────

export async function getUsers() {
  const response = await api.get("/admin/users");
  return response.data;
}

export async function updateUserRole(userId: number, role: string) {
  const response = await api.put(`/admin/users/${userId}/role`, { role });
  return response.data;
}

export async function getPendingUsers() {
  const response = await api.get("/admin/pending");
  return response.data;
}

export async function approveUser(userId: number) {
  const response = await api.put(`/admin/users/${userId}/approve`);
  return response.data;
}

export async function rejectUser(userId: number) {
  const response = await api.delete(`/admin/users/${userId}/reject`);
  return response.data;
}

// ── Product Config (Admin) ──────────────────────────────────────────────────

export async function getProductConfig() {
  const response = await api.get("/config/products");
  return response.data;
}

export async function getAdminProductConfig() {
  const response = await api.get("/admin/product-config");
  return response.data;
}

export async function updateProductConfig(productType: string, vpCible: number, productName?: string) {
  const response = await api.put(`/admin/product-config/${productType}`, { vpCible, productName });
  return response.data;
}

// ── Help Text ────────────────────────────────────────────────────────────────

export async function getHelpText(key: string, locale = "fr"): Promise<{ key: string; content: string | null; locale: string }> {
  const { data } = await api.get(`/config/help/${key}`, { params: { locale } });
  return data;
}

export async function updateHelpText(key: string, content: string, locale = "fr"): Promise<{ key: string; content: string; locale: string }> {
  const { data } = await api.put(`/admin/help/${key}`, { content, locale });
  return data;
}

// ── Référentiels ────────────────────────────────────────────────────────────

export async function getProduits(locale = "fr") {
  const { data } = await api.get("/referentiels/produits", { params: { locale } });
  return data;
}

export async function getMicroorganismes(locale = "fr") {
  const { data } = await api.get("/referentiels/microorganismes");
  return data;
}

export async function getProcedes(locale = "fr") {
  const { data } = await api.get("/referentiels/procedes", { params: { locale } });
  return data;
}

export async function getClarifications(locale = "fr") {
  const { data } = await api.get("/referentiels/clarifications", { params: { locale } });
  return data;
}

// ── Module 1 : Contrôle ─────────────────────────────────────────────────────

export interface EvaluateParams {
  temperatures: number[];
  temps: number[];
  product_type: string;
  locale?: string;
  microorganisme?: string | null;
  t_ref?: number | null;
  z?: number | null;
  vp_cible?: number | null;
  clarification?: string | null;
  procede?: string | null;
  ph?: number | null;
  titre_alcool?: number | null;
}

export async function evaluerPasteurisation(params: EvaluateParams) {
  const { data } = await api.post("/pasteurisation/evaluer", params);
  return data;
}

export async function uploadFile(file: File, params: Record<string, any>) {
  const formData = new FormData();
  formData.append("file", file);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      formData.append(key, String(value));
    }
  });
  const { data } = await api.post("/pasteurisation/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function collerDonnees(params: {
  raw_text: string;
  product_type: string;
  locale?: string;
  microorganisme?: string | null;
  t_ref?: number | null;
  z?: number | null;
  vp_cible?: number | null;
  clarification?: string | null;
  procede?: string | null;
  ph?: number | null;
  titre_alcool?: number | null;
}) {
  const { data } = await api.post("/pasteurisation/coller", params);
  return data;
}

// ── Historique des analyses ──────────────────────────────────────────────────

export interface HistoryEntry {
  id: number;
  type: "controle" | "bareme";
  label: string;
  lotIdentifier?: string;
  statut?: string;
  vp?: number;
  vpCible?: number;
  parametres?: string;
  date: string;
  userEmail?: string;
}

export interface AnalysisDetail extends HistoryEntry {
  parametres?: string;
  courbe?: string;
  resultJson?: string;
}

export async function saveAnalysis(params: {
  type: string;
  label: string;
  lotIdentifier?: string;
  statut?: string;
  vp?: number;
  vpCible?: number;
  parametres?: string;
  courbe?: string;
  resultJson?: string;
}) {
  const { data } = await api.post("/history", params);
  return data;
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const { data } = await api.get("/history");
  return data;
}

export async function getAnalysisById(id: number): Promise<AnalysisDetail> {
  const { data } = await api.get(`/history/${id}`);
  return data;
}

export async function deleteAnalysis(id: number) {
  const { data } = await api.delete(`/history/${id}`);
  return data;
}

// ── Module 2 : Barème ───────────────────────────────────────────────────────

export async function proposerBareme(params: {
  product_type: string;
  locale?: string;
  microorganisme?: string | null;
  clarification: string;
  procede: string;
}) {
  const { data } = await api.post("/bareme/proposer", params);
  return data;
}

// ── Module 3 : Colorimétrie — Assemblage ────────────────────────────────────

export interface AssemblageResult {
  cible:   { L: number; a: number; b: number; hex: string };
  obtenu:  { L: number; a: number; b: number; hex: string };
  delta_e: number;
  delta_e_method?: string;
  volume_total: number;
  proportions: { nom: string; pct: number; litres: number }[];
  cuves: { nom: string; L: number; a: number; b: number; hex: string }[];
  spectre: {
    wavelengths: number[];
    do_mix: number[];
    do_cuves: number[][];
  };
}

export async function assemblageCouleur(
  file: File,
  target: { L: number; a: number; b: number },
  volume_total: number = 1000
): Promise<AssemblageResult> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/colorimetrie/assemblage", formData, {
    params: {
      target_L: target.L,
      target_a: target.a,
      target_b: target.b,
      volume_total,
    },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
