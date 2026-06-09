"use client";

import { useState, useEffect } from "react";
import { HelpCircle, X, Pencil, Save, Eye, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getHelpText, updateHelpText } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

interface HelpModalProps {
  helpKey: string;
  defaultContent: string;
  title?: string;
  open: boolean;
  onClose: () => void;
}

export default function HelpModal({ helpKey, defaultContent, title, open, onClose }: HelpModalProps) {
  const { t, locale } = useI18n();
  const { user } = useAuthStore();

  const [helpContent, setHelpContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!open) {
      setHelpContent(null);
      return;
    }
    setLoading(true);
    getHelpText(helpKey, locale)
      .then((res) => {
        if (res.content) setHelpContent(res.content);
        else setHelpContent(defaultContent);
      })
      .catch(() => setHelpContent(defaultContent))
      .finally(() => setLoading(false));
  }, [open, helpKey, locale, defaultContent]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateHelpText(helpKey, draft, locale);
      setHelpContent(draft);
      setEditing(false);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setEditing(false);
    setPreview(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-brand-primary" />
            {title || t("controle.helpTitle")}
          </h3>
          <div className="flex items-center gap-1">
            {user?.role === "ADMIN" && !editing && !loading && (
              <button
                onClick={() => { setEditing(true); setDraft(helpContent || defaultContent); }}
                title={t("controle.helpEdit")}
                className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button onClick={handleClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {editing ? (
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit">
              <button
                onClick={() => setPreview(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  !preview ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Pencil className="w-3 h-3" />
                {t("controle.helpEditTab")}
              </button>
              <button
                onClick={() => setPreview(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  preview ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Eye className="w-3 h-3" />
                {t("controle.helpPreviewTab")}
              </button>
            </div>

            {preview ? (
              <div className="min-h-[200px] border border-gray-200 rounded-xl p-4 prose prose-sm prose-gray max-w-none overflow-y-auto max-h-72">
                <ReactMarkdown>{draft}</ReactMarkdown>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400">{t("controle.helpMarkdownHint")}</p>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={13}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-y"
                />
              </>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-xl hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t("controle.helpSaved")}
              </button>
              <button
                onClick={() => { setEditing(false); setPreview(false); }}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="p-6 flex items-center justify-center min-h-[150px]">
            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
          </div>
        ) : (
          <div className="p-6 prose prose-sm prose-gray max-w-none overflow-y-auto max-h-[60vh]">
            <ReactMarkdown>{helpContent || defaultContent}</ReactMarkdown>
          </div>
        )}

        {!editing && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={handleClose}
              className="w-full py-2.5 bg-brand-primary text-white text-sm font-bold rounded-xl hover:bg-brand-primary/90 transition-colors"
            >
              {t("common.understood")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
