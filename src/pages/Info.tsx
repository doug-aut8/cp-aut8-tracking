import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Store, Info as InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";
import StoreStatusBadge from "@/components/StoreStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SCHEDULE, DAY_NAMES, WeekSchedule } from "@/hooks/useStoreOpen";

const DEFAULT_SOBRE =
  'Faça seu pedido pelo nosso cardápio digital: escolha os itens, adicione ao carrinho e finalize em poucos cliques. Acompanhe o status do seu pedido na aba "Pedidos" e acumule recompensas no nosso plano de fidelidade.';

interface EmpresaData {
  nome?: string;
  telefone?: string;
  whatsapp?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cnpj?: string;
  sobre?: string;
  horarios_funcionamento?: WeekSchedule;
}

const Info: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useLayoutSettings();
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("empresa_info")
        .select("nome,telefone,whatsapp,cep,rua,numero,bairro,cidade,estado,cnpj,sobre,horarios_funcionamento")
        .limit(1)
        .maybeSingle();
      if (data) setEmpresa(data as EmpresaData);
    })();
  }, []);

  const horarios: WeekSchedule =
    empresa?.horarios_funcionamento && typeof empresa.horarios_funcionamento === "object"
      ? { ...DEFAULT_SCHEDULE, ...empresa.horarios_funcionamento }
      : DEFAULT_SCHEDULE;

  const enderecoLinha1 = [empresa?.rua && empresa?.numero ? `${empresa.rua}, ${empresa.numero}` : empresa?.rua, empresa?.bairro, empresa?.cidade]
    .filter(Boolean)
    .join(" - ");
  const contatoLinha = [empresa?.cep, empresa?.telefone, empresa?.whatsapp].filter(Boolean).join("    ");

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
            Informações
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-[600px] space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Store className="h-6 w-6 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-xl font-bold truncate">
                    {empresa?.nome || settings.empresa_nome}
                  </h2>
                  {settings.empresa_descricao && (
                    <p className="text-sm text-muted-foreground">{settings.empresa_descricao}</p>
                  )}
                </div>
              </div>
              <StoreStatusBadge />
            </div>

            {enderecoLinha1 && (
              <p className="text-sm text-muted-foreground">{enderecoLinha1}</p>
            )}
            {contatoLinha && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contatoLinha}</p>
            )}
            {empresa?.cnpj && (
              <p className="text-sm text-muted-foreground">CNPJ {empresa.cnpj}</p>
            )}

            <div className="space-y-1 pt-1">
              {DAY_NAMES.map((name, idx) => {
                const h = horarios[String(idx)] || DEFAULT_SCHEDULE[String(idx)];
                const diaNome = name.replace("-feira", "");
                return (
                  <div key={idx} className="flex items-center gap-6 text-sm">
                    <span className="w-20 text-muted-foreground">{diaNome}</span>
                    <span className="text-muted-foreground">
                      {h.closed ? "Fechado" : `${h.open} ás ${h.close}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <InfoIcon className="h-5 w-5" /> Sobre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {empresa?.sobre || DEFAULT_SOBRE}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Info;
