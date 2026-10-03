import React from "react";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";
import StoreStatusBadge from "@/components/StoreStatusBadge";

interface RestaurantHeaderProps {
  actions?: React.ReactNode;
  onBannerClick?: () => void;
}

const RestaurantHeader: React.FC<RestaurantHeaderProps> = ({ actions, onBannerClick }) => {
  const { settings, loading } = useLayoutSettings();

  if (loading) {
    return (
      <div className="relative">
        <div className="hidden md:block w-full max-w-[1000px] mx-auto aspect-[4/1] bg-muted animate-pulse" />
        <div className="container mx-auto px-4 relative -mt-[4.9rem] md:-mt-[7rem] z-10 mb-1">
          <div className="rounded-lg shadow-lg p-3 sm:p-4 bg-muted animate-pulse h-24" />
        </div>
      </div>
    );
  }

  const useSameImage = settings.usar_mesma_imagem_mobile !== 'false';
  const mobileUrl = !useSameImage && settings.empresa_banner_mobile_url
    ? settings.empresa_banner_mobile_url
    : settings.empresa_banner_url;

  return (
    <div className="relative">
      {/* Banner desktop com proporção 1000x250 (4:1) */}
      <div
        className={`hidden md:block w-full max-w-[1000px] mx-auto aspect-[4/1] overflow-hidden ${onBannerClick ? "cursor-pointer" : ""}`}
        onClick={onBannerClick}
        role={onBannerClick ? "button" : undefined}
        style={{
          background: `linear-gradient(to left, ${settings.cor_secundaria}, ${settings.cor_primaria})`,
        }}
      >
        <picture>
          <source media="(min-width: 768px)" srcSet={settings.empresa_banner_url} />
          <img
            src={mobileUrl}
            alt={settings.empresa_nome}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            width="1000"
            height="250"
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "/images/restaurant-banner.jpg";
            }}
          />
        </picture>
      </div>

      {/* Container principal */}
      <div className="w-full md:container mx-auto px-0 md:px-4 relative mt-0 md:-mt-[7rem] z-10">
        <div
          className="rounded-none md:rounded-lg shadow-sm md:shadow-lg border-b border-muted/60 md:border pt-3 pb-1 px-3 sm:p-4"
          style={{ backgroundColor: settings.cor_background_header }}
        >
          {/* Linha 1: logo + nome/descrição + status */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-white shadow-md flex-shrink-0">
              <img
                src={settings.empresa_logo_url}
                alt="Logo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "/placeholder.svg";
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1
                className="text-base sm:text-xl font-bold leading-tight truncate"
                style={{ color: settings.cor_fonte }}
              >
                {settings.empresa_nome}
              </h1>
              <p
                className="text-xs sm:text-sm leading-snug truncate"
                style={{ color: settings.cor_fonte }}
              >
                {settings.empresa_descricao}
              </p>
            </div>
            <div className="flex-shrink-0">
              <StoreStatusBadge textColor={settings.cor_fonte} />
            </div>
          </div>

          {/* Ações (botões de interação) */}
          {actions && <div className="mt-2 md:mt-3">{actions}</div>}
        </div>
      </div>
    </div>
  );
};

export default RestaurantHeader;
