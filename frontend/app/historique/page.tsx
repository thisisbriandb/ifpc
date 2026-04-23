"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Trash2, ChevronLeft, ChevronRight,
  ArrowRight, Calendar, Filter,
} from "lucide-react";
import { getHistory, deleteAnalysis, type HistoryEntry } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  conforme:    { bg: "bg-brand-primary/10", text: "text-brand-primary" },
  vigilance:   { bg: "bg-brand-accent/10",  text: "text-brand-accent"  },
  insuffisant: { bg: "bg-red-50",            text: "text-red-700"       },
  REUSSI:      { bg: "bg-brand-primary/10", text: "text-brand-primary" },
  ACCEPTABLE:  { bg: "bg-brand-accent/10",  text: "text-brand-accent"  },
  ECART:       { bg: "bg-red-50",            text: "text-red-700"       },
};

const TYPE_DOT: Record<string, string> = {
  controle:   "bg-brand-primary",
  bareme:     "bg-brand-accent",
  assemblage: "bg-purple-500",
};

const TYPE_ROUTE: Record<string, string> = {
  controle:   "/controle",
  bareme:     "/bareme",
  assemblage: "/colorimetrie/assemblage",
};

type DateFilter = "all" | "today" | "week" | "month";

// ── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function matchesDateFilter(dateStr: string, filter: DateFilter): boolean {
  if (filter === "all") return true;
  const d = new Date(dateStr);
  const now = new Date();
  if (filter === "today") return startOfDay(d).getTime() === startOfDay(now).getTime();
  if (filter === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  }
  if (filter === "month") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  return true;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HistoriquePage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { user } = useAuthStore();

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  // Pagination
  const [page, setPage] = useState(1);

  // Delete
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ── Load ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        if (user) {
          const data = await getHistory();
          if (!cancelled) setEntries(data);
        } else {
          // Fallback localStorage
          try {
            const stored = localStorage.getItem("ifpc_recent_activities");
            if (!cancelled && stored) {
              const parsed = JSON.parse(stored);
              setEntries(parsed.map((a: any, i: number) => ({ ...a, id: a.id ?? i })));
            }
          } catch {}
        }
      } catch {
        // Fallback localStorage
        try {
          const stored = localStorage.getItem("ifpc_recent_activities");
          if (!cancelled && stored) {
            const parsed = JSON.parse(stored);
            setEntries(parsed.map((a: any, i: number) => ({ ...a, id: a.id ?? i })));
          }
        } catch {}
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  // ── Filter + search ──
  const filtered = useMemo(() => {
    let list = [...entries];

    // Sort newest first
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Type filter
    if (typeFilter !== "all") list = list.filter((e) => e.type === typeFilter);

    // Statut filter
    if (statutFilter !== "all") list = list.filter((e) => e.statut === statutFilter);

    // Date filter
    list = list.filter((e) => matchesDateFilter(e.date, dateFilter));

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.label?.toLowerCase().includes(q) ||
          e.lotIdentifier?.toLowerCase().includes(q) ||
          e.statut?.toLowerCase().includes(q) ||
          e.type?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [entries, typeFilter, statutFilter, dateFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, typeFilter, statutFilter, dateFilter]);

  // ── Delete handler ──
  const handleDelete = async (id: number) => {
    if (!confirm(t("historique.confirmDelete"))) return;
    setDeletingId(id);
    try {
      await deleteAnalysis(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // Also remove from localStorage fallback
      try {
        const stored = localStorage.getItem("ifpc_recent_activities");
        if (stored) {
          const list = JSON.parse(stored).filter((a: any) => String(a.id) !== String(id));
          localStorage.setItem("ifpc_recent_activities", JSON.stringify(list));
          setEntries((prev) => prev.filter((e) => e.id !== id));
        }
      } catch {}
    } finally {
      setDeletingId(null);
    }
  };

  // ── Navigate to analysis ──
  const openEntry = (e: HistoryEntry) => {
    const target = TYPE_ROUTE[e.type] || "/controle";
    router.push(`${target}?history=${e.id}`);
  };

  // ── Unique types in data ──
  const types = useMemo(() => Array.from(new Set(entries.map((e) => e.type))), [entries]);
  const statuts = useMemo(() => Array.from(new Set(entries.map((e) => e.statut).filter(Boolean))), [entries]);

  const dateOptions: { key: DateFilter; label: string }[] = [
    { key: "all",   label: t("historique.allDates") },
    { key: "today", label: t("historique.today") },
    { key: "week",  label: t("historique.thisWeek") },
    { key: "month", label: t("historique.thisMonth") },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-text">{t("historique.title")}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t("historique.subtitle")}</p>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("historique.search")}
            className="w-full pl-8 pr-3 py-2 text-xs border border-black/[0.06] rounded-lg bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 text-xs border border-black/[0.06] rounded-lg bg-white focus:ring-1 focus:ring-brand-primary outline-none"
          >
            <option value="all">{t("historique.allTypes")}</option>
            {types.map((typ) => (
              <option key={typ} value={typ}>{t(`historique.${typ}`)}</option>
            ))}
          </select>

          {/* Statut filter */}
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 text-xs border border-black/[0.06] rounded-lg bg-white focus:ring-1 focus:ring-brand-primary outline-none"
          >
            <option value="all">{t("historique.allStatuts")}</option>
            {statuts.map((s) => (
              <option key={s} value={s!}>{t(`home.statut.${s}`)}</option>
            ))}
          </select>
        </div>

        {/* Date filter */}
        <div className="flex items-center gap-1 bg-gray-100/80 rounded-lg p-0.5 overflow-x-auto no-scrollbar">
          {dateOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setDateFilter(opt.key)}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap ${
                dateFilter === opt.key
                  ? "bg-white text-brand-text shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table / Cards */}
      {loading ? (
        <div className="text-center py-16 text-sm text-gray-400">…</div>
      ) : pageItems.length === 0 ? (
        <div className="text-center py-16">
          <Filter className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">{t("historique.noResults")}</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {pageItems.map((entry) => {
              const badge = entry.statut ? STATUS_BADGE[entry.statut] : undefined;
              return (
                <div
                  key={entry.id}
                  onClick={() => openEntry(entry)}
                  className="bg-white p-4 rounded-xl border border-black/[0.06] shadow-sm active:scale-[0.98] transition-all relative"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono text-gray-400">
                      {new Date(entry.date).toLocaleString(locale === "en" ? "en-GB" : "fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    <div className="flex items-center gap-2">
                      {badge && entry.statut && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                          {t(`home.statut.${entry.statut}`)}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                        disabled={deletingId === entry.id}
                        className="p-1.5 rounded-lg bg-red-50 text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-gray-900 mb-1 truncate pr-8">
                    {entry.lotIdentifier ? (
                      <>
                        <span className="font-mono text-gray-700">
                          <span className="text-[10px] text-gray-400 uppercase font-sans mr-1">Lot:</span>
                          {entry.lotIdentifier}
                        </span>
                        {entry.label && entry.label !== entry.lotIdentifier && (
                          <span className="text-gray-400 font-normal text-sm ml-2">
                            — {entry.label}
                          </span>
                        )}
                      </>
                    ) : (
                      entry.label
                    )}
                  </h3>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[entry.type] || "bg-gray-300"}`} />
                          {t(`historique.${entry.type}`)}
                        </span>
                        {entry.vp != null && (
                          <span className="text-[10px] font-mono text-gray-600 font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                            Fourni: {entry.vp.toFixed(2)} UP
                          </span>
                        )}
                      </div>
                      {entry.vpCible != null && (
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-50/50 px-2 py-0.5 rounded border border-gray-50 w-fit">
                          Cible: {entry.vpCible.toFixed(1)} UP
                        </span>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-brand-primary" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg border border-black/[0.06] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider">
                    <th className="text-left px-4 py-2.5 font-bold whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-2.5 font-bold whitespace-nowrap">Type</th>
                    <th className="text-left px-4 py-2.5 font-bold">Lot / Label</th>
                    <th className="text-left px-4 py-2.5 font-bold">VP</th>
                    <th className="text-left px-4 py-2.5 font-bold">Statut</th>
                    <th className="text-right px-4 py-2.5 font-bold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pageItems.map((entry) => {
                    const badge = entry.statut ? STATUS_BADGE[entry.statut] : undefined;
                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                        onClick={() => openEntry(entry)}
                      >
                        <td className="px-4 py-3 font-mono text-gray-500 whitespace-nowrap">
                          {new Date(entry.date).toLocaleString(
                            locale === "en" ? "en-GB" : "fr-FR",
                            { dateStyle: "short", timeStyle: "short" }
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT[entry.type] || "bg-gray-300"}`} />
                            {t(`historique.${entry.type}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 max-w-[300px] truncate">
                          {entry.lotIdentifier ? (
                            <div className="flex items-center">
                              <span className="font-mono text-gray-700 shrink-0">
                                <span className="text-[9px] text-gray-400 uppercase font-sans mr-1">Lot:</span>
                                {entry.lotIdentifier}
                              </span>
                              {entry.label && entry.label !== entry.lotIdentifier && (
                                <span className="text-gray-400 font-normal text-[11px] ml-2 truncate">
                                  — {entry.label}
                                </span>
                              )}
                            </div>
                          ) : (
                            entry.label
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-600">
                          {entry.vp != null ? (
                            <div className="flex flex-col leading-tight">
                              <span className="whitespace-nowrap">
                                <span className="text-gray-400 text-[9px] uppercase font-sans mr-1">Fourni:</span>
                                {entry.vp.toFixed(2)}
                              </span>
                              {entry.vpCible != null && (
                                <span className="whitespace-nowrap text-gray-400">
                                  <span className="text-gray-400 text-[9px] uppercase font-sans mr-1">Cible:</span>
                                  {entry.vpCible.toFixed(1)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {badge && entry.statut ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                              {t(`home.statut.${entry.statut}`)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                              disabled={deletingId === entry.id}
                              className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                              title={t("historique.delete")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-brand-primary transition-colors" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-brand-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {t("historique.previous")}
          </button>
          <span className="text-[11px] text-gray-400 font-mono">
            {t("historique.page", { current: currentPage, total: totalPages })}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-brand-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {t("historique.next")}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
