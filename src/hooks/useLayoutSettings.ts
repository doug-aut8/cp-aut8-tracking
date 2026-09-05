import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LayoutSettings {
  empresa_nome: string;
  empresa_descricao: string;
  empresa_logo_url: string;
  empresa_banner_url: string;
  empresa_banner_mobile_url: string;
  empresa_banner_extra1_url: string;
  empresa_banner_extra2_url: string;
  cover_banner1_url: string;
  cover_banner2_url: string;
  cover_banner2_action_type: string;
  cover_banner2_action_value: string;
  cover_banner2_action_target: string;
  cover_background_tipo: string;
  cor_background_cover: string;
  cover_background_imagem_url: string;
  cover_botao_cor_fundo: string;
  cover_botao_cor_icone: string;
  banner_principal_action_type: string;
  banner_principal_action_value: string;
  banner_principal_action_target: string;
  banner_extra1_action_type: string;
  banner_extra1_action_value: string;
  banner_extra1_action_target: string;
  banner_extra2_action_type: string;
  banner_extra2_action_value: string;
  banner_extra2_action_target: string;
  usar_mesma_imagem_mobile: string;
  cor_primaria: string;
  cor_secundaria: string;
  cor_fonte: string;
  cor_fonte_categorias: string;
  cor_barra_menu_categorias: string;
  cor_fonte_menu_categorias: string;
  cor_fundo_item_menu_categorias: string;
  cor_fonte_titulos: string;
  cor_fonte_titulo_produto: string;
  cor_fonte_descricao_produto: string;
  cor_fonte_secundaria: string;
  cor_background: string;
  cor_barra_botoes: string;
  cor_botoes: string;
  cor_fonte_botoes: string;
  cor_background_header: string;
  cor_chat_cabecalho: string;
  cor_chat_fonte_cabecalho: string;
  cor_chat_fonte_baloes: string;
  cor_fonte_caixa_texto_chat: string;
  cor_destaque_categoria_ativa: string;
  cor_fonte_categoria_ativa: string;
  layout_colunas_mobile: string;
  cupom_aplicado_mensagem: string;
  banner_extra_quantidade: string;
  banner_extra_tamanho: string;
  popup_ativo: string;
  popup_imagem_url: string;
  popup_texto_fechar: string;
  popup_texto_aplicar: string;
  popup_action_type: string;
  popup_action_value: string;
  popup_action_target: string;
  pagina_inicial: string;
}

const defaults: LayoutSettings = {
  empresa_nome: 'ClickPrato',
  empresa_descricao: 'Cardápio Digital Inteligente',
  empresa_logo_url: 'https://bmhxnlxcgseemmfacuqi.supabase.co/storage/v1/object/public/imagens_clickprato/logo_clickprato_preto.png',
  empresa_banner_url: 'https://bmhxnlxcgseemmfacuqi.supabase.co/storage/v1/object/public/imagens_clickprato/banner_clickprato2.png',
  empresa_banner_mobile_url: 'https://bmhxnlxcgseemmfacuqi.supabase.co/storage/v1/object/public/imagens_clickprato/banner4.png',
  empresa_banner_extra1_url: '',
  empresa_banner_extra2_url: '',
  cover_banner1_url: '',
  cover_banner2_url: '',
  cover_banner2_action_type: 'none',
  cover_banner2_action_value: '',
  cover_banner2_action_target: 'new_page',
  cover_background_tipo: 'cor',
  cor_background_cover: '#f9fafb',
  cover_background_imagem_url: '',
  cover_botao_cor_fundo: '',
  cover_botao_cor_icone: '#ffffff',
  banner_principal_action_type: 'none',
  banner_principal_action_value: '',
  banner_principal_action_target: 'new_page',
  banner_extra1_action_type: 'none',
  banner_extra1_action_value: '',
  banner_extra1_action_target: 'new_page',
  banner_extra2_action_type: 'none',
  banner_extra2_action_value: '',
  banner_extra2_action_target: 'new_page',
  usar_mesma_imagem_mobile: 'false',
  cor_primaria: '#ff6600',
  cor_secundaria: '#ff9933',
  cor_fonte: '#1f2937',
  cor_fonte_categorias: '#1f2937',
  cor_barra_menu_categorias: '#ffffff',
  cor_fonte_menu_categorias: '#1f2937',
  cor_fundo_item_menu_categorias: '#f3f4f6',
  cor_fonte_titulos: '#1f2937',
  cor_fonte_titulo_produto: '#1f2937',
  cor_fonte_descricao_produto: '#4b5563',
  cor_fonte_secundaria: '#6b7280',
  cor_background: '#f9fafb',
  cor_barra_botoes: '#ffffff',
  cor_botoes: '#ffffff',
  cor_fonte_botoes: '#1f2937',
  cor_background_header: '#ffffff',
  cor_chat_cabecalho: '#ff4400',
  cor_chat_fonte_cabecalho: '#ffffff',
  cor_chat_fonte_baloes: '#050200',
  cor_fonte_caixa_texto_chat: '#050200',
  cor_destaque_categoria_ativa: '#098a00',
  cor_fonte_categoria_ativa: '#ffffff',
  layout_colunas_mobile: '1',
  cupom_aplicado_mensagem: 'O cupom {cupom} foi aplicado automaticamente ao seu pedido.',
  banner_extra_quantidade: '2',
  banner_extra_tamanho: 'normal',
  popup_ativo: 'false',
  popup_imagem_url: '',
  popup_texto_fechar: 'Não Quero',
  popup_texto_aplicar: 'QUERO',
  popup_action_type: 'none',
  popup_action_value: '',
  popup_action_target: 'new_page',
  pagina_inicial: 'cover',
};

