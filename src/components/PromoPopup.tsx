import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";
import { useBannerAction } from "@/hooks/useBannerAction";
import { getSessionId } from "@/utils/sessionId";

const POPUP_SEEN_KEY = "lov_popup_seen_session";

const PromoPopup = () => {
  const { settings, loading } = useLayoutSettings();
  const runBannerAction = useBannerAction();
  const [open, setOpen] = useState(false);

  const s = settings as any;
  const ativo = s?.popup_ativo === "true";
  const imagem = (s?.popup_imagem_url || "").trim();

  useEffect(() => {
    if (loading || !ativo) return;
    let sessionId = "";
    try {
      sessionId = getSessionId();
      if (localStorage.getItem(POPUP_SEEN_KEY) === sessionId) return;
    } catch {
      /* noop */
    }
    const t = setTimeout(() => {
      setOpen(true);
      try {
        if (sessionId) localStorage.setItem(POPUP_SEEN_KEY, sessionId);
      } catch {
        /* noop */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [loading, ativo]);

  if (!ativo || !open) return null;


  const textoFechar = s?.popup_texto_fechar?.trim() || "Não Quero";
  const textoAplicar = s?.popup_texto_aplicar?.trim() || "QUERO";

  const handleApply = async () => {
    await runBannerAction(s?.popup_action_type, s?.popup_action_value, s?.popup_action_target);
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-[80vw] max-w-md aspect-square md:w-full rounded-2xl bg-card shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fechar"
          className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex-1 min-h-0 bg-muted">
          {imagem && (
            <img src={imagem} alt="Promoção" className="w-full h-full object-cover" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 p-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg py-2.5 text-sm font-semibold text-white bg-destructive hover:opacity-90 transition-opacity"
          >
            {textoFechar}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-lg py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors"
          >
            {textoAplicar}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromoPopup;
