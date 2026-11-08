import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseStoreMode, resolveStoreOperation, STORE_MODE_KEY, type StoreMode } from "@/utils/storeOperation";

export type DayHours = { open: string; close: string; closed: boolean };
export type WeekSchedule = Record<string, DayHours>;

export const DEFAULT_SCHEDULE: WeekSchedule = {
  "0": { closed: true, open: "18:00", close: "23:00" },
  "1": { closed: false, open: "18:00", close: "23:00" },
  "2": { closed: false, open: "18:00", close: "23:00" },
  "3": { closed: false, open: "18:00", close: "23:00" },
  "4": { closed: false, open: "18:00", close: "23:00" },
  "5": { closed: false, open: "18:00", close: "23:59" },
  "6": { closed: false, open: "18:00", close: "23:59" },
};

export const DAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const toMinutes = (hhmm: string) => {
  const [h, m] = (hhmm || "00:00").split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
};

export const formatHour = (hhmm: string) => {
  const [h, m] = (hhmm || "00:00").split(":");
  return `${h}h${m}`;
};

export const isStoreOpenNow = (schedule: WeekSchedule, now: Date = new Date()) => {
  const day = String(now.getDay());
  const today = schedule?.[day];
  if (!today || today.closed) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const openM = toMinutes(today.open);
  const closeM = toMinutes(today.close);
  if (closeM > openM) {
    return cur >= openM && cur < closeM;
  }
  return cur >= openM || cur < closeM;
};

/** Returns status text: "Aberto até às HHhMM" or "Abre às HHhMM" (next opening). */
export const getStoreStatusLabel = (schedule: WeekSchedule, now: Date = new Date()) => {
  const open = isStoreOpenNow(schedule, now);
  const day = now.getDay();
  if (open) {
    const today = schedule[String(day)];
    return { isOpen: true, label: `Aberto até às ${formatHour(today.close)}` };
  }
  // Find next opening within 7 days
  const curMin = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < 8; i++) {
    const d = (day + i) % 7;
    const sd = schedule[String(d)];
    if (!sd || sd.closed) continue;
    const openM = toMinutes(sd.open);
    if (i === 0 && curMin >= openM) continue;
    const prefix = i === 0 ? "Abre às" : i === 1 ? "Abre amanhã às" : `Abre ${DAY_NAMES[d].toLowerCase()} às`;
    return { isOpen: false, label: `${prefix} ${formatHour(sd.open)}` };
  }
  return { isOpen: false, label: "Fechado" };
};

export const useStoreOpen = () => {
  const queryClient = useQueryClient();
  const [tick, setTick] = useState(0);
  const hoursQuery = useQuery({
    queryKey: ["store-hours"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresa_info")
        .select("horarios_funcionamento").limit(1).maybeSingle();
      if (error) throw error;
      const hours = data?.horarios_funcionamento;
      return hours && typeof hours === "object" && !Array.isArray(hours)
        ? { ...DEFAULT_SCHEDULE, ...hours } as WeekSchedule : DEFAULT_SCHEDULE;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });
  const modeQuery = useQuery({
    queryKey: ["store-operation-mode"],
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes")
        .select("valor").eq("chave", STORE_MODE_KEY).maybeSingle();
      if (error) throw error;
      return parseStoreMode(data?.valor);
    },
    staleTime: 15000,
    refetchInterval: 30000,
    refetchOnWindowFocus: "always",
  });
  const mutation = useMutation({
    mutationKey: ["store-operation-mode"],
    mutationFn: async (mode: StoreMode) => {
      const { data, error } = await supabase.from("configuracoes")
        .upsert({ chave: STORE_MODE_KEY, valor: mode, updated_at: new Date().toISOString() }, { onConflict: "chave" })
        .select("valor").single();
      if (error) throw error;
      return parseStoreMode(data.valor);
    },
    onSuccess: (mode) => {
      queryClient.setQueryData(["store-operation-mode"], mode);
      void queryClient.invalidateQueries({ queryKey: ["store-operation-mode"] });
    },
  });

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60000);
    return () => window.clearInterval(id);
  }, []);

  const effective = hoursQuery.data ?? DEFAULT_SCHEDULE;
  const now = new Date();
  const mode = modeQuery.data ?? "automatico";
  const today = effective[String(now.getDay())];
  const status = resolveStoreOperation(mode, getStoreStatusLabel(effective, now));

  return {
    loading: hoursQuery.isPending || modeQuery.isPending,
    error: hoursQuery.error || modeQuery.error,
    schedule: effective, isOpen: status.isOpen, today, status, mode,
    setMode: mutation.mutateAsync, saving: mutation.isPending, _tick: tick,
  };
};
