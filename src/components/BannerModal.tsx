import React, { useEffect, useState } from 'react';
import { useLayoutSettings } from '@/hooks/useLayoutSettings';

export interface BannerModalPayload {
  imagem?: string;
  texto?: string;
}

export const BANNER_MODAL_EVENT = 'banner-modal-open';

export const openBannerModal = (payload: BannerModalPayload) => {
  window.dispatchEvent(new CustomEvent<BannerModalPayload>(BANNER_MODAL_EVENT, { detail: payload }));
};

const BannerModal: React.FC = () => {
  const { settings } = useLayoutSettings();
  const [payload, setPayload] = useState<BannerModalPayload | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<BannerModalPayload>).detail || {};
      setPayload(detail);
    };
    window.addEventListener(BANNER_MODAL_EVENT, handler as EventListener);
    return () => window.removeEventListener(BANNER_MODAL_EVENT, handler as EventListener);
  }, []);

  useEffect(() => {
    if (payload) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [payload]);

  if (!payload) return null;

  const close = () => setPayload(null);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-0 sm:p-6">
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-background sm:h-auto sm:max-h-[90vh] sm:rounded-lg sm:shadow-xl">
        <div className="flex-1 overflow-y-auto">
          {payload.imagem && (
            <img
              src={payload.imagem}
              alt="Imagem promocional"
              className="w-full object-cover"
              style={{ aspectRatio: '2 / 1' }}
            />
          )}
          {payload.texto && (
            <div className="whitespace-pre-wrap break-words p-5 text-sm leading-relaxed text-foreground">
              {payload.texto}
            </div>
          )}
        </div>
        <div className="border-t p-4">
          <button
            type="button"
            onClick={close}
            className="w-full rounded-md py-3 text-base font-semibold shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: settings.cor_botoes, color: settings.cor_fonte_botoes }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default BannerModal;
