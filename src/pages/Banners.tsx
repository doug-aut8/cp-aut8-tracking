import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Image as PageIcon } from "lucide-react";
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Image as ImageIcon, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLayoutSettings, saveLayoutSetting } from '@/hooks/useLayoutSettings';
import { useImageUpload } from '@/hooks/useImageUpload';
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

const Banners = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings, loading } = useLayoutSettings();
  const { uploadImage, isUploading } = useImageUpload();

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
  const [cupomAplicadoMensagem, setCupomAplicadoMensagem] = useState('O cupom {cupom} foi aplicado automaticamente ao seu pedido.');
  const [popupAtivo, setPopupAtivo] = useState(false);
  const [popupImagemUrl, setPopupImagemUrl] = useState('');
  const [popupTextoFechar, setPopupTextoFechar] = useState('Não Quero');
  const [popupTextoAplicar, setPopupTextoAplicar] = useState('QUERO');
  const [popupActionType, setPopupActionType] = useState('none');
  const [popupActionValue, setPopupActionValue] = useState('');
  const [popupActionTarget, setPopupActionTarget] = useState('new_page');
  const [cupons, setCupons] = useState<CuponOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setBannerUrl(settings.empresa_banner_url);
      setBannerMobileUrl(settings.empresa_banner_mobile_url);
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
      setPopupAtivo((settings as any).popup_ativo === 'true');
      setPopupImagemUrl((settings as any).popup_imagem_url || '');
      setPopupTextoFechar((settings as any).popup_texto_fechar || 'Não Quero');
      setPopupTextoAplicar((settings as any).popup_texto_aplicar || 'QUERO');
      setPopupActionType((settings as any).popup_action_type || 'none');
      setPopupActionValue((settings as any).popup_action_value || '');
      setPopupActionTarget((settings as any).popup_action_target || 'new_page');
      setCupomAplicadoMensagem((settings as any).cupom_aplicado_mensagem || 'O cupom {cupom} foi aplicado automaticamente ao seu pedido.');
    }
  }, [loading, settings]);

  useEffect(() => {
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
    loadCupons();
  }, []);

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
      await Promise.all([
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
        saveLayoutSetting('cupom_aplicado_mensagem', cupomAplicadoMensagem),
        saveLayoutSetting('popup_ativo', popupAtivo ? 'true' : 'false'),
        saveLayoutSetting('popup_imagem_url', popupImagemUrl),
        saveLayoutSetting('popup_texto_fechar', popupTextoFechar),
        saveLayoutSetting('popup_texto_aplicar', popupTextoAplicar),
        saveLayoutSetting('popup_action_type', popupActionType),
        saveLayoutSetting('popup_action_value', popupActionValue),
        saveLayoutSetting('popup_action_target', popupActionTarget),
      ]);
      toast({ title: 'Sucesso', description: 'Configurações de banners salvas!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível salvar.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 pt-6">
        <AdminPageHeader title="Banners" icon={PageIcon} iconBg="bg-pink-100" iconColor="text-pink-600" />
        <div className="flex justify-end mb-4">
          <Button onClick={handleSave} disabled={saving || isUploading}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" /> Banners
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Banner Desktop */}
            <div>
              <Label>Banner (Desktop)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Tamanho recomendado: 1000px x 250px (proporção 4:1).
              </p>
              {bannerUrl && (
                <img
                  src={bannerUrl}
                  alt="Banner preview"
                  className="w-full aspect-[4/1] object-cover rounded border mb-2"
                />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, setBannerUrl)}
                disabled={isUploading}
              />
              <Input
                className="mt-2"
                placeholder="Ou cole a URL da imagem"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
              />
            </div>

            {/* Banner Mobile */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="usarMesmaImagem"
                  checked={usarMesmaImagemMobile}
                  onChange={(e) => setUsarMesmaImagemMobile(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                />
                <Label htmlFor="usarMesmaImagem" className="cursor-pointer text-sm">
                  Usar a mesma imagem para mobile
                </Label>
              </div>
              {!usarMesmaImagemMobile && (
                <div className="space-y-2">
                  <Label>Banner (Mobile)</Label>
                  {bannerMobileUrl && (
                    <img
                      src={bannerMobileUrl}
                      alt="Banner mobile preview"
                      className="w-48 h-32 object-cover rounded border mb-2"
                    />
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, setBannerMobileUrl)}
                    disabled={isUploading}
                  />
                  <Input
                    placeholder="Ou cole a URL da imagem"
                    value={bannerMobileUrl}
                    onChange={(e) => setBannerMobileUrl(e.target.value)}
                  />
                </div>
              )}
            </div>

            <BannerActionFields
              label="Ação ao clicar no Banner Principal"
              type={bannerPrincipalActionType}
              value={bannerPrincipalActionValue}
              target={bannerPrincipalActionTarget}
              cupons={cupons}
              onTypeChange={setBannerPrincipalActionType}
              onValueChange={setBannerPrincipalActionValue}
              onTargetChange={setBannerPrincipalActionTarget}
            />

            <div className="mt-2 p-3 rounded border bg-muted/30 space-y-3">
              <Label className="text-xs font-semibold">Exibição dos banners extras</Label>
              <div className="space-y-1">
                <Label className="text-xs">Quantidade de banners</Label>
                <Select value={bannerExtraQuantidade} onValueChange={setBannerExtraQuantidade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Quantidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 banner</SelectItem>
                    <SelectItem value="2">2 banners</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {bannerExtraQuantidade === '1' && (
                <div className="space-y-1">
                  <Label className="text-xs">Tamanho do banner</Label>
                  <Select value={bannerExtraTamanho} onValueChange={setBannerExtraTamanho}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tamanho" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal (centralizado)</SelectItem>
                      <SelectItem value="longo">Longo (largura total)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    "Normal" exibe o banner centralizado com a largura de um banner. "Longo" ocupa a largura dos dois banners somada ao espaçamento.
                  </p>
                </div>
              )}
            </div>

            {[
              {
                label: 'Banner Extra 1 (2:1)',
                url: bannerExtra1Url,
                setter: setBannerExtra1Url,
                actionType: bannerExtra1ActionType,
                setActionType: setBannerExtra1ActionType,
                actionValue: bannerExtra1ActionValue,
                setActionValue: setBannerExtra1ActionValue,
                actionTarget: bannerExtra1ActionTarget,
                setActionTarget: setBannerExtra1ActionTarget,
              },
              {
                label: 'Banner Extra 2 (2:1)',
                url: bannerExtra2Url,
                setter: setBannerExtra2Url,
                actionType: bannerExtra2ActionType,
                setActionType: setBannerExtra2ActionType,
                actionValue: bannerExtra2ActionValue,
                setActionValue: setBannerExtra2ActionValue,
                actionTarget: bannerExtra2ActionTarget,
                setActionTarget: setBannerExtra2ActionTarget,
              },
            ]
              .filter((_, i) => bannerExtraQuantidade === '2' || i === 0)
              .map((b) => (
                <div key={b.label} className="space-y-2">
                  <Label>{b.label}</Label>
                  {b.url && (
                    <img
                      src={b.url}
                      alt={`${b.label} preview`}
                      className="w-full object-cover rounded border mb-2"
                      style={{ aspectRatio: '2 / 1' }}
                    />
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, b.setter)}
                    disabled={isUploading}
                  />
                  <Input
                    className="mt-2"
                    placeholder="Ou cole a URL da imagem"
                    value={b.url}
                    onChange={(e) => b.setter(e.target.value)}
                  />
                  <BannerActionFields
                    label={`Ação ao clicar no ${b.label.replace(' (2:1)', '')}`}
                    type={b.actionType}
                    value={b.actionValue}
                    target={b.actionTarget}
                    cupons={cupons}
                    onTypeChange={b.setActionType}
                    onValueChange={b.setActionValue}
                    onTargetChange={b.setActionTarget}
                  />
                </div>
              ))}

            <div className="mt-2 p-3 rounded border bg-muted/30 space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-2">
                <Tag className="h-4 w-4" /> Mensagem de cupom aplicado (via banner)
              </Label>
              <Textarea
                placeholder="O cupom {cupom} foi aplicado automaticamente ao seu pedido."
                value={cupomAplicadoMensagem}
                onChange={(e) => setCupomAplicadoMensagem(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="px-1 rounded bg-muted">{'{cupom}'}</code> para inserir o nome do cupom automaticamente.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" /> Popup de entrada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="popupAtivo"
                checked={popupAtivo}
                onChange={(e) => setPopupAtivo(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer"
              />
              <Label htmlFor="popupAtivo" className="cursor-pointer text-sm">
                {popupAtivo ? 'Ativo' : 'Desativado'}
              </Label>
            </div>

            <div>
              <Label>Imagem do popup (quadrada, ex: 800x800)</Label>
              {popupImagemUrl && (
                <img
                  src={popupImagemUrl}
                  alt="Popup preview"
                  className="w-48 aspect-square object-cover rounded border my-2"
                />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, setPopupImagemUrl)}
                disabled={isUploading}
              />
              <Input
                className="mt-2"
                placeholder="Ou cole a URL da imagem"
                value={popupImagemUrl}
                onChange={(e) => setPopupImagemUrl(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Texto do botão fechar</Label>
                <Input value={popupTextoFechar} onChange={(e) => setPopupTextoFechar(e.target.value)} placeholder="Não Quero" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Texto do botão aplicar</Label>
                <Input value={popupTextoAplicar} onChange={(e) => setPopupTextoAplicar(e.target.value)} placeholder="QUERO" />
              </div>
            </div>

            <BannerActionFields
              label="Ação do botão aplicar"
              type={popupActionType}
              value={popupActionValue}
              target={popupActionTarget}
              cupons={cupons}
              onTypeChange={setPopupActionType}
              onValueChange={setPopupActionValue}
              onTargetChange={setPopupActionTarget}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Banners;