const CACHE_KEY = 'layout_settings_cache_v2';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// Chaves de cor que podem ter uma versão independente para o modo escuro
export const COLOR_KEYS = Object.keys(defaults).filter((k) => k.startsWith('cor_')) as (keyof LayoutSettings)[];
export const darkKey = (key: string) => `dark_${key}`;

export interface LayoutSettingsBundle {
  light: LayoutSettings;
  dark: LayoutSettings;
  darkMode: boolean;
}

interface CacheShape {
  ts: number;
  data: LayoutSettingsBundle;
}

const readCache = (): LayoutSettingsBundle | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CacheShape = JSON.parse(raw);
    if (!parsed?.data?.light) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return {
      light: { ...defaults, ...parsed.data.light },
      dark: { ...defaults, ...parsed.data.dark },
      darkMode: !!parsed.data.darkMode,
    };
  } catch {
    return null;
  }
};

const writeCache = (data: LayoutSettingsBundle) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore
  }
};

interface LayoutSettingsContextValue {
  settings: LayoutSettings;
  lightSettings: LayoutSettings;
  darkSettings: LayoutSettings;
  darkMode: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

const LayoutSettingsContext = createContext<LayoutSettingsContextValue | null>(null);

// Promise compartilhada para deduplicar fetches paralelos
let inflightFetch: Promise<LayoutSettingsBundle> | null = null;

const fetchLayoutSettings = async (): Promise<LayoutSettingsBundle> => {
  if (inflightFetch) return inflightFetch;

  inflightFetch = (async () => {
    const keys = Object.keys(defaults);
    const allKeys = [
      ...keys,
      'modo_escuro',
      ...COLOR_KEYS.map((k) => darkKey(k as string)),
      darkKey('cover_background_tipo'),
      darkKey('cover_background_imagem_url'),
    ];
    const { data, error } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', allKeys);

    if (error) {
      console.error('Erro ao buscar configurações de layout:', error);
      return { light: defaults, dark: defaults, darkMode: false };
    }

    const light = { ...defaults };
    const darkOverrides: Partial<LayoutSettings> = {};
    let darkMode = false;

    data?.forEach((row) => {
      if (!row.valor) return;
      if (row.chave === 'modo_escuro') {
        darkMode = row.valor === 'true';
      } else if (row.chave.startsWith('dark_')) {
        const base = row.chave.slice(5);
        if (base in light) (darkOverrides as any)[base] = row.valor;
      } else if (row.chave in light) {
        (light as any)[row.chave] = row.valor;
      }
    });

    const bundle: LayoutSettingsBundle = {
      light,
      dark: { ...light, ...darkOverrides },
      darkMode,
    };
    writeCache(bundle);
    return bundle;
  })();

  try {
    return await inflightFetch;
  } finally {
    inflightFetch = null;
  }
};

export const LayoutSettingsProvider = ({ children }: { children: ReactNode }) => {
  const cached = readCache();
  const [bundle, setBundle] = useState<LayoutSettingsBundle>(
    cached ?? { light: defaults, dark: defaults, darkMode: false }
  );
  const [loading, setLoading] = useState(!cached);

  const refetch = useCallback(async () => {
    const fresh = await fetchLayoutSettings();
    setBundle(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (cached) {
      // Já temos cache válido — não precisa refetch
      return;
    }
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aplica/remove a classe "dark" no <html> conforme a configuração
  useEffect(() => {
    document.documentElement.classList.toggle('dark', bundle.darkMode);
  }, [bundle.darkMode]);

  const settings = bundle.darkMode ? bundle.dark : bundle.light;

  return React.createElement(
    LayoutSettingsContext.Provider,
    {
      value: {
        settings,
        lightSettings: bundle.light,
        darkSettings: bundle.dark,
        darkMode: bundle.darkMode,
        loading,
        refetch,
      },
    },
    children
  );
};

export const useLayoutSettings = () => {
  const ctx = useContext(LayoutSettingsContext);
  if (ctx) return ctx;

  // Fallback: caso algum componente seja renderizado fora do Provider,
  // mantém compatibilidade retornando defaults sem disparar fetch.
  const cached = readCache();
  const fallback = cached ?? { light: defaults, dark: defaults, darkMode: false };
  return {
    settings: fallback.darkMode ? fallback.dark : fallback.light,
    lightSettings: fallback.light,
    darkSettings: fallback.dark,
    darkMode: fallback.darkMode,
    loading: false,
    refetch: async () => {
      await fetchLayoutSettings();
    },
  };
};

export const saveLayoutSetting = async (chave: string, valor: string) => {
  const { data: existing } = await supabase
    .from('configuracoes')
    .select('id')
    .eq('chave', chave)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('configuracoes')
      .update({ valor, updated_at: new Date().toISOString() })
      .eq('chave', chave);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('configuracoes')
      .insert({ chave, valor });
    if (error) throw error;
  }

  // Invalida cache para forçar refetch na próxima leitura
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
};
