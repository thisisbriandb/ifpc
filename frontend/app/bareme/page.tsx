"use client";

import { useState, useMemo } from "react";
import { ThermometerSun, AlertTriangle, CheckCircle2, Info, Timer, Flame } from "lucide-react";

// ── Données de référence (miroir du backend, 100 % frontend) ─────────────

const MICROORGANISMES: Record<string, { nom: string; t_ref: number; z: number; vp_cible: number; desc: string }> = {
  alicyclobacillus_acidoterrestris: { nom: "Alicyclobacillus acidoterrestris", t_ref: 60, z: 7, vp_cible: 15, desc: "Bactérie thermorésistante des jus acides" },
  levures:                          { nom: "Levures d'altération",           t_ref: 60, z: 7, vp_cible: 5,  desc: "Levures de refermentation" },
  moisissures:                      { nom: "Moisissures",                    t_ref: 60, z: 7, vp_cible: 10, desc: "Moisissures thermorésistantes" },
  byssochlamys_fulva:               { nom: "Byssochlamys fulva",             t_ref: 60, z: 7, vp_cible: 20, desc: "Moisissure thermorésistante des fruits" },
  lactobacilles:                    { nom: "Lactobacilles",                  t_ref: 60, z: 7, vp_cible: 5,  desc: "Bactéries lactiques d'altération" },
};

const PRODUITS: Record<string, { nom: string; micro: string; vp_cible: number; ph: number; desc: string }> = {
  jus_pomme:       { nom: "Jus de pomme",      micro: "alicyclobacillus_acidoterrestris", vp_cible: 15, ph: 3.5, desc: "Jus de pomme pasteurisé" },
  cidre_doux:      { nom: "Cidre doux",         micro: "levures",                          vp_cible: 10, ph: 3.6, desc: "Cidre doux (< 3% vol.)" },
  cidre_demi_sec:  { nom: "Cidre demi-sec",     micro: "levures",                          vp_cible: 8,  ph: 3.5, desc: "Cidre demi-sec (3-4% vol.)" },
  cidre_brut:      { nom: "Cidre brut",         micro: "levures",                          vp_cible: 5,  ph: 3.4, desc: "Cidre brut (4-5% vol.)" },
  cidre_extra_brut:{ nom: "Cidre extra-brut",   micro: "levures",                          vp_cible: 5,  ph: 3.3, desc: "Cidre extra-brut (> 5% vol.)" },
  autre:           { nom: "Autre",              micro: "alicyclobacillus_acidoterrestris", vp_cible: 15, ph: 3.5, desc: "Produit personnalisé" },
};

const PASTEURISATEURS = {
  flash:     { nom: "Flash Pasto",          desc: "Haute température, courte durée (échangeur)" },
  tunnel:    { nom: "Douchette / Tunnel",   desc: "Pasteurisation en bouteille / bain-marie" },
};

// ── Bigelow inversion: time = VP_cible / 10^((T - Tref) / Z) ────────────

function computeHoldTime(tConsigne: number, tRef: number, z: number, vpCible: number) {
  const L = Math.pow(10, (tConsigne - tRef) / z);
  return vpCible / L; // minutes
}

function computeBaremeTable(tRef: number, z: number, vpCible: number) {
  const temps = [60, 63, 65, 68, 70, 72, 75, 78, 80, 85, 90, 95];
  return temps.map((t) => {
    const L = Math.pow(10, (t - tRef) / z);
    const dMin = vpCible / L;
    return { temperature: t, duree_min: +dMin.toFixed(4), duree_sec: +(dMin * 60).toFixed(1), taux_letal: +L.toFixed(4) };
  });
}

// ── Vigilance messages ───────────────────────────────────────────────────

interface Alerte { type: "danger" | "warning" | "info"; message: string }

