import { useEffect, useState, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryColors {
  bgColor: string;
  fontColor: string;
}

const DEFAULT_BG = '#ffffff';
const DEFAULT_FONT = '#1f2937';

let cache: Record<string, CategoryColors> = {};
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

const load = (): Promise<void> => {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .or('chave.like.cat_bg_%,chave.like.cat_font_%');

      if (error) {
        console.error('Erro ao buscar cores de categorias:', error);
        return;
      }

      const map: Record<string, CategoryColors> = {};
      data?.forEach((row) => {
        if (row.chave.startsWith('cat_bg_')) {
          const catId = row.chave.replace('cat_bg_', '');
          if (!map[catId]) map[catId] = { bgColor: DEFAULT_BG, fontColor: DEFAULT_FONT };
          map[catId].bgColor = row.valor || DEFAULT_BG;
        } else if (row.chave.startsWith('cat_font_')) {
          const catId = row.chave.replace('cat_font_', '');
          if (!map[catId]) map[catId] = { bgColor: DEFAULT_BG, fontColor: DEFAULT_FONT };
          map[catId].fontColor = row.valor || DEFAULT_FONT;
        }
      });
      cache = map;
      loaded = true;
      notify();
    } catch (err) {
      console.error('Erro ao buscar cores de categorias:', err);
    }
  })();
  return inflight;
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const getSnapshot = () => cache;

export const useCategoryColors = () => {
  const colors = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [loading, setLoading] = useState(!loaded);

  useEffect(() => {
    if (!loaded) {
      load().then(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const getColors = (categoryId: string): CategoryColors =>
    colors[categoryId] || { bgColor: DEFAULT_BG, fontColor: DEFAULT_FONT };

  const refetch = async () => {
    inflight = null;
    loaded = false;
    await load();
  };

  return { colors, getColors, loading, refetch };
};
