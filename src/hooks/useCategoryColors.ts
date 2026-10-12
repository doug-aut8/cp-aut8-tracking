import { useEffect, useState, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLayoutSettings } from '@/hooks/useLayoutSettings';

export interface CategoryColors {
  bgColor: string;
  fontColor: string;
}

const DEFAULT_BG = '#ffffff';
const DEFAULT_FONT = '#1f2937';

interface CategoryColorThemes {
  light: Record<string, CategoryColors>;
  dark: Record<string, CategoryColors>;
}

let cache: CategoryColorThemes = { light: {}, dark: {} };
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
        .or('chave.like.cat_bg_%,chave.like.cat_font_%,chave.like.dark_cat_bg_%,chave.like.dark_cat_font_%');

      if (error) {
        console.error('Erro ao buscar cores de categorias:', error);
        return;
      }

      const light: Record<string, CategoryColors> = {};
      const dark: Record<string, CategoryColors> = {};
      data?.forEach((row) => {
        if (row.chave.startsWith('dark_cat_bg_')) {
          const catId = row.chave.replace('dark_cat_bg_', '');
          if (!dark[catId]) dark[catId] = { bgColor: DEFAULT_BG, fontColor: DEFAULT_FONT };
          dark[catId].bgColor = row.valor || DEFAULT_BG;
        } else if (row.chave.startsWith('dark_cat_font_')) {
          const catId = row.chave.replace('dark_cat_font_', '');
          if (!dark[catId]) dark[catId] = { bgColor: DEFAULT_BG, fontColor: DEFAULT_FONT };
          dark[catId].fontColor = row.valor || DEFAULT_FONT;
        } else if (row.chave.startsWith('cat_bg_')) {
          const catId = row.chave.replace('cat_bg_', '');
          if (!light[catId]) light[catId] = { bgColor: DEFAULT_BG, fontColor: DEFAULT_FONT };
          light[catId].bgColor = row.valor || DEFAULT_BG;
        } else if (row.chave.startsWith('cat_font_')) {
          const catId = row.chave.replace('cat_font_', '');
          if (!light[catId]) light[catId] = { bgColor: DEFAULT_BG, fontColor: DEFAULT_FONT };
          light[catId].fontColor = row.valor || DEFAULT_FONT;
        }
      });
      cache = { light, dark };
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

export const invalidateCategoryColorsCache = () => {
  cache = { light: {}, dark: {} };
  loaded = false;
  inflight = null;
  notify();
};

export const useCategoryColors = () => {
  const colorThemes = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { darkMode } = useLayoutSettings();
  const colors = darkMode ? colorThemes.dark : colorThemes.light;
  const [loading, setLoading] = useState(!loaded);

  useEffect(() => {
    if (!loaded) {
      load().then(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const getColors = (categoryId: string): CategoryColors => {
    const lightColors = colorThemes.light[categoryId];
    return colors[categoryId] || lightColors || { bgColor: DEFAULT_BG, fontColor: DEFAULT_FONT };
  };

  const refetch = async () => {
    inflight = null;
    loaded = false;
    await load();
  };

  return { colors, getColors, loading, refetch };
};
