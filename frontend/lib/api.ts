import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

// ── Référentiels ────────────────────────────────────────────────────────────

export async function getProduits() {
  const { data } = await api.get("/referentiels/produits");
  return data;
}

export async function getMicroorganismes() {
  const { data } = await api.get("/referentiels/microorganismes");
  return data;
}

export async function getProcedes() {
  const { data } = await api.get("/referentiels/procedes");
  return data;
}

export async function getClarifications() {
  const { data } = await api.get("/referentiels/clarifications");
  return data;
}

// ── Module 1 : Contrôle ─────────────────────────────────────────────────────

export interface EvaluateParams {
  temperatures: number[];
  temps: number[];
  product_type: string;
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

// ── Module 2 : Barème ───────────────────────────────────────────────────────

export async function proposerBareme(params: {
  product_type: string;
  microorganisme?: string | null;
  clarification: string;
  procede: string;
}) {
  const { data } = await api.post("/bareme/proposer", params);
  return data;
}
