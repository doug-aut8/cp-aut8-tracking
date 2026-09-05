import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Palette as PageIcon } from "lucide-react";
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Upload, Palette, Tag, RotateCcw, Moon, Sun } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useLayoutSettings, saveLayoutSetting, COLOR_KEYS, darkKey } from '@/hooks/useLayoutSettings';
import { useImageUpload } from '@/hooks/useImageUpload';
import { getAllCategories } from '@/services/categoryService';
import { Category } from '@/types/menu';
import { supabase } from '@/integrations/supabase/client';

interface CuponOption {
  id: string;
  nome: string;
}

interface BannerActionFieldsProps {
  label: string;
  type: string;
  value: string;
  target: string;
  cupons: CuponOption[];
  onTypeChange: (v: string) => void;
  onValueChange: (v: string) => void;
  onTargetChange: (v: string) => void;
}

const BannerActionFields: React.FC<BannerActionFieldsProps> = ({
  label,
  type,
  value,
  target,
  cupons,
  onTypeChange,
  onValueChange,
  onTargetChange,
}) => {
  return (
    <div className="mt-2 p-3 rounded border bg-muted/30 space-y-2">
      <Label className="text-xs font-semibold">{label}</Label>
      <Select value={type || 'none'} onValueChange={onTypeChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione a ação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhuma ação</SelectItem>
          <SelectItem value="link">Abrir link</SelectItem>
          <SelectItem value="cupom">Aplicar cupom</SelectItem>
        </SelectContent>
      </Select>
      {type === 'link' && (
        <>
          <Input
            placeholder="https://exemplo.com"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
          />
          <Select value={target || 'new_page'} onValueChange={onTargetChange}>
            <SelectTrigger>
              <SelectValue placeholder="Onde abrir" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new_page">Abrir em nova página</SelectItem>
              <SelectItem value="same_page">Abrir na mesma página</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}
      {type === 'cupom' && (
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um cupom" />
          </SelectTrigger>
          <SelectContent>
            {cupons.length === 0 ? (
              <SelectItem value="__empty__" disabled>
                Nenhum cupom disponível
              </SelectItem>
            ) : (
              cupons.map((c) => (
                <SelectItem key={c.id} value={c.nome}>
                  {c.nome}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

const Layout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { lightSettings: settings, darkSettings, loading, refetch: refetchLayout } = useLayoutSettings();
  const { uploadImage, isUploading } = useImageUpload();

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerMobileUrl, setBannerMobileUrl] = useState('');
  const [bannerExtra1Url, setBannerExtra1Url] = useState('');
  const [bannerExtra2Url, setBannerExtra2Url] = useState('');
  const [bannerExtraQuantidade, setBannerExtraQuantidade] = useState('2');
  const [bannerExtraTamanho, setBannerExtraTamanho] = useState('normal');
  const [bannerPrincipalActionType, setBannerPrincipalActionType] = useState('none');
  const [bannerPrincipalActionValue, setBannerPrincipalActionValue] = useState('');
  const [bannerPrincipalActionTarget, setBannerPrincipalActionTarget] = useState('new_page');
  const [bannerExtra1ActionType, setBannerExtra1ActionType] = useState('none');
  const [bannerExtra1ActionValue, setBannerExtra1ActionValue] = useState('');
  const [bannerExtra1ActionTarget, setBannerExtra1ActionTarget] = useState('new_page');
  const [bannerExtra2ActionType, setBannerExtra2ActionType] = useState('none');
  const [bannerExtra2ActionValue, setBannerExtra2ActionValue] = useState('');
  const [bannerExtra2ActionTarget, setBannerExtra2ActionTarget] = useState('new_page');
  const [usarMesmaImagemMobile, setUsarMesmaImagemMobile] = useState(true);
  const [coverBanner1Url, setCoverBanner1Url] = useState('');
  const [coverBanner2Url, setCoverBanner2Url] = useState('');
  const [coverBanner2ActionType, setCoverBanner2ActionType] = useState('none');
  const [coverBanner2ActionValue, setCoverBanner2ActionValue] = useState('');
  const [coverBanner2ActionTarget, setCoverBanner2ActionTarget] = useState('new_page');
  const [coverBackgroundTipo, setCoverBackgroundTipo] = useState<'cor' | 'imagem'>('cor');
  const [corBackgroundCover, setCorBackgroundCover] = useState('#f9fafb');
  const [coverBackgroundImagemUrl, setCoverBackgroundImagemUrl] = useState('');
  const [darkCoverBackgroundTipo, setDarkCoverBackgroundTipo] = useState<'cor' | 'imagem'>('cor');
  const [darkCoverBackgroundImagemUrl, setDarkCoverBackgroundImagemUrl] = useState('');
  const [coverBotaoCorFundo, setCoverBotaoCorFundo] = useState('');
  const [coverBotaoCorIcone, setCoverBotaoCorIcone] = useState('#ffffff');
  const [corPrimaria, setCorPrimaria] = useState('#ff6600');
  const [corSecundaria, setCorSecundaria] = useState('#ff9933');
  const [corFonte, setCorFonte] = useState('#1f2937');
  const [corFonteCategorias, setCorFonteCategorias] = useState('#1f2937');
  const [corBarraMenuCategorias, setCorBarraMenuCategorias] = useState('#ffffff');
  const [corFonteMenuCategorias, setCorFonteMenuCategorias] = useState('#1f2937');
  const [corFundoItemMenuCategorias, setCorFundoItemMenuCategorias] = useState('#f3f4f6');
  const [corFonteTitulos, setCorFonteTitulos] = useState('#1f2937');
  const [corFonteTituloProduto, setCorFonteTituloProduto] = useState('#1f2937');
  const [corFonteDescricaoProduto, setCorFonteDescricaoProduto] = useState('#4b5563');
  const [corFonteSecundaria, setCorFonteSecundaria] = useState('#6b7280');
  const [corBackground, setCorBackground] = useState('#f9fafb');
  const [corBarraBotoes, setCorBarraBotoes] = useState('#ffffff');
  const [corBotoes, setCorBotoes] = useState('#ffffff');
  const [corFonteBotoes, setCorFonteBotoes] = useState('#1f2937');
  const [corBackgroundHeader, setCorBackgroundHeader] = useState('#ffffff');
  const [corChatCabecalho, setCorChatCabecalho] = useState('#ff4400');
  const [corChatFonteCabecalho, setCorChatFonteCabecalho] = useState('#ffffff');
  const [corChatFonteBaloes, setCorChatFonteBaloes] = useState('#050200');
  const [corFonteCaixaTextoChat, setCorFonteCaixaTextoChat] = useState('#050200');
  const [corDestaqueCategoriaAtiva, setCorDestaqueCategoriaAtiva] = useState('#098a00');
  const [corFonteCategoriaAtiva, setCorFonteCategoriaAtiva] = useState('#ffffff');
  const [layoutColunasMobile, setLayoutColunasMobile] = useState('1');
  const [cupomAplicadoMensagem, setCupomAplicadoMensagem] = useState('O cupom {cupom} foi aplicado automaticamente ao seu pedido.');
  const [cupons, setCupons] = useState<CuponOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Default colors for reset
  const DEFAULT_COLORS = {
    corPrimaria: '#050200',
    corSecundaria: '#d1001f',
    corFonte: '#000000',
    corBackground: '#f5f5f5',
    corFonteCategorias: '#000000',
    corFonteTitulos: '#000000',
    corFonteTituloProduto: '#000000',
    corFonteSecundaria: '#6b7280',
    corBarraBotoes: '#f5f5f5',
    corBotoes: '#098a00',
    corFonteBotoes: '#f5f5f5',
    corBackgroundHeader: '#f5f5f5',
    corDestaqueCategoriaAtiva: '#098a00',
    corFonteCategoriaAtiva: '#ffffff',
  };

  // Dark mode preset (baseado na referência visual)
  const DARK_COLORS = {
    corPrimaria: '#d1001f',
    corSecundaria: '#ff6600',
    corFonte: '#f5f5f5',
    corBackground: '#111111',
    corFonteCategorias: '#e5e7eb',
    corFonteTitulos: '#ffffff',
    corFonteTituloProduto: '#ffffff',
    corFonteSecundaria: '#9ca3af',
    corBarraBotoes: '#0a1f10',
    corBotoes: '#0a2e14',
    corFonteBotoes: '#4ade80',
    corBackgroundHeader: '#0d0d0d',
    corDestaqueCategoriaAtiva: '#22c55e',
    corFonteCategoriaAtiva: '#ffffff',
  };

  const [modoEscuro, setModoEscuro] = useState(false);
  const [temaEdicao, setTemaEdicao] = useState<'claro' | 'escuro'>('claro');
  const [darkColors, setDarkColors] = useState<Record<string, string>>({});

  // Per-category colors
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryColors, setCategoryColors] = useState<Record<string, { bgColor: string; fontColor: string }>>({});
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    if (!loading) {
      setNome(settings.empresa_nome);
      setDescricao(settings.empresa_descricao);
      setLogoUrl(settings.empresa_logo_url);
      setBannerUrl(settings.empresa_banner_url);
      setBannerMobileUrl(settings.empresa_banner_mobile_url);
      setCoverBanner1Url((settings as any).cover_banner1_url || '');
      setCoverBanner2Url((settings as any).cover_banner2_url || '');
      setCoverBanner2ActionType((settings as any).cover_banner2_action_type || 'none');
      setCoverBanner2ActionValue((settings as any).cover_banner2_action_value || '');
      setCoverBanner2ActionTarget((settings as any).cover_banner2_action_target || 'new_page');
      setCoverBackgroundTipo(((settings as any).cover_background_tipo === 'imagem') ? 'imagem' : 'cor');
      setCorBackgroundCover((settings as any).cor_background_cover || settings.cor_background || '#f9fafb');
      setCoverBackgroundImagemUrl((settings as any).cover_background_imagem_url || '');
      setCoverBotaoCorFundo((settings as any).cover_botao_cor_fundo || '');
      setCoverBotaoCorIcone((settings as any).cover_botao_cor_icone || '#ffffff');
      setBannerExtra1Url(settings.empresa_banner_extra1_url);
      setBannerExtra2Url(settings.empresa_banner_extra2_url);
      setBannerExtraQuantidade((settings as any).banner_extra_quantidade || '2');
      setBannerExtraTamanho((settings as any).banner_extra_tamanho || 'normal');
      setBannerPrincipalActionType((settings as any).banner_principal_action_type || 'none');
      setBannerPrincipalActionValue((settings as any).banner_principal_action_value || '');
      setBannerPrincipalActionTarget((settings as any).banner_principal_action_target || 'new_page');
      setBannerExtra1ActionType((settings as any).banner_extra1_action_type || 'none');
      setBannerExtra1ActionValue((settings as any).banner_extra1_action_value || '');
      setBannerExtra1ActionTarget((settings as any).banner_extra1_action_target || 'new_page');
      setBannerExtra2ActionType((settings as any).banner_extra2_action_type || 'none');
      setBannerExtra2ActionValue((settings as any).banner_extra2_action_value || '');
      setBannerExtra2ActionTarget((settings as any).banner_extra2_action_target || 'new_page');
      setUsarMesmaImagemMobile(settings.usar_mesma_imagem_mobile !== 'false');
      setCorPrimaria(settings.cor_primaria);
      setCorSecundaria(settings.cor_secundaria);
      setCorFonte(settings.cor_fonte);
      setCorFonteCategorias(settings.cor_fonte_categorias);
      setCorBarraMenuCategorias(settings.cor_barra_menu_categorias);
      setCorFonteMenuCategorias(settings.cor_fonte_menu_categorias);
      setCorFundoItemMenuCategorias(settings.cor_fundo_item_menu_categorias);
      setCorFonteTitulos(settings.cor_fonte_titulos);
      setCorFonteTituloProduto(settings.cor_fonte_titulo_produto);
      setCorFonteDescricaoProduto(settings.cor_fonte_descricao_produto);
      setCorFonteSecundaria(settings.cor_fonte_secundaria);
      setCorBackground(settings.cor_background);
      setCorBarraBotoes(settings.cor_barra_botoes);
      setCorBotoes(settings.cor_botoes);
      setCorFonteBotoes(settings.cor_fonte_botoes);
      setCorBackgroundHeader(settings.cor_background_header);
      setCorChatCabecalho(settings.cor_chat_cabecalho);
      setCorChatFonteCabecalho(settings.cor_chat_fonte_cabecalho);
      setCorChatFonteBaloes(settings.cor_chat_fonte_baloes);
      setCorFonteCaixaTextoChat(settings.cor_fonte_caixa_texto_chat);
      setCorDestaqueCategoriaAtiva(settings.cor_destaque_categoria_ativa);
      setCorFonteCategoriaAtiva(settings.cor_fonte_categoria_ativa);
      setLayoutColunasMobile(settings.layout_colunas_mobile);
      setCupomAplicadoMensagem((settings as any).cupom_aplicado_mensagem || 'O cupom {cupom} foi aplicado automaticamente ao seu pedido.');
      setDarkCoverBackgroundTipo(((darkSettings as any).cover_background_tipo === 'imagem') ? 'imagem' : 'cor');
      setDarkCoverBackgroundImagemUrl((darkSettings as any).cover_background_imagem_url || '');
      const dc: Record<string, string> = {};
      COLOR_KEYS.forEach((k) => {
        dc[k as string] = (darkSettings as any)[k];
      });
      setDarkColors(dc);
    }
  }, [loading, settings]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getAllCategories();
        setCategories(cats);

        const { data } = await supabase
          .from('configuracoes')
          .select('chave, valor')
          .or('chave.like.cat_bg_%,chave.like.cat_font_%');

        const map: Record<string, { bgColor: string; fontColor: string }> = {};
        cats.forEach((c) => {
          map[c.id] = { bgColor: '#ffffff', fontColor: '#1f2937' };
        });
        data?.forEach((row) => {
          if (row.chave.startsWith('cat_bg_')) {
            const catId = row.chave.replace('cat_bg_', '');
            if (map[catId]) map[catId].bgColor = row.valor || '#ffffff';
          } else if (row.chave.startsWith('cat_font_')) {
            const catId = row.chave.replace('cat_font_', '');
            if (map[catId]) map[catId].fontColor = row.valor || '#1f2937';
          }
        });
        setCategoryColors(map);
      } catch (err) {
        console.error('Erro ao carregar categorias:', err);
      } finally {
        setLoadingCategories(false);
      }
    };
    const loadCupons = async () => {
      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('cupons')
          .select('id, nome')
          .eq('ativo', true)
          .lte('data_inicio', now)
          .gte('data_fim', now)
          .order('nome', { ascending: true });
        if (!error && data) {
          setCupons(data as CuponOption[]);
        }
      } catch (err) {
        console.error('Erro ao carregar cupons:', err);
      }
    };
    const loadModoEscuro = async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'modo_escuro')
        .maybeSingle();
      if (data?.valor === 'true') setModoEscuro(true);
    };
    loadCategories();
    loadCupons();
    loadModoEscuro();
  }, []);

  const applyDarkMode = (enabled: boolean) => {
    setModoEscuro(enabled);
    setTemaEdicao(enabled ? 'escuro' : 'claro');
  };

  // Preenche as cores do modo escuro com a paleta escura sugerida
  const aplicarPaletaEscuraSugerida = () => {
    setDarkColors((prev) => ({
      ...prev,
      cor_primaria: DARK_COLORS.corPrimaria,
      cor_secundaria: DARK_COLORS.corSecundaria,
      cor_fonte: DARK_COLORS.corFonte,
      cor_background: DARK_COLORS.corBackground,
      cor_fonte_categorias: DARK_COLORS.corFonteCategorias,
      cor_barra_menu_categorias: '#111111',
      cor_fonte_menu_categorias: '#f5f5f5',
      cor_fundo_item_menu_categorias: '#1f1f1f',
      cor_fonte_titulos: DARK_COLORS.corFonteTitulos,
      cor_fonte_titulo_produto: DARK_COLORS.corFonteTituloProduto,
      cor_fonte_descricao_produto: '#cbd5e1',
      cor_fonte_secundaria: DARK_COLORS.corFonteSecundaria,
      cor_barra_botoes: DARK_COLORS.corBarraBotoes,
      cor_botoes: DARK_COLORS.corBotoes,
      cor_fonte_botoes: DARK_COLORS.corFonteBotoes,
      cor_background_header: DARK_COLORS.corBackgroundHeader,
      cor_destaque_categoria_ativa: DARK_COLORS.corDestaqueCategoriaAtiva,
      cor_fonte_categoria_ativa: DARK_COLORS.corFonteCategoriaAtiva,
    }));
    setTemaEdicao('escuro');
  };

  const handleCategoryColorChange = (catId: string, field: 'bgColor' | 'fontColor', value: string) => {
    setCategoryColors((prev) => ({
      ...prev,
      [catId]: { ...prev[catId], [field]: value },
    }));
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) setter(url);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const layoutPromises = [
        saveLayoutSetting('empresa_nome', nome),
        saveLayoutSetting('empresa_descricao', descricao),
        saveLayoutSetting('empresa_logo_url', logoUrl),
        saveLayoutSetting('empresa_banner_url', bannerUrl),
        saveLayoutSetting('empresa_banner_mobile_url', bannerMobileUrl),
        saveLayoutSetting('empresa_banner_extra1_url', bannerExtra1Url),
        saveLayoutSetting('empresa_banner_extra2_url', bannerExtra2Url),
        saveLayoutSetting('banner_extra_quantidade', bannerExtraQuantidade),
        saveLayoutSetting('banner_extra_tamanho', bannerExtraTamanho),
        saveLayoutSetting('banner_principal_action_type', bannerPrincipalActionType),
        saveLayoutSetting('banner_principal_action_value', bannerPrincipalActionValue),
        saveLayoutSetting('banner_principal_action_target', bannerPrincipalActionTarget),
        saveLayoutSetting('banner_extra1_action_type', bannerExtra1ActionType),
        saveLayoutSetting('banner_extra1_action_value', bannerExtra1ActionValue),
        saveLayoutSetting('banner_extra1_action_target', bannerExtra1ActionTarget),
        saveLayoutSetting('banner_extra2_action_type', bannerExtra2ActionType),
        saveLayoutSetting('banner_extra2_action_value', bannerExtra2ActionValue),
        saveLayoutSetting('banner_extra2_action_target', bannerExtra2ActionTarget),
        saveLayoutSetting('usar_mesma_imagem_mobile', usarMesmaImagemMobile ? 'true' : 'false'),
        saveLayoutSetting('cover_banner1_url', coverBanner1Url),
        saveLayoutSetting('cover_banner2_url', coverBanner2Url),
        saveLayoutSetting('cover_banner2_action_type', coverBanner2ActionType),
        saveLayoutSetting('cover_banner2_action_value', coverBanner2ActionValue),
        saveLayoutSetting('cover_banner2_action_target', coverBanner2ActionTarget),
        saveLayoutSetting('cover_background_tipo', coverBackgroundTipo),
        saveLayoutSetting('cor_background_cover', corBackgroundCover),
        saveLayoutSetting('cover_background_imagem_url', coverBackgroundImagemUrl),
        saveLayoutSetting(darkKey('cover_background_tipo'), darkCoverBackgroundTipo),
        saveLayoutSetting(darkKey('cover_background_imagem_url'), darkCoverBackgroundImagemUrl),
        saveLayoutSetting('cover_botao_cor_fundo', coverBotaoCorFundo || corPrimaria),
        saveLayoutSetting('cover_botao_cor_icone', coverBotaoCorIcone),
        saveLayoutSetting('modo_escuro', modoEscuro ? 'true' : 'false'),
        saveLayoutSetting('cor_primaria', corPrimaria),
        saveLayoutSetting('cor_secundaria', corSecundaria),
        saveLayoutSetting('cor_fonte', corFonte),
        saveLayoutSetting('cor_fonte_categorias', corFonteCategorias),
        saveLayoutSetting('cor_barra_menu_categorias', corBarraMenuCategorias),
        saveLayoutSetting('cor_fonte_menu_categorias', corFonteMenuCategorias),
        saveLayoutSetting('cor_fundo_item_menu_categorias', corFundoItemMenuCategorias),
        saveLayoutSetting('cor_fonte_titulos', corFonteTitulos),
        saveLayoutSetting('cor_fonte_titulo_produto', corFonteTituloProduto),
        saveLayoutSetting('cor_fonte_descricao_produto', corFonteDescricaoProduto),
        saveLayoutSetting('cor_fonte_secundaria', corFonteSecundaria),
        saveLayoutSetting('cor_background', corBackground),
        saveLayoutSetting('cor_barra_botoes', corBarraBotoes),
        saveLayoutSetting('cor_botoes', corBotoes),
        saveLayoutSetting('cor_fonte_botoes', corFonteBotoes),
        saveLayoutSetting('cor_background_header', corBackgroundHeader),
        saveLayoutSetting('cor_chat_cabecalho', corChatCabecalho),
        saveLayoutSetting('cor_chat_fonte_cabecalho', corChatFonteCabecalho),
        saveLayoutSetting('cor_chat_fonte_baloes', corChatFonteBaloes),
        saveLayoutSetting('cor_fonte_caixa_texto_chat', corFonteCaixaTextoChat),
        saveLayoutSetting('cor_destaque_categoria_ativa', corDestaqueCategoriaAtiva),
        saveLayoutSetting('cor_fonte_categoria_ativa', corFonteCategoriaAtiva),
        saveLayoutSetting('layout_colunas_mobile', layoutColunasMobile),
        saveLayoutSetting('cupom_aplicado_mensagem', cupomAplicadoMensagem),
        ...COLOR_KEYS.map((k) =>
          saveLayoutSetting(darkKey(k as string), darkColors[k as string] || (settings as any)[k])
        ),
      ];

      const catPromises = Object.entries(categoryColors).flatMap(([catId, colors]) => [
        saveLayoutSetting(`cat_bg_${catId}`, colors.bgColor),
        saveLayoutSetting(`cat_font_${catId}`, colors.fontColor),
      ]);

      await Promise.all([...layoutPromises, ...catPromises]);
      await refetchLayout();
      toast({ title: 'Sucesso', description: 'Configurações de layout salvas!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível salvar.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setShowResetDialog(false);
    setSaving(true);
    try {
      // Update local state with default colors
      setCorPrimaria(DEFAULT_COLORS.corPrimaria);
      setCorSecundaria(DEFAULT_COLORS.corSecundaria);
      setCorFonte(DEFAULT_COLORS.corFonte);
      setCorBackground(DEFAULT_COLORS.corBackground);
      setCorFonteCategorias(DEFAULT_COLORS.corFonteCategorias);
      setCorFonteTitulos(DEFAULT_COLORS.corFonteTitulos);
      setCorFonteSecundaria(DEFAULT_COLORS.corFonteSecundaria);
      setCorBarraBotoes(DEFAULT_COLORS.corBarraBotoes);
      setCorBotoes(DEFAULT_COLORS.corBotoes);
      setCorFonteBotoes(DEFAULT_COLORS.corFonteBotoes);
      setCorBackgroundHeader(DEFAULT_COLORS.corBackgroundHeader);

      // Save all default colors to database
      const resetPromises = [
        saveLayoutSetting('cor_primaria', DEFAULT_COLORS.corPrimaria),
        saveLayoutSetting('cor_secundaria', DEFAULT_COLORS.corSecundaria),
        saveLayoutSetting('cor_fonte', DEFAULT_COLORS.corFonte),
        saveLayoutSetting('cor_background', DEFAULT_COLORS.corBackground),
        saveLayoutSetting('cor_fonte_categorias', DEFAULT_COLORS.corFonteCategorias),
        saveLayoutSetting('cor_fonte_titulos', DEFAULT_COLORS.corFonteTitulos),
        saveLayoutSetting('cor_fonte_secundaria', DEFAULT_COLORS.corFonteSecundaria),
        saveLayoutSetting('cor_barra_botoes', DEFAULT_COLORS.corBarraBotoes),
        saveLayoutSetting('cor_botoes', DEFAULT_COLORS.corBotoes),
        saveLayoutSetting('cor_fonte_botoes', DEFAULT_COLORS.corFonteBotoes),
        saveLayoutSetting('cor_background_header', DEFAULT_COLORS.corBackgroundHeader),
      ];

      await Promise.all(resetPromises);
      toast({ title: 'Sucesso', description: 'Layout resetado para o padrão original!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível resetar o layout.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  type ColorField = { key: string; label: string; value: string; set: (v: string) => void };

  const colorGroups: { title: string; fields: ColorField[] }[] = [
    {
      title: 'Cores Principais',
      fields: [
        { key: 'cor_primaria', label: 'Cor Primária', value: corPrimaria, set: setCorPrimaria },
        { key: 'cor_secundaria', label: 'Cor Secundária', value: corSecundaria, set: setCorSecundaria },
        { key: 'cor_fonte', label: 'Cor da Fonte', value: corFonte, set: setCorFonte },
        { key: 'cor_background', label: 'Cor de Fundo', value: corBackground, set: setCorBackground },
      ],
    },
    {
      title: 'Menu de Categorias',
      fields: [
        { key: 'cor_fonte_categorias', label: 'Fonte do Menu', value: corFonteCategorias, set: setCorFonteCategorias },
        { key: 'cor_barra_menu_categorias', label: 'Fundo do Menu', value: corBarraMenuCategorias, set: setCorBarraMenuCategorias },
        { key: 'cor_fonte_menu_categorias', label: 'Fonte dos Itens', value: corFonteMenuCategorias, set: setCorFonteMenuCategorias },
        { key: 'cor_fundo_item_menu_categorias', label: 'Fundo do Nome', value: corFundoItemMenuCategorias, set: setCorFundoItemMenuCategorias },
        { key: 'cor_destaque_categoria_ativa', label: 'Destaque da Categoria Ativa', value: corDestaqueCategoriaAtiva, set: setCorDestaqueCategoriaAtiva },
        { key: 'cor_fonte_categoria_ativa', label: 'Fonte da Categoria Ativa', value: corFonteCategoriaAtiva, set: setCorFonteCategoriaAtiva },
      ],
    },
    {
      title: 'Seções',
      fields: [
        { key: 'cor_fonte_titulos', label: 'Cor dos Títulos das Seções', value: corFonteTitulos, set: setCorFonteTitulos },
        { key: 'cor_fonte_titulo_produto', label: 'Cor do Título do Produto', value: corFonteTituloProduto, set: setCorFonteTituloProduto },
        { key: 'cor_fonte_descricao_produto', label: 'Cor da Descrição do Produto', value: corFonteDescricaoProduto, set: setCorFonteDescricaoProduto },
        { key: 'cor_fonte_secundaria', label: 'Cor da Fonte Secundária', value: corFonteSecundaria, set: setCorFonteSecundaria },
      ],
    },
    {
      title: 'Botões',
      fields: [
        { key: 'cor_barra_botoes', label: 'Cor da Barra de Botões', value: corBarraBotoes, set: setCorBarraBotoes },
        { key: 'cor_botoes', label: 'Cor dos Botões', value: corBotoes, set: setCorBotoes },
        { key: 'cor_fonte_botoes', label: 'Cor da Fonte dos Botões', value: corFonteBotoes, set: setCorFonteBotoes },
      ],
    },
    {
      title: 'Cabeçalho',
      fields: [
        { key: 'cor_background_header', label: 'Fundo do Cabeçalho', value: corBackgroundHeader, set: setCorBackgroundHeader },
      ],
    },
    {
      title: 'Chat',
      fields: [
        { key: 'cor_chat_cabecalho', label: 'Cabeçalho do Chat', value: corChatCabecalho, set: setCorChatCabecalho },
        { key: 'cor_chat_fonte_cabecalho', label: 'Fonte do Cabeçalho do Chat', value: corChatFonteCabecalho, set: setCorChatFonteCabecalho },
        { key: 'cor_chat_fonte_baloes', label: 'Fonte dos Balões de Conversa', value: corChatFonteBaloes, set: setCorChatFonteBaloes },
        { key: 'cor_fonte_caixa_texto_chat', label: 'Caixa de texto do Chat', value: corFonteCaixaTextoChat, set: setCorFonteCaixaTextoChat },
      ],
    },
  ];


  const isDarkEdit = temaEdicao === 'escuro';
  const pv = (key: string, fallback: string) => (isDarkEdit ? (darkColors[key] ?? fallback) : fallback);
  const fieldValue = (f: { key: string; value: string }) =>
    isDarkEdit ? (darkColors[f.key] ?? f.value) : f.value;
  const setFieldValue = (f: { key: string; set: (v: string) => void }, v: string) => {
    if (isDarkEdit) {
      setDarkColors((prev) => ({ ...prev, [f.key]: v }));
    } else {
      f.set(v);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">Carregando...</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 pt-6">
        <AdminPageHeader title="Layout da Página" icon={PageIcon} iconBg="bg-purple-100" iconColor="text-purple-600" />
        <div className="flex justify-end gap-2 mb-4">
          <Button
            variant="outline"
            onClick={() => setShowResetDialog(true)}
            disabled={saving || isUploading}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Resetar Layout
          </Button>
          <Button onClick={handleSave} disabled={saving || isUploading}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        {/* Identidade */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Identidade da Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome da Empresa</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                placeholder="Texto que aparece abaixo do nome"
              />
            </div>

            {/* Logo */}
            <div>
              <Label>Logo</Label>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="w-24 h-24 rounded-full object-cover border mb-2"
                />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, setLogoUrl)}
                disabled={isUploading}
              />
              <Input
                className="mt-2"
                placeholder="Ou cole a URL da imagem"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>

          </CardContent>
        </Card>

        {/* Capa (Cover) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Capa (Página Inicial)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Banner 1 da Capa (600 x 400 ou proporcional)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={coverBanner1Url}
                  onChange={(e) => setCoverBanner1Url(e.target.value)}
                  placeholder="URL da imagem"
                />
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, setCoverBanner1Url)}
                  />
                  <Button type="button" variant="outline" size="icon" asChild disabled={isUploading}>
                    <span><Upload className="h-4 w-4" /></span>
                  </Button>
                </label>
              </div>
              {coverBanner1Url && (
                <div className="w-full max-w-[300px] aspect-[3/2] mt-2 rounded-lg overflow-hidden border">
                  <img src={coverBanner1Url} alt="Banner 1 da capa" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div>
              <Label>Banner 2 da Capa (600 x 200 ou proporcional)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={coverBanner2Url}
                  onChange={(e) => setCoverBanner2Url(e.target.value)}
                  placeholder="URL da imagem"
                />
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, setCoverBanner2Url)}
                  />
                  <Button type="button" variant="outline" size="icon" asChild disabled={isUploading}>
                    <span><Upload className="h-4 w-4" /></span>
                  </Button>
                </label>
              </div>
              {coverBanner2Url && (
                <div className="w-full max-w-[300px] aspect-[3/1] mt-2 rounded-lg overflow-hidden border">
                  <img src={coverBanner2Url} alt="Banner 2 da capa" className="w-full h-full object-cover" />
                </div>
              )}
              <BannerActionFields
                label="Ação ao clicar no Banner 2 da Capa"
                type={coverBanner2ActionType}
                value={coverBanner2ActionValue}
                target={coverBanner2ActionTarget}
                cupons={cupons}
                onTypeChange={(v) => {
                  setCoverBanner2ActionType(v);
                  setCoverBanner2ActionValue('');
                }}
                onValueChange={setCoverBanner2ActionValue}
                onTargetChange={setCoverBanner2ActionTarget}
              />
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Fundo da Capa</Label>
                <div className="inline-flex rounded-md bg-gray-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setTemaEdicao('claro')}
                    className={`text-xs px-3 py-1 rounded ${!isDarkEdit ? 'bg-white shadow font-semibold' : 'text-gray-600'}`}
                  >
                    Claro
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemaEdicao('escuro')}
                    className={`text-xs px-3 py-1 rounded ${isDarkEdit ? 'bg-white shadow font-semibold' : 'text-gray-600'}`}
                  >
                    Escuro
                  </button>
                </div>
              </div>
              {(() => {
                const tipo = isDarkEdit ? darkCoverBackgroundTipo : coverBackgroundTipo;
                const setTipo = isDarkEdit ? setDarkCoverBackgroundTipo : setCoverBackgroundTipo;
                const imagem = isDarkEdit ? darkCoverBackgroundImagemUrl : coverBackgroundImagemUrl;
                const setImagem = isDarkEdit ? setDarkCoverBackgroundImagemUrl : setCoverBackgroundImagemUrl;
                const cor = isDarkEdit
                  ? (darkColors['cor_background_cover'] ?? corBackgroundCover)
                  : corBackgroundCover;
                const setCor = (v: string) =>
                  isDarkEdit
                    ? setDarkColors((prev) => ({ ...prev, cor_background_cover: v }))
                    : setCorBackgroundCover(v);
                return (
                  <>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={tipo === 'cor' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTipo('cor')}
                      >
                        Cor
                      </Button>
                      <Button
                        type="button"
                        variant={tipo === 'imagem' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTipo('imagem')}
                      >
                        Imagem
                      </Button>
                    </div>

                    {tipo === 'cor' ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={cor}
                          onChange={(e) => setCor(e.target.value)}
                          className="w-16 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={cor}
                          onChange={(e) => setCor(e.target.value)}
                          placeholder="#f9fafb"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <Input
                            value={imagem}
                            onChange={(e) => setImagem(e.target.value)}
                            placeholder="URL da imagem de fundo"
                          />
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageUpload(e, setImagem)}
                            />
                            <Button type="button" variant="outline" size="icon" asChild disabled={isUploading}>
                              <span><Upload className="h-4 w-4" /></span>
                            </Button>
                          </label>
                        </div>
                        {imagem && (
                          <div className="w-full max-w-[300px] aspect-[3/2] mt-2 rounded-lg overflow-hidden border">
                            <img src={imagem} alt="Fundo da capa" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>


            <div className="border-t pt-4 space-y-3">
              <Label>Botões da Capa</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Cor de fundo dos botões</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="color"
                      value={coverBotaoCorFundo || corPrimaria}
                      onChange={(e) => setCoverBotaoCorFundo(e.target.value)}
                      className="w-16 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={coverBotaoCorFundo}
                      onChange={(e) => setCoverBotaoCorFundo(e.target.value)}
                      placeholder={corPrimaria}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Vazio = usa a cor primária.</p>
                </div>
                <div>
                  <Label className="text-xs">Cor do ícone e texto</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="color"
                      value={coverBotaoCorIcone}
                      onChange={(e) => setCoverBotaoCorIcone(e.target.value)}
                      className="w-16 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={coverBotaoCorIcone}
                      onChange={(e) => setCoverBotaoCorIcone(e.target.value)}
                      placeholder="#ffffff"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modo Escuro */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {modoEscuro ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />} Modo Escuro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Ativar modo escuro</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Quando ativo, a loja usa o conjunto de cores do modo escuro — configurado de forma independente na seção Cores abaixo.
                </p>
              </div>
              <Switch checked={modoEscuro} onCheckedChange={applyDarkMode} />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={aplicarPaletaEscuraSugerida}>
              <Moon className="h-4 w-4 mr-2" /> Preencher com paleta escura sugerida
            </Button>
          </CardContent>
        </Card>

        {/* Cores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" /> Cores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-1 rounded-lg bg-gray-100 w-fit">
              <button
                type="button"
                onClick={() => setTemaEdicao('claro')}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-md transition-colors ${temaEdicao === 'claro' ? 'bg-white shadow font-semibold' : 'text-gray-600'}`}
              >
                <Sun className="h-3.5 w-3.5" /> Modo Claro
              </button>
              <button
                type="button"
                onClick={() => setTemaEdicao('escuro')}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-md transition-colors ${temaEdicao === 'escuro' ? 'bg-white shadow font-semibold' : 'text-gray-600'}`}
              >
                <Moon className="h-3.5 w-3.5" /> Modo Escuro
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {isDarkEdit
                ? 'Você está editando as cores usadas quando o modo escuro está ativo. Elas são independentes das cores do modo claro.'
                : 'Você está editando as cores do modo claro (padrão da loja).'}
            </p>

            <div className="space-y-6">
              {colorGroups.map((group) => (
                <div key={group.title} className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 border-b pb-1">
                    {group.title}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {group.fields.map((f) => (
                      <div key={f.key}>
                        <Label>{f.label}</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="color"
                            value={fieldValue(f)}
                            onChange={(e) => setFieldValue(f, e.target.value)}
                            className="w-10 h-10 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={fieldValue(f)}
                            onChange={(e) => setFieldValue(f, e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>



            {/* Preview */}
            <div>
              <Label className="mb-2 block">Pré-visualização</Label>
              <div
                className="rounded-lg overflow-hidden border"
                style={{ backgroundColor: pv('cor_background', corBackground) }}
              >
                <div
                  className="h-16"
                  style={{
                    background: `linear-gradient(to left, ${corSecundaria}, ${corPrimaria})`,
                  }}
                />
                <div className="p-4 rounded mx-2 -mt-4 relative z-10 shadow" style={{ backgroundColor: pv('cor_background_header', corBackgroundHeader) }}>
                  <span className="font-bold text-lg" style={{ color: pv('cor_fonte', corFonte) }}>{nome}</span>
                  <p className="text-sm mt-1" style={{ color: pv('cor_fonte', corFonte) }}>{descricao}</p>
                  <span className="text-xs mt-1 block" style={{ color: pv('cor_fonte', corFonte) }}>⭐ 4.8 (120+)</span>
                </div>
                <div className="p-4">
                  <div className="flex gap-3 mt-2 px-2 py-1 rounded" style={{ backgroundColor: pv('cor_barra_botoes', corBarraBotoes) }}>
                    <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: pv('cor_botoes', corBotoes), color: pv('cor_fonte_botoes', corFonteBotoes) }}>Meus Pedidos</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: pv('cor_botoes', corBotoes), color: pv('cor_fonte_botoes', corFonteBotoes) }}>Sair</span>
                  </div>
                  <div className="mt-2 px-2 py-1 rounded flex gap-2" style={{ backgroundColor: pv('cor_barra_menu_categorias', corBarraMenuCategorias) }}>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: pv('cor_fundo_item_menu_categorias', corFundoItemMenuCategorias), color: pv('cor_fonte_menu_categorias', corFonteMenuCategorias) }}>Categoria</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: pv('cor_destaque_categoria_ativa', corDestaqueCategoriaAtiva), color: pv('cor_fonte_categoria_ativa', corFonteCategoriaAtiva) }}>Ativa</span>
                  </div>
                  <span className="text-base font-semibold mt-1 block" style={{ color: pv('cor_fonte_titulos', corFonteTitulos) }}>Título da Seção</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Layout Mobile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" /> Layout Mobile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Colunas de Produtos no Mobile</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="colunas_mobile"
                    value="1"
                    checked={layoutColunasMobile === '1'}
                    onChange={() => setLayoutColunasMobile('1')}
                    className="accent-orange-500"
                  />
                  <span className="text-sm">1 Coluna</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="colunas_mobile"
                    value="2"
                    checked={layoutColunasMobile === '2'}
                    onChange={() => setLayoutColunasMobile('2')}
                    className="accent-orange-500"
                  />
                  <span className="text-sm">2 Colunas</span>
                </label>
              </div>
            </div>
            {/* Preview */}
            <div>
              <Label className="mb-2 block">Pré-visualização</Label>
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className={`grid gap-3 ${layoutColunasMobile === '2' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white rounded-lg shadow-sm p-2">
                      <div className="bg-gray-200 rounded h-16 mb-2" />
                      <div className="h-2 bg-gray-300 rounded w-3/4 mb-1" />
                      <div className="h-2 bg-gray-200 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cores por Categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" /> Cores por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingCategories ? (
              <p className="text-sm text-gray-500">Carregando categorias...</p>
            ) : categories.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma categoria cadastrada.</p>
            ) : (
              categories.map((cat) => {
                const cc = categoryColors[cat.id] || { bgColor: '#ffffff', fontColor: '#1f2937' };
                return (
                  <div key={cat.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{cat.name}</span>
                      <span
                        className="text-xs px-3 py-1 rounded-full font-medium"
                        style={{ backgroundColor: cc.bgColor, color: cc.fontColor }}
                      >
                        {cat.name}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs">Cor de Fundo</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="color"
                            value={cc.bgColor}
                            onChange={(e) => handleCategoryColorChange(cat.id, 'bgColor', e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={cc.bgColor}
                            onChange={(e) => handleCategoryColorChange(cat.id, 'bgColor', e.target.value)}
                            className="flex-1 text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Cor da Fonte</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="color"
                            value={cc.fontColor}
                            onChange={(e) => handleCategoryColorChange(cat.id, 'fontColor', e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={cc.fontColor}
                            onChange={(e) => handleCategoryColorChange(cat.id, 'fontColor', e.target.value)}
                            className="flex-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar Layout</AlertDialogTitle>
            <AlertDialogDescription>
              O layout será revertido ao formato original. Confirma ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowResetDialog(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Layout;
