import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Truck as PageIcon } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FreteItem {
  id?: string;
  km_inicial: string;
  km_final: string;
  valor: string;
}

interface CepEspecialItem {
  id?: number;
  cep: string;
  valor: string;
}

const SUPERFRETE_SERVICES = [
  { id: 1, name: "PAC" },
  { id: 2, name: "SEDEX" },
  { id: 17, name: "Mini Envios" },
];

const Logistica = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingCeps, setLoadingCeps] = useState(false);
  const [savingSuperfrete, setSavingSuperfrete] = useState(false);
  const [modeloFrete, setModeloFrete] = useState<"km_direto" | "cep_distancia" | "superfrete">("km_direto");
  const [freteItems, setFreteItems] = useState<FreteItem[]>([
    { km_inicial: "", km_final: "", valor: "" },
  ]);
  const [cepsEspeciais, setCepsEspeciais] = useState<CepEspecialItem[]>([]);
  const [newCep, setNewCep] = useState({ cep: "", valor: "" });

  // Superfrete
  const [sfToken, setSfToken] = useState("");
  const [sfSandbox, setSfSandbox] = useState(true);
  const [sfServicos, setSfServicos] = useState<number[]>([17]);
  const [defPeso, setDefPeso] = useState("");
  const [defAltura, setDefAltura] = useState("");
  const [defLargura, setDefLargura] = useState("");
  const [defComprimento, setDefComprimento] = useState("");

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    loadFreteData();
    loadCepsEspeciais();
    loadSuperfreteConfig();
  }, [currentUser]);

  const loadSuperfreteConfig = async () => {
    const { data } = await supabase
      .from("empresa_info")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (!data) return;
    const d = data as any;
    setSfToken(d.superfrete_token || "");
    setSfSandbox(d.superfrete_sandbox ?? true);
    setSfServicos(Array.isArray(d.superfrete_servicos) ? d.superfrete_servicos : []);
    setDefPeso(d.default_peso_g?.toString() || "");
    setDefAltura(d.default_altura_cm?.toString() || "");
    setDefLargura(d.default_largura_cm?.toString() || "");
    setDefComprimento(d.default_comprimento_cm?.toString() || "");
  };

  const handleSaveSuperfrete = async () => {
    setSavingSuperfrete(true);
    try {
      const { data: empresaData } = await supabase
        .from("empresa_info")
        .select("user_id")
        .limit(1)
        .maybeSingle();
      if (!empresaData?.user_id) {
        toast.error("Configure 'Minha Empresa' primeiro.");
        return;
      }
      const { error } = await supabase
        .from("empresa_info")
        .update({
          superfrete_token: sfToken || null,
          superfrete_sandbox: sfSandbox,
          superfrete_servicos: sfServicos as any,
          default_peso_g: defPeso ? parseFloat(defPeso) : null,
          default_altura_cm: defAltura ? parseFloat(defAltura) : null,
          default_largura_cm: defLargura ? parseFloat(defLargura) : null,
          default_comprimento_cm: defComprimento ? parseFloat(defComprimento) : null,
        } as any)
        .eq("user_id", empresaData.user_id);
      if (error) throw error;
      toast.success("Configurações Superfrete salvas!");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar Superfrete");
    } finally {
      setSavingSuperfrete(false);
    }
  };

  const toggleSfServico = (id: number) => {
    setSfServicos((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };


  const loadCepsEspeciais = async () => {
    try {
      const { data, error } = await supabase
        .from("ceps_especiais")
        .select("*")
        .order("cep", { ascending: true });

      if (error) {
        console.error("Erro ao carregar CEPs especiais:", error);
        return;
      }

      if (data) {
        const items: CepEspecialItem[] = data.map((item) => ({
          id: item.id,
          cep: item.cep || "",
          valor: item.valor?.toString() || "",
        }));
        setCepsEspeciais(items);
      }
    } catch (error) {
      console.error("Erro ao carregar CEPs especiais:", error);
    }
  };

  const handleAddCepEspecial = async () => {
    if (!newCep.cep || !newCep.valor) {
      toast.error("Preencha o CEP e o valor");
      return;
    }

    setLoadingCeps(true);
    try {
      const { error } = await supabase
        .from("ceps_especiais")
        .insert({
          cep: newCep.cep,
          valor: parseFloat(newCep.valor),
        } as any);

      if (error) throw error;

      toast.success("CEP especial adicionado!");
      setNewCep({ cep: "", valor: "" });
      loadCepsEspeciais();
    } catch (error: any) {
      console.error("Erro ao adicionar CEP especial:", error);
      toast.error("Erro ao adicionar CEP especial");
    } finally {
      setLoadingCeps(false);
    }
  };

  const handleRemoveCepEspecial = async (id: number) => {
    setLoadingCeps(true);
    try {
      const { error } = await supabase
        .from("ceps_especiais")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("CEP especial removido!");
      loadCepsEspeciais();
    } catch (error: any) {
      console.error("Erro ao remover CEP especial:", error);
      toast.error("Erro ao remover CEP especial");
    } finally {
      setLoadingCeps(false);
    }
  };

  const loadFreteData = async () => {
    if (!currentUser?.uid) return;
    
    try {
      // Buscar user_id da empresa_info (fonte única de verdade)
      const { data: empresaData } = await supabase
        .from("empresa_info")
        .select("user_id, modelo_frete")
        .limit(1)
        .maybeSingle();

      if (!empresaData?.user_id) {
        console.log("Empresa não encontrada");
        return;
      }

      setModeloFrete((empresaData.modelo_frete as "km_direto" | "cep_distancia" | "superfrete") || "km_direto");

      // Buscar faixas de frete
      const { data, error } = await supabase
        .from("faixas_frete")
        .select("*")
        .eq("user_id", empresaData.user_id)
        .order("km_inicial", { ascending: true });

      if (error) {
        console.error("Erro ao carregar dados de frete:", error);
        return;
      }

      if (data && data.length > 0) {
        const items: FreteItem[] = data.map((item) => ({
          id: item.id,
          km_inicial: item.km_inicial?.toString() || "",
          km_final: item.km_final?.toString() || "",
          valor: item.valor?.toString() || "",
        }));
        setFreteItems(items);
      }
    } catch (error) {
      console.error("Erro ao carregar frete:", error);
    }
  };

  const handleAddItem = () => {
    setFreteItems([...freteItems, { km_inicial: "", km_final: "", valor: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    if (freteItems.length > 1) {
      const newItems = freteItems.filter((_, i) => i !== index);
      setFreteItems(newItems);
    }
  };

  const handleItemChange = (
    index: number,
    field: "km_inicial" | "km_final" | "valor",
    value: string
  ) => {
    const newItems = [...freteItems];
    newItems[index][field] = value;
    setFreteItems(newItems);
  };

  const handleSave = async () => {
    if (!currentUser?.uid) return;

    // Validar que pelo menos um item tem dados
    const validItems = freteItems.filter(
      (item) => item.km_inicial && item.km_final && item.valor
    );
    
    if (validItems.length === 0) {
      toast.error("Adicione pelo menos uma faixa de kilometragem");
      return;
    }

    // Validar que km_inicial < km_final
    const invalidItems = validItems.filter(
      (item) => parseFloat(item.km_inicial) >= parseFloat(item.km_final)
    );
    
    if (invalidItems.length > 0) {
      toast.error("O Km inicial deve ser menor que o Km final em todas as faixas");
      return;
    }

    setLoading(true);
    try {
      // Buscar user_id da empresa_info (fonte única de verdade)
      const { data: empresaSaveData } = await supabase
        .from("empresa_info")
        .select("user_id")
        .limit(1)
        .maybeSingle();

      if (!empresaSaveData?.user_id) {
        toast.error("Empresa não configurada. Configure primeiro em 'Minha Empresa'.");
        setLoading(false);
        return;
      }

      const targetUserId = empresaSaveData.user_id;

      // Deletar faixas antigas
      const { error: deleteError } = await supabase
        .from("faixas_frete")
        .delete()
        .eq("user_id", targetUserId);

      if (deleteError) throw deleteError;

      // Inserir novas faixas
      const insertData = validItems.map((item) => ({
        user_id: targetUserId,
        km_inicial: parseFloat(item.km_inicial),
        km_final: parseFloat(item.km_final),
        valor: parseFloat(item.valor),
      }));

      const { error: insertError } = await supabase
        .from("faixas_frete")
        .insert(insertData);

      if (insertError) throw insertError;

      // Salvar modelo de frete
      const { error: modeloError } = await supabase
        .from("empresa_info")
        .update({ modelo_frete: modeloFrete })
        .eq("user_id", targetUserId);

      if (modeloError) {
        console.error("Erro ao salvar modelo de frete:", modeloError);
      }

      toast.success("Configurações de frete salvas com sucesso!");
      loadFreteData();
    } catch (error: any) {
      console.error("Erro ao salvar frete:", error);
      toast.error("Erro ao salvar configurações de frete");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <AdminPageHeader title="Logística" icon={PageIcon} iconBg="bg-red-100" iconColor="text-red-600" />

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Configuração de Frete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-base font-semibold mb-3 block">Modelo de Cobrança</Label>
              <RadioGroup value={modeloFrete} onValueChange={(value) => setModeloFrete(value as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="km_direto" id="km_direto" />
                  <Label htmlFor="km_direto" className="font-normal cursor-pointer">
                    Quilometragem Direta - Cobrança baseada na distância informada pelo cliente
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cep_distancia" id="cep_distancia" />
                  <Label htmlFor="cep_distancia" className="font-normal cursor-pointer">
                    Distância por CEP - Calcula automaticamente a distância entre a loja e o endereço do cliente
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="superfrete" id="superfrete" />
                  <Label htmlFor="superfrete" className="font-normal cursor-pointer">
                    Superfrete - Calcula via API do Superfrete (PAC, SEDEX, Mini Envios)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="text-sm text-muted-foreground">
              Configure as faixas de frete por quilometragem. Por exemplo: de 1km a 3km por
              R$ 5,00.
            </div>

            {freteItems.map((item, index) => (
              <div key={index} className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label htmlFor={`km-inicial-${index}`}>Km Inicial</Label>
                  <Input
                    id={`km-inicial-${index}`}
                    type="number"
                    value={item.km_inicial}
                    onChange={(e) => handleItemChange(index, "km_inicial", e.target.value)}
                    placeholder="Ex: 1"
                  />
                </div>

                <div className="flex-1">
                  <Label htmlFor={`km-final-${index}`}>Km Final</Label>
                  <Input
                    id={`km-final-${index}`}
                    type="number"
                    value={item.km_final}
                    onChange={(e) => handleItemChange(index, "km_final", e.target.value)}
                    placeholder="Ex: 3"
                  />
                </div>

                <div className="flex-1">
                  <Label htmlFor={`valor-${index}`}>Valor (R$)</Label>
                  <Input
                    id={`valor-${index}`}
                    type="number"
                    step="0.01"
                    value={item.valor}
                    onChange={(e) => handleItemChange(index, "valor", e.target.value)}
                    placeholder="Ex: 5.00"
                  />
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveItem(index)}
                  disabled={freteItems.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              onClick={handleAddItem}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Nova Faixa
            </Button>

            <Button onClick={handleSave} disabled={loading} className="w-full">
              {loading ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Superfrete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-sm text-muted-foreground">
              Configure suas credenciais e os serviços que serão oferecidos ao cliente no checkout quando o modelo de cobrança "Superfrete" estiver ativo.
            </div>

            <div>
              <Label htmlFor="sf-token">Token da API Superfrete</Label>
              <Input
                id="sf-token"
                type="password"
                value={sfToken}
                onChange={(e) => setSfToken(e.target.value)}
                placeholder="Cole aqui seu token (Bearer)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Obtenha em: painel.superfrete.com → Configurações → Tokens
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="font-medium">Ambiente Sandbox</Label>
                <p className="text-xs text-muted-foreground">
                  Ativado = usa sandbox.superfrete.com (testes). Desativado = produção.
                </p>
              </div>
              <Switch checked={sfSandbox} onCheckedChange={setSfSandbox} />
            </div>

            <div>
              <Label className="text-base font-semibold mb-3 block">Serviços oferecidos ao cliente</Label>
              <div className="space-y-2">
                {SUPERFRETE_SERVICES.map((s) => (
                  <div key={s.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`sf-svc-${s.id}`}
                      checked={sfServicos.includes(s.id)}
                      onCheckedChange={() => toggleSfServico(s.id)}
                    />
                    <Label htmlFor={`sf-svc-${s.id}`} className="font-normal cursor-pointer">
                      {s.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-semibold mb-3 block">
                Dimensões padrão (fallback)
              </Label>
              <p className="text-xs text-muted-foreground mb-3">
                Usadas quando um produto não tem peso/dimensões cadastrados em "Itens do Cardápio".
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="def-peso">Peso (g)</Label>
                  <Input
                    id="def-peso"
                    type="number"
                    step="0.01"
                    value={defPeso}
                    onChange={(e) => setDefPeso(e.target.value)}
                    placeholder="Ex: 300"
                  />
                </div>
                <div>
                  <Label htmlFor="def-altura">Altura (cm)</Label>
                  <Input
                    id="def-altura"
                    type="number"
                    step="0.01"
                    value={defAltura}
                    onChange={(e) => setDefAltura(e.target.value)}
                    placeholder="Ex: 2"
                  />
                </div>
                <div>
                  <Label htmlFor="def-largura">Largura (cm)</Label>
                  <Input
                    id="def-largura"
                    type="number"
                    step="0.01"
                    value={defLargura}
                    onChange={(e) => setDefLargura(e.target.value)}
                    placeholder="Ex: 11"
                  />
                </div>
                <div>
                  <Label htmlFor="def-comprimento">Comprimento (cm)</Label>
                  <Input
                    id="def-comprimento"
                    type="number"
                    step="0.01"
                    value={defComprimento}
                    onChange={(e) => setDefComprimento(e.target.value)}
                    placeholder="Ex: 16"
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSaveSuperfrete} disabled={savingSuperfrete} className="w-full">
              {savingSuperfrete ? "Salvando..." : "Salvar Configurações Superfrete"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CEPs Especiais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-sm text-muted-foreground">
              Configure valores de frete específicos para determinados CEPs.
            </div>

            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="new-cep">CEP</Label>
                <Input
                  id="new-cep"
                  type="text"
                  value={newCep.cep}
                  onChange={(e) => setNewCep({ ...newCep, cep: e.target.value })}
                  placeholder="Ex: 01310-100"
                />
              </div>

              <div className="flex-1">
                <Label htmlFor="new-valor">Valor (R$)</Label>
                <Input
                  id="new-valor"
                  type="number"
                  step="0.01"
                  value={newCep.valor}
                  onChange={(e) => setNewCep({ ...newCep, valor: e.target.value })}
                  placeholder="Ex: 10.00"
                />
              </div>

              <Button
                onClick={handleAddCepEspecial}
                disabled={loadingCeps}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar
              </Button>
            </div>

            {cepsEspeciais.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CEP</TableHead>
                    <TableHead>Valor (R$)</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cepsEspeciais.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.cep}</TableCell>
                      <TableCell>R$ {parseFloat(item.valor).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => item.id && handleRemoveCepEspecial(item.id)}
                          disabled={loadingCeps}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum CEP especial cadastrado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Logistica;