function buildAlertes(
  productKey: string, pasteType: string, tConsigne: number, holdMin: number,
  ph?: number, alcool?: number, densite?: number,
): Alerte[] {
  const alertes: Alerte[] = [];

  // Cidre doux / jus + pH élevé
  if (["cidre_doux", "cidre_demi_sec", "jus_pomme"].includes(productKey)) {
    if (ph && ph > 3.8)
      alertes.push({ type: "danger", message: `Votre produit est un ${PRODUITS[productKey].nom} avec un pH élevé (${ph}). Risque FORT de reprise de fermentation si le barème n'est pas strictement respecté.` });
    else
      alertes.push({ type: "warning", message: `Les ${PRODUITS[productKey].nom.toLowerCase()}s contiennent du sucre résiduel. Respectez strictement le barème pour éviter toute refermentation.` });
  }

  // Flash pasto + hold time > 1 min
  if (pasteType === "flash" && holdMin > 1)
    alertes.push({ type: "warning", message: `Pour un Flash Pasteurisateur, un temps de maintien supérieur à 1 minute (ici ${(holdMin * 60).toFixed(0)}s) indique une température de consigne probablement trop basse. Augmentez la température.` });

  // Tunnel + T consigne très haute
  if (pasteType === "tunnel" && tConsigne > 80)
    alertes.push({ type: "info", message: `En tunnel/douchette, une température à cœur de ${tConsigne}°C est élevée. Vérifiez que le produit peut supporter cette température sans altération organoleptique.` });

  // Alcool élevé = protection partielle
  if (alcool && alcool > 4)
    alertes.push({ type: "info", message: `Le titre alcoométrique (${alcool}% vol.) offre une protection partielle contre les micro-organismes. La VP cible pourrait être abaissée en mode expert.` });

  // Densité élevée
  if (densite && densite > 1060)
    alertes.push({ type: "info", message: `La masse volumique élevée (${densite}) indique une teneur en sucre importante. La pénétration thermique peut être légèrement ralentie en tunnel.` });

  return alertes;
}

// ── Composant principal ──────────────────────────────────────────────────

