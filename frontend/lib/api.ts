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

export async function assemblageCouleurDb(
  data: {
    spectra: { name: string; wavelengths: number[]; do_values: number[] }[];
    target_L: number;
    target_a: number;
    target_b: number;
    volume_total?: number;
  }
): Promise<AssemblageResult> {
  const response = await api.post("/colorimetrie/assemblage-db", data);
  return response.data;
}

export async function spectrumToLab(wavelengths: number[], doValues: number[]): Promise<{ L: number; a: number; b: number; hex: string }> {
  const { data } = await api.post("/colorimetrie/spectrum-to-lab", { wavelengths, do_values: doValues });
  return data;
}

// ── Module 4 : Chai virtuel — Cuves / Lots / Stockages ─────────────────────

export interface Cuve {
  id?: number;
  nom: string;
  volumeMax: number;
  statutPhysique?: "PROPRE" | "SALE" | "EN_NETTOYAGE" | "EN_MAINTENANCE" | string;
  volumeOccupe?: number;
  volumeDisponible?: number;
  stockages?: Stockage[];
  // Transitional legacy fields kept while the cuves UI is migrated to Lot/Stockage.
  volumeActuel?: number;
  typeProduit?: string;
  statut?: string;
  lotIdentifier?: string;
  colorL?: number;
  colorA?: number;
  colorB?: number;
  colorHex?: string;
  spectrumJson?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Lot {
  id?: number;
  identifiant: string;
  typeProduit: string;
  volumeActuel: number;
  colorL?: number;
  colorA?: number;
  colorB?: number;
  colorHex?: string;
  spectrumJson?: string;
  statutLot?: "EN_FERMENTATION" | "PRET_A_ASSEMBLER" | "EMBOUTEILLE" | string;
  cuveActuelle?: {
    cuveId: number;
    cuveNom: string;
    volumeOccupe: number;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Stockage {
  id?: number;
  cuveId: number;
  cuveNom?: string;
  lotId: number;
  lotIdentifiant?: string;
  lotTypeProduit?: string;
  lotColorHex?: string;
  volumeOccupe: number;
  dateDebut?: string;
  dateFin?: string | null;
  actif?: boolean;
}

export interface Operation {
  id: number;
  type: string;
  cuveSourceId?: number | null;
  cuveSourceNom?: string | null;
  cuveDestId?: number | null;
  cuveDestNom?: string | null;
  lotId?: number | null;
  lotIdentifiant?: string | null;
  lotResultatId?: number | null;
  lotResultatIdentifiant?: string | null;
  volume?: number | null;
  description?: string | null;
  userEmail?: string | null;
  createdAt: string;
}

export async function getCuves(): Promise<Cuve[]> {
  const { data } = await api.get("/cuves");
  return data;
}

export async function getCuve(id: number): Promise<Cuve> {
  const { data } = await api.get(`/cuves/${id}`);
  return data;
}

export async function createCuve(cuve: Cuve): Promise<Cuve> {
  const { data } = await api.post("/cuves", cuve);
  return data;
}

export async function updateCuve(id: number, cuve: Cuve): Promise<Cuve> {
  const { data } = await api.put(`/cuves/${id}`, cuve);
  return data;
}

export async function deleteCuve(id: number): Promise<void> {
  await api.delete(`/cuves/${id}`);
}

export async function restoreCuve(id: number): Promise<Cuve> {
  const { data } = await api.post(`/cuves/${id}/restore`);
  return data;
}

export async function getLots(): Promise<Lot[]> {
  const { data } = await api.get("/lots");
  return data;
}

export async function getLot(id: number): Promise<Lot> {
  const { data } = await api.get(`/lots/${id}`);
  return data;
}

export async function createLot(lot: Lot): Promise<Lot> {
  const { data } = await api.post("/lots", lot);
  return data;
}

export async function updateLot(id: number, lot: Partial<Lot>): Promise<Lot> {
  const { data } = await api.put(`/lots/${id}`, lot);
  return data;
}

export async function deleteLot(id: number): Promise<void> {
  await api.delete(`/lots/${id}`);
}

export async function getStockages(): Promise<Stockage[]> {
  const { data } = await api.get("/stockages");
  return data;
}

export async function createStockage(stockage: { cuveId: number; lotId: number; volumeOccupe: number }): Promise<Stockage> {
  const { data } = await api.post("/stockages", stockage);
  return data;
}

export async function terminerStockage(id: number): Promise<Stockage> {
  const { data } = await api.post(`/stockages/${id}/terminer`);
  return data;
}

export async function getOperations(): Promise<Operation[]> {
  const { data } = await api.get("/operations");
  return data;
}

export async function getOperationsByCuve(cuveId: number): Promise<Operation[]> {
  const { data } = await api.get(`/operations/cuve/${cuveId}`);
  return data;
}

export async function getOperationsByLot(lotId: number): Promise<Operation[]> {
  const { data } = await api.get(`/operations/lot/${lotId}`);
  return data;
}

// ── Operations métier ────────────────────────────────────────────────────────

export async function opNettoyage(cuveId: number): Promise<Operation> {
  const { data } = await api.post("/operations/nettoyage", { cuveId });
  return data;
}

export async function opRemplissage(cuveId: number, lotId: number, volume?: number): Promise<Operation> {
  const { data } = await api.post("/operations/remplissage", { cuveId, lotId, volume });
  return data;
}

export async function opTransfert(cuveSourceId: number, cuveDestId: number, lotId: number, volume?: number): Promise<Operation> {
  const { data } = await api.post("/operations/transfert", { cuveSourceId, cuveDestId, lotId, volume });
  return data;
}

export async function opTransformation(params: {
  lotId: number;
  colorL?: number; colorA?: number; colorB?: number;
  colorHex?: string; spectrumJson?: string; description?: string;
}): Promise<Operation> {
  const { data } = await api.post("/operations/transformation", params);
  return data;
}

export interface AssemblageSource {
  cuveId: number;
  lotId: number;
  volume: number;
}

export async function opAssemblage(params: {
  sources: AssemblageSource[];
  cuveDestId: number;
  newLotIdentifiant: string;
  typeProduit: string;
  colorL?: number; colorA?: number; colorB?: number;
  colorHex?: string; spectrumJson?: string;
}): Promise<Operation> {
  const { data } = await api.post("/operations/assemblage", params);
  return data;
}
