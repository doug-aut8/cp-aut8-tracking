import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const KEY = "tempo_entrega";
const DEFAULT_MINUTES = 50;

export default function DeliveryTimeField() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({
    queryKey: ["config", KEY],
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes").select("valor").eq("chave", KEY).maybeSingle();
      if (error) throw error;
      const n = parseInt(String(data?.valor ?? ""), 10);
      return Number.isFinite(n) && n > 0 ? n : DEFAULT_MINUTES;
    },
  });
  const [value, setValue] = useState(String(DEFAULT_MINUTES));
  useEffect(() => { if (query.data) setValue(String(query.data)); }, [query.data]);

  const mutation = useMutation({
    mutationFn: async (minutes: number) => {
      const { error } = await supabase.from("configuracoes")
        .upsert({ chave: KEY, valor: String(minutes), updated_at: new Date().toISOString() }, { onConflict: "chave" });
      if (error) throw error;
      return minutes;
    },
    onSuccess: (m) => { qc.setQueryData(["config", KEY], m); toast({ title: `Tempo de entrega salvo: ${m} min` }); },
    onError: () => toast({ title: "Não foi possível salvar o tempo de entrega", variant: "destructive" }),
  });

  const save = () => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) { toast({ title: "Informe um tempo válido em minutos", variant: "destructive" }); return; }
    mutation.mutate(n);
  };

  return (
    <div className="flex items-center gap-2">
      <Timer className="h-4 w-4 text-muted-foreground" />
      <label htmlFor="tempo-entrega" className="text-sm font-medium whitespace-nowrap">Tempo de Entrega</label>
      <Input id="tempo-entrega" type="number" min={1} value={value} onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()} className="h-9 w-20" disabled={query.isLoading} />
      <span className="text-sm text-muted-foreground">min</span>
      <Button size="sm" variant="ghost" onClick={save} disabled={mutation.isPending || query.isLoading} className="h-8 px-2 text-xs">
        {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
      </Button>
    </div>
  );
}