export default function BaremePage() {
  // Produit
  const [productType, setProductType] = useState("jus_pomme");
  const [clarte, setClarte] = useState<"trouble" | "limpide">("trouble");

  // Physico-chimie
  const [ph, setPh] = useState("");
  const [densite, setDensite] = useState("");
  const [alcool, setAlcool] = useState("");

  // Équipement
  const [pasteType, setPasteType] = useState<"flash" | "tunnel">("flash");
  const [tConsigne, setTConsigne] = useState("75");

  // Expert
  const [expertMode, setExpertMode] = useState(false);
  const [microKey, setMicroKey] = useState("");
  const [customTref, setCustomTref] = useState("");
  const [customZ, setCustomZ] = useState("");

  // ── Calcul réactif ──────────────────────────────────────────────────
  const computed = useMemo(() => {
    const produit = PRODUITS[productType];
    if (!produit) return null;

    const effectiveMicro = microKey || produit.micro;
    const micro = MICROORGANISMES[effectiveMicro];
    if (!micro) return null;

    const tRef = customTref ? parseFloat(customTref) : micro.t_ref;
    const z    = customZ    ? parseFloat(customZ)    : micro.z;
    if (isNaN(tRef) || isNaN(z) || z === 0) return null;

    let vpCible = micro.vp_cible;
    if (clarte === "trouble") vpCible *= 1.2; // marge sécurité

    const tC = parseFloat(tConsigne);
    if (isNaN(tC) || tC <= 0) return null;

    const holdMin = computeHoldTime(tC, tRef, z, vpCible);
    const baremes = computeBaremeTable(tRef, z, vpCible);

    const alertes = buildAlertes(
      productType, pasteType, tC, holdMin,
      ph ? parseFloat(ph) : undefined,
      alcool ? parseFloat(alcool) : undefined,
      densite ? parseFloat(densite) : undefined,
    );

    return {
      produit, micro, tRef, z, vpCible: +vpCible.toFixed(2),
      tConsigne: tC, holdMin, holdSec: holdMin * 60,
      baremes, alertes, effectiveMicro,
    };
  }, [productType, clarte, ph, densite, alcool, pasteType, tConsigne, expertMode, microKey, customTref, customZ]);

  // ── Label helper ────────────────────────────────────────────────────
  const Label = ({ children, sub }: { children: React.ReactNode; sub?: string }) => (
    <label className="block mb-3">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{children}</span>
      {sub && <span className="block text-[10px] text-gray-400 mt-0.5">{sub}</span>}
    </label>
  );

  // ── RENDER ──────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 font-clash">Aide au choix du barème</h1>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <input
            type="checkbox" checked={expertMode} onChange={(e) => setExpertMode(e.target.checked)}
            className="w-3.5 h-3.5 text-brand-accent rounded focus:ring-brand-accent"
          />
          <span className="text-brand-accent font-semibold">Mode expert</span>
        </label>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ─── Left panel: inputs ─────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-4 space-y-5">

          {/* A. Produit */}
          <div>
            <Label>Type de produit</Label>
            <select value={productType} onChange={(e) => setProductType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none">
              {Object.entries(PRODUITS).map(([k, v]) => (
                <option key={k} value={k}>{v.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <Label>Clarté</Label>
            <div className="flex gap-2">
              {(["trouble", "limpide"] as const).map((c) => (
                <button key={c} onClick={() => setClarte(c)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    clarte === c ? "bg-brand-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>{c.charAt(0).toUpperCase() + c.slice(1)}</button>
              ))}
            </div>
          </div>

          {/* B. Physico-chimie */}
          <div>
            <Label sub="Influencent la résistance des micro-organismes">Caractéristiques</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-gray-400">pH</span>
                <input type="number" step="0.1" placeholder="3.5" value={ph} onChange={(e) => setPh(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400">Densité</span>
                <input type="number" step="1" placeholder="1050" value={densite} onChange={(e) => setDensite(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400">Alcool %</span>
                <input type="number" step="0.1" placeholder="4.5" value={alcool} onChange={(e) => setAlcool(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
              </div>
            </div>
          </div>

          {/* C. Équipement */}
          <div>
            <Label>Pasteurisateur</Label>
            <div className="flex gap-2 mb-3">
              {(Object.entries(PASTEURISATEURS) as [string, { nom: string; desc: string }][]).map(([k, v]) => (
                <button key={k} onClick={() => setPasteType(k as "flash" | "tunnel")}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    pasteType === k ? "bg-brand-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>{v.nom}</button>
              ))}
            </div>
            <Label sub="Température à laquelle vous réglez votre machine">T° consigne (°C)</Label>
            <input type="number" step="1" min="50" max="100" value={tConsigne} onChange={(e) => setTConsigne(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-brand-primary focus:ring-2 focus:ring-brand-primary outline-none" />
          </div>

          {/* D. Expert */}
          {expertMode && (
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <Label>Micro-organisme cible</Label>
              <select value={microKey} onChange={(e) => setMicroKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none">
                <option value="">— Par défaut (selon produit) —</option>
                {Object.entries(MICROORGANISMES).map(([k, v]) => (
                  <option key={k} value={k}>{v.nom}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-gray-400">Tref (°C)</span>
                  <input type="number" step="0.1" placeholder="60" value={customTref} onChange={(e) => setCustomTref(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-brand-accent outline-none" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400">Z (°C)</span>
                  <input type="number" step="0.1" placeholder="7" value={customZ} onChange={(e) => setCustomZ(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-brand-accent outline-none" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Right panel: results ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-5">
          {computed ? (
            <div className="space-y-4 max-w-4xl">

              {/* A. Recommandation principale */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-brand-primary/10 rounded-xl flex-shrink-0">
                    <Timer className="w-7 h-7 text-brand-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-clash font-bold text-lg text-gray-900 mb-1">Recommandation de réglage</h2>
                    <p className="text-gray-500 text-sm mb-4">{computed.produit.nom} — {PASTEURISATEURS[pasteType].nom}</p>
                    <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-lg p-4">
                      <p className="text-brand-primary font-bold text-lg">
                        {pasteType === "flash" ? (
                          <>Maintenir le produit à <span className="text-2xl">{computed.tConsigne}°C</span> pendant <span className="text-2xl">{computed.holdSec < 60 ? `${computed.holdSec.toFixed(1)} secondes` : `${computed.holdMin.toFixed(2)} minutes`}</span></>
                        ) : (
                          <>Maintenir à cœur à <span className="text-2xl">{computed.tConsigne}°C</span> pendant <span className="text-2xl">{computed.holdMin >= 1 ? `${computed.holdMin.toFixed(1)} minutes` : `${computed.holdSec.toFixed(1)} secondes`}</span></>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* B. Paramètres de référence */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "VP Objectif", value: `${computed.vpCible} UP`, color: "text-brand-primary" },
                  { label: "Tref", value: `${computed.tRef} °C`, color: "text-gray-900" },
                  { label: "Z", value: `${computed.z} °C`, color: "text-gray-900" },
                  { label: "Micro-organisme", value: computed.micro.nom, color: "text-gray-700", small: true },
                ].map((item) => (
                  <div key={item.label} className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{item.label}</p>
                    <p className={`font-bold ${item.color} ${item.small ? "text-xs" : "text-lg"}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* C. Alertes et vigilance */}
              {computed.alertes.length > 0 && (
                <div className="space-y-2">
                  {computed.alertes.map((a, i) => {
                    const cfg = a.type === "danger"
                      ? { bg: "bg-red-50 border-red-200", icon: AlertTriangle, iconColor: "text-red-500", text: "text-red-800" }
                      : a.type === "warning"
                      ? { bg: "bg-amber-50 border-amber-200", icon: AlertTriangle, iconColor: "text-amber-500", text: "text-amber-800" }
                      : { bg: "bg-blue-50 border-blue-200", icon: Info, iconColor: "text-blue-500", text: "text-blue-800" };
                    const Icon = cfg.icon;
                    return (
                      <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 ${cfg.bg}`}>
                        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.iconColor}`} />
                        <p className={`text-sm ${cfg.text}`}>{a.message}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* D. Table des barèmes */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-clash font-semibold text-gray-900">Table des barèmes</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Durée pour atteindre VP = {computed.vpCible} UP à chaque température</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Flame className="w-3.5 h-3.5" />
                    Taux létal = 10<sup>(T−Tref)/Z</sup>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-5 py-2 text-xs font-semibold text-gray-400 uppercase">T °C</th>
                      <th className="px-5 py-2 text-xs font-semibold text-gray-400 uppercase">Durée (min)</th>
                      <th className="px-5 py-2 text-xs font-semibold text-gray-400 uppercase">Durée (sec)</th>
                      <th className="px-5 py-2 text-xs font-semibold text-gray-400 uppercase">Taux létal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {computed.baremes.map((b) => {
                      const isConsigne = b.temperature === computed.tConsigne;
                      const isTref = b.temperature === computed.tRef;
                      return (
                        <tr key={b.temperature}
                          className={`transition-colors ${isConsigne ? "bg-brand-primary/10 font-semibold" : isTref ? "bg-brand-highlight/20" : "hover:bg-gray-50"}`}>
                          <td className="px-5 py-2">
                            <span className="font-medium">{b.temperature} °C</span>
                            {isConsigne && <span className="ml-2 text-[10px] bg-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded-full">consigne</span>}
                            {isTref && <span className="ml-2 text-[10px] bg-brand-accent/20 text-brand-accent px-1.5 py-0.5 rounded-full">Tref</span>}
                          </td>
                          <td className="px-5 py-2">{b.duree_min < 0.01 ? "< 0.01" : b.duree_min}</td>
                          <td className="px-5 py-2">{b.duree_sec < 0.1 ? "< 0.1" : b.duree_sec}</td>
                          <td className="px-5 py-2 font-mono text-gray-400">{b.taux_letal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-300">
              <div className="text-center">
                <ThermometerSun className="w-16 h-16 mx-auto mb-4 opacity-40" />
                <p className="text-sm">Renseignez les paramètres pour obtenir une recommandation</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
