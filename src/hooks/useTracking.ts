import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
    _fbq: any;
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

interface TrackingConfig {
  meta_pixel_id: string | null;
  gtm_container_id: string | null;
  capi_ativo: boolean;
}

let trackingConfig: TrackingConfig | null = null;
let configLoaded = false;
let configPromise: Promise<TrackingConfig | null> | null = null;

/**
 * Loads tracking config from Supabase (singleton, cached).
 */
export const getTrackingConfig = async (): Promise<TrackingConfig | null> => {
  if (configLoaded) return trackingConfig;
  if (configPromise) return configPromise;

  configPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('tags_rastreamento' as any)
        .select('meta_pixel_id, gtm_container_id, capi_ativo')
        .eq('id', 1)
        .maybeSingle();

      if (error || !data) {
        if (error) console.warn('Tracking config not found:', error);
        configLoaded = true;
        return null;
      }

      const d = data as any;
      trackingConfig = {
        meta_pixel_id: d.meta_pixel_id || null,
        gtm_container_id: d.gtm_container_id || null,
        capi_ativo: d.capi_ativo ?? false,
      };
      configLoaded = true;
      return trackingConfig;
    } catch (e) {
      console.error('Error loading tracking config:', e);
      configLoaded = true;
      return null;
    }
  })();

  return configPromise;
};

/**
 * Initializes Meta Pixel script.
 */
const initMetaPixel = (pixelId: string) => {
  if (window.fbq) return;

  (function (f: any, b: any, e: any, v: any) {
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    const t = b.createElement(e);
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq('init', pixelId);
};

/**
 * Initializes GTM script.
 */
const initGTM = (containerId: string) => {
  if (document.querySelector(`script[src*="googletagmanager.com/gtm.js"]`)) return;

  // GTM snippet
  (function (w: any, d: any, s: string, l: string, i: string) {
    w[l] = w[l] || [];
    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    const f = d.getElementsByTagName(s)[0];
    const j = d.createElement(s) as HTMLScriptElement;
    const dl = l !== 'dataLayer' ? '&l=' + l : '';
    j.async = true;
    j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
    f.parentNode.insertBefore(j, f);
  })(window, document, 'script', 'dataLayer', containerId);
};

/**
 * Hook that loads tracking config from Supabase, initializes scripts,
 * and sends PageView on every route change.
 */
export const useTracking = () => {
  const location = useLocation();
  const initialized = useRef(false);

  // Initialize scripts once
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    getTrackingConfig().then((cfg) => {
      if (!cfg) return;
      if (cfg.meta_pixel_id) initMetaPixel(cfg.meta_pixel_id);
      if (cfg.gtm_container_id) initGTM(cfg.gtm_container_id);

      // Initial PageView
      if (cfg.meta_pixel_id && window.fbq) {
        window.fbq('track', 'PageView');
      }
    });
  }, []);

  // Set user_id in dataLayer when auth state changes (for GA4 User-ID)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ user_id: session?.user?.id ?? null });
    });
    return () => subscription.unsubscribe();
  }, []);

  // Track PageView on route change
  useEffect(() => {
    if (!trackingConfig) return;

    if (trackingConfig.meta_pixel_id && window.fbq) {
      window.fbq('track', 'PageView');
    }

    // Push pageview to dataLayer for GTM
    if (trackingConfig.gtm_container_id) {
      window.dataLayer = window.dataLayer || [];
      supabase.auth.getSession().then(({ data: { session } }) => {
        const uid = session?.user?.id ?? null;
        window.dataLayer.push({
          event: 'page_view',
          page_path: location.pathname + location.search,
          page_title: document.title,
          ...(uid ? { user_id: uid } : {}),
        });
      });
    }
  }, [location]);
};
