import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Phone, LogOut, LogIn, MapPin, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";
import { supabase } from "@/integrations/supabase/client";
import { fetchAddressByCep } from "@/services/cepService";
import { phoneDigitsBr } from "@/utils/phoneUtils";
import { toast } from "@/hooks/use-toast";

type AccountData = {
  name: string | null;
  email: string | null;
  phone: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
};

const MinhaConta: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, logOut } = useAuth();
  const { settings } = useLayoutSettings();
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
  });
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setAccountData(null);
      return;
    }

    let active = true;
    setAccountLoading(true);

    supabase
      .from("users")
      .select("name, email, phone, cep, rua, numero, complemento, bairro, cidade")
      .eq("id", currentUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setAccountData(data);
          setAccountLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentUser]);

  const handleLogout = async () => {
    await logOut();
    navigate("/");
  };

  const openEdit = () => {
    if (!currentUser) return;
    setEditForm({
      name: accountData?.name || currentUser.displayName || "",
      email: accountData?.email || currentUser.email || "",
      phone: accountData?.phone || "",
      cep: accountData?.cep || "",
      rua: accountData?.rua || "",
      numero: accountData?.numero || "",
      complemento: accountData?.complemento || "",
      bairro: accountData?.bairro || "",
      cidade: accountData?.cidade || "",
    });
    setEditOpen(true);
  };

  const handleCepChange = async (value: string) => {
    const masked = value.replace(/\D/g, "").slice(0, 8);
    setEditForm((f) => ({ ...f, cep: masked }));
    if (masked.length === 8) {
      setCepLoading(true);
      try {
        const info = await fetchAddressByCep(masked);
        if (info) {
          setEditForm((f) => ({
            ...f,
            rua: info.street || f.rua,
            bairro: info.neighborhood || f.bairro,
            cidade: info.city || f.cidade,
          }));
        }
      } catch (e: any) {
        toast({ title: "CEP não encontrado", description: e.message, variant: "destructive" });
      } finally {
        setCepLoading(false);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!currentUser) return;
    if (!editForm.numero.trim()) {
      toast({ title: "Número é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const emailKey = (currentUser.email || editForm.email || "").toLowerCase();
      if (!emailKey) {
        toast({ title: "Email não encontrado", variant: "destructive" });
        setSaving(false);
        return;
      }
      const { error } = await supabase
        .from("users")
        .update({
          name: editForm.name || null,
          phone: phoneDigitsBr(editForm.phone) || null,
          cep: editForm.cep || null,
          rua: editForm.rua || null,
          numero: editForm.numero || null,
          complemento: editForm.complemento || null,
          bairro: editForm.bairro || null,
          cidade: editForm.cidade || null,
          firebase_id: currentUser.id,
        })
        .or(`id.eq.${currentUser.id},firebase_id.eq.${currentUser.id},email.ilike.${emailKey}`);
      if (error) throw error;

      // Também atualiza profiles (usado em outras telas)
      await supabase
        .from("profiles")
        .update({
          name: editForm.name || null,
          phone: phoneDigitsBr(editForm.phone) || null,
        })
        .eq("id", currentUser.id);

      setAccountData((prev) => ({
        ...(prev ?? {
          email: currentUser.email ?? null,
        }),
        name: editForm.name || null,
        email: prev?.email ?? currentUser.email ?? null,
        phone: phoneDigitsBr(editForm.phone) || null,
        cep: editForm.cep || null,
        rua: editForm.rua || null,
        numero: editForm.numero || null,
        complemento: editForm.complemento || null,
        bairro: editForm.bairro || null,
        cidade: editForm.cidade || null,
      }));

      toast({ title: "Dados atualizados com sucesso!" });
      setEditOpen(false);
    } catch (e: any) {
      toast({
        title: "Erro ao atualizar dados",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addressLine = [accountData?.rua, accountData?.numero]
    .filter(Boolean)
    .join(", ");
  const locationLine = [accountData?.bairro, accountData?.cidade]
    .filter(Boolean)
    .join(" · ");
  const hasAddress = Boolean(addressLine || locationLine || accountData?.cep || accountData?.complemento);

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: settings.cor_background }}>
      <div
        className="sticky top-0 z-10 border-b"
        style={{ backgroundColor: settings.cor_background_header }}
      >
        <div className="container mx-auto px-4 py-3 flex items-center gap-3 max-w-[600px]">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" style={{ color: settings.cor_fonte }} />
          </Button>
          <h1 className="text-lg font-bold" style={{ color: settings.cor_fonte }}>
            Minha Conta
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-[600px]">
        {currentUser ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Dados da conta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{accountData?.name || currentUser.displayName || "Nome não informado"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{accountData?.email || currentUser.email || "E-mail não informado"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{accountData?.phone || currentUser.phoneNumber || "Telefone não informado"}</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
                {accountLoading ? (
                  <span className="text-muted-foreground">Carregando endereço...</span>
                ) : hasAddress ? (
                  <div className="min-w-0">
                    {addressLine && <div>{addressLine}</div>}
                    {accountData?.complemento && <div>{accountData.complemento}</div>}
                    {locationLine && <div>{locationLine}</div>}
                    {accountData?.cep && <div>CEP {accountData.cep}</div>}
                  </div>
                ) : (
                  <span>Endereço não informado</span>
                )}
              </div>
              <Button variant="outline" className="w-full mt-4" onClick={openEdit}>
                <UserCog className="h-4 w-4 mr-2" /> Editar dados
              </Button>
              <Button variant="outline" className="w-full" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" /> Sair da conta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center space-y-4">
              <p className="text-muted-foreground">
                Você não está logado. Entre para ver seus dados.
              </p>
              <Button onClick={() => navigate("/login")}>
                <LogIn className="h-4 w-4 mr-2" /> Entrar
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md max-h-[85dvh] overflow-y-auto dialog-scroll-content">
          <DialogHeader>
            <DialogTitle>Editar dados</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="conta-edit-name">Nome</Label>
              <Input
                id="conta-edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={100}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="conta-edit-cep">CEP</Label>
              <Input
                id="conta-edit-cep"
                value={editForm.cep}
                onChange={(e) => handleCepChange(e.target.value)}
                maxLength={8}
                placeholder="Somente números"
                disabled={cepLoading}
              />
              {cepLoading && <p className="text-xs text-muted-foreground">Buscando CEP...</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="conta-edit-rua">Rua</Label>
              <Input
                id="conta-edit-rua"
                value={editForm.rua}
                onChange={(e) => setEditForm((f) => ({ ...f, rua: e.target.value }))}
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="conta-edit-numero">Número *</Label>
                <Input
                  id="conta-edit-numero"
                  value={editForm.numero}
                  onChange={(e) => setEditForm((f) => ({ ...f, numero: e.target.value }))}
                  maxLength={20}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="conta-edit-complemento">Complemento</Label>
                <Input
                  id="conta-edit-complemento"
                  value={editForm.complemento}
                  onChange={(e) => setEditForm((f) => ({ ...f, complemento: e.target.value }))}
                  maxLength={100}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="conta-edit-bairro">Bairro</Label>
                <Input
                  id="conta-edit-bairro"
                  value={editForm.bairro}
                  onChange={(e) => setEditForm((f) => ({ ...f, bairro: e.target.value }))}
                  maxLength={100}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="conta-edit-cidade">Cidade</Label>
                <Input
                  id="conta-edit-cidade"
                  value={editForm.cidade}
                  onChange={(e) => setEditForm((f) => ({ ...f, cidade: e.target.value }))}
                  maxLength={100}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="conta-edit-email">Email</Label>
              <Input
                id="conta-edit-email"
                type="email"
                value={editForm.email}
                readOnly
                disabled
                className="bg-muted cursor-not-allowed"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="conta-edit-phone">WhatsApp</Label>
              <Input
                id="conta-edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                maxLength={20}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 -mx-6 px-6 py-3 bg-card border-t mt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleSaveEdit}
              disabled={saving}
            >
              {saving ? "Atualizando..." : "Atualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MinhaConta;
