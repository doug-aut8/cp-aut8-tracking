import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, Trophy, Target, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";
import { useBannerAction } from "@/hooks/useBannerAction";
import { supabase } from "@/integrations/supabase/client";
import { getProfile } from "@/services/profileService";
import { phoneVariants } from "@/utils/phoneUtils";
import {
  getRegrasAtivas,
  getRecompensasCliente,
  getProgressoCliente,
  FidelidadeRegra,
  FidelidadeRecompensa,
  FidelidadeProgresso,
} from "@/services/fidelidadeService";

const PlanoFidelidade: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { settings } = useLayoutSettings();
  const runBannerAction = useBannerAction();
  const [regras, setRegras] = useState<FidelidadeRegra[]>([]);
  const [recompensas, setRecompensas] = useState<FidelidadeRecompensa[]>([]);
  const [progresso, setProgresso] = useState<FidelidadeProgresso[]>([]);
  const [loading, setLoading] = useState(true);
  const [resgatandoId, setResgatandoId] = useState<string | null>(null);

  const handleResgatar = async (rec: FidelidadeRecompensa) => {
    if (!rec.cupom_codigo) return;
    setResgatandoId(rec.id);
    try {
      await runBannerAction("cupom", rec.cupom_codigo);
      navigate("/cardapio");
    } finally {
      setResgatandoId(null);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const r = await getRegrasAtivas();
        setRegras(r);

        if (!currentUser) {
          setRecompensas([]);
          setProgresso([]);
          return;
        }

        // Resolve o telefone do usuário: profile → auth → tabela users
        let phone: string | null = null;
        try {
          const profileData = await getProfile(currentUser.id);
          phone = profileData?.phone || null;
        } catch {
          phone = null;
        }
        if (!phone) phone = currentUser.phoneNumber || null;
        if (!phone) {
          const { data: userRow } = await supabase
            .from("users")
            .select("phone")
            .eq("id", currentUser.id)
            .maybeSingle();
          phone = userRow?.phone || null;
        }

        const variants = phone ? phoneVariants(phone) : [];

        const [rec, prog] = await Promise.all([
          variants.length ? getRecompensasCliente(variants) : Promise.resolve([]),
          getProgressoCliente(variants, currentUser.id),
        ]);
        setRecompensas(rec);
        setProgresso(prog);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  const progressoDaRegra = (regraId: string) =>
    progresso.find((p) => p.regra_id === regraId)?.contagem ?? 0;

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
            Plano Fidelidade
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-[600px] space-y-4">
        {loading ? (
          <div className="h-32 rounded-lg bg-muted animate-pulse" />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5" /> Regras ativas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {regras.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma regra de fidelidade ativa no momento.
                  </p>
                ) : (
                  regras.map((regra) => {
                    const meta = Math.max(1, regra.quantidade_necessaria || 1);
                    const atual = Math.min(progressoDaRegra(regra.id), meta);
                    const faltam = Math.max(0, meta - atual);
                    const pct = Math.round((atual / meta) * 100);
                    return (
                      <div key={regra.id} className="p-3 rounded-lg border space-y-2">
                        <div>
                          <p className="font-medium">{regra.nome}</p>
                          {regra.descricao && (
                            <p className="text-sm text-muted-foreground">{regra.descricao}</p>
                          )}
                        </div>
                        {currentUser ? (
                          <>
                            <Progress value={pct} className="h-2" />
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                {atual} de {meta}
                              </span>
                              <span className="flex items-center gap-1 font-medium">
                                <Target className="h-4 w-4" />
                                {faltam === 0
                                  ? "Meta atingida!"
                                  : `Faltam ${faltam} ${faltam === 1 ? "item" : "itens"}`}
                              </span>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Meta: {meta} {meta === 1 ? "item" : "itens"}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" /> Suas recompensas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!currentUser ? (
                  <p className="text-sm text-muted-foreground">
                    Entre na sua conta para ver suas recompensas.
                  </p>
                ) : recompensas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Você ainda não possui recompensas disponíveis.
                  </p>
                ) : (
                  recompensas.map((rec) => (
                    <div key={rec.id} className="p-3 rounded-lg border flex justify-between items-center gap-2">
                      <div>
                        <p className="font-medium">{rec.premio_descricao || "Brinde"}</p>
                        {rec.cupom_codigo && (
                          <p className="text-sm text-muted-foreground">
                            Cupom: <span className="font-mono font-semibold">{rec.cupom_codigo}</span>
                          </p>
                        )}
                        {rec.data && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(rec.data).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleResgatar(rec)}
                        disabled={!rec.cupom_codigo || resgatandoId === rec.id}
                        className="shrink-0"
                      >
                        <Ticket className="h-4 w-4 mr-1" />
                        {resgatandoId === rec.id ? "Aplicando..." : "Resgatar"}
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default PlanoFidelidade;
