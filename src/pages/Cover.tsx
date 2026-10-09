import React from "react";
import { useNavigate } from "react-router-dom";
import { Pizza, ClipboardList, User, Handshake, Megaphone, Share2 } from "lucide-react";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";
import { useToast } from "@/hooks/use-toast";
import { useBannerAction } from "@/hooks/useBannerAction";

const Cover: React.FC = () => {
  const navigate = useNavigate();
  const { settings, loading } = useLayoutSettings();
  const { toast } = useToast();
  const runBannerAction = useBannerAction();

  const banner2ActionType = (settings as any).cover_banner2_action_type || "none";
  const banner2ActionValue = ((settings as any).cover_banner2_action_value || "").trim();
  const banner2Clickable = banner2ActionType !== "none" && !!banner2ActionValue;

  const handleBanner2Click = () => {
    runBannerAction(
      banner2ActionType,
      banner2ActionValue,
      (settings as any).cover_banner2_action_target
    );
    if (banner2ActionType === "cupom") {
      navigate("/cardapio");
    }
  };

  const handleShare = async () => {
    const url = window.location.origin;
    const shareData = {
      title: settings.empresa_nome,
      text: `Confira o cardápio de ${settings.empresa_nome}!`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copiado!", description: "Envie o link do cardápio para seus amigos." });
      }
    } catch {
      // usuário cancelou o compartilhamento
    }
  };

  const buttons = [
    { label: "Cardápio", icon: Pizza, onClick: () => navigate("/cardapio") },
    { label: "Pedidos", icon: ClipboardList, onClick: () => navigate("/meus-pedidos") },
    { label: "Minha Conta", icon: User, onClick: () => navigate("/minha-conta") },
    { label: "Fidelidade", icon: Handshake, onClick: () => navigate("/plano-fidelidade") },
    { label: "Info", icon: Megaphone, onClick: () => navigate("/info") },
    { label: "Compartilhar", icon: Share2, onClick: handleShare },
  ];

  const useCoverImage =
    settings.cover_background_tipo === 'imagem' && !!settings.cover_background_imagem_url;

  const backgroundStyle: React.CSSProperties = useCoverImage
    ? {
        backgroundImage: `url(${settings.cover_background_imagem_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }
    : { backgroundColor: settings.cor_background_cover || settings.cor_background };

  if (loading) {
    return (
      <div className="min-h-screen" style={backgroundStyle}>
        <div className="w-full max-w-[600px] mx-auto aspect-[3/2] bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-8 md:pb-0 md:h-[100svh] md:overflow-hidden md:flex md:flex-col"
      style={backgroundStyle}
    >

      <div className="w-full max-w-[600px] mx-auto px-4 pt-4 space-y-6 md:space-y-4 md:pt-4 md:pb-4 md:flex md:flex-col md:flex-1 md:min-h-0 md:justify-center">
        {/* Banner 1 - 600x400 (3:2) */}
        {settings.cover_banner1_url && (
          <div className="w-full aspect-[3/2] md:aspect-auto md:flex-[3] md:min-h-0 overflow-hidden rounded-lg shadow-md">
            <img
              src={settings.cover_banner1_url}
              alt={`Banner de ${settings.empresa_nome}`}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
        )}

        {/* Botões de navegação */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 md:flex-[2] md:min-h-0 md:grid-rows-2">
          {buttons.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="flex flex-col items-center justify-center gap-2 aspect-square md:aspect-auto md:h-full md:min-h-0 rounded-2xl shadow-md transition-transform active:scale-95 hover:opacity-90"
              style={{ backgroundColor: settings.cover_botao_cor_fundo || settings.cor_primaria }}
            >
              <Icon className="h-8 w-8 sm:h-10 sm:w-10 md:h-7 md:w-7 lg:h-8 lg:w-8" strokeWidth={1.75} style={{ color: settings.cover_botao_cor_icone || '#ffffff' }} />
              <span
                className="text-xs sm:text-sm font-semibold leading-tight text-center px-1 break-words w-full"
                style={{ color: settings.cover_botao_cor_icone || '#ffffff' }}
              >
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Banner 2 - 600x200 (3:1) */}
        {settings.cover_banner2_url && (
          <div
            className={`w-full aspect-[3/1] overflow-hidden rounded-lg shadow-md ${banner2Clickable ? "cursor-pointer transition-transform active:scale-[0.99]" : ""}`}
            role={banner2Clickable ? "button" : undefined}
            tabIndex={banner2Clickable ? 0 : undefined}
            onClick={banner2Clickable ? handleBanner2Click : undefined}
            onKeyDown={
              banner2Clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleBanner2Click();
                    }
                  }
                : undefined
            }
          >
            <img
              src={settings.cover_banner2_url}
              alt={`Banner promocional de ${settings.empresa_nome}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>

    </div>
  );
};

export default Cover;
