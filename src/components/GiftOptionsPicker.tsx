import React, { useEffect, useRef, useState } from "react";
import { Gift, Minus, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface GiftOption {
  product_id: string;
  product_name: string;
}

export interface GiftChoice {
  product_id: string;
  product_name: string;
  quantidade: number;
}

interface Props {
  opcoes: GiftOption[];
  escolhas: GiftChoice[];
  totalAlvo: number;
  onChange: (escolhas: GiftChoice[]) => void;
}

const ROW_HEIGHT = 40; // px, approx per row including padding
const MAX_VISIBLE = 5;

// Cache global de mapa produto->categorias e id->nome
let categoryCachePromise: Promise<{
  productCategories: Map<string, string[]>;
  categoryNames: Map<string, string>;
}> | null = null;

const loadCategoryCache = () => {
  if (categoryCachePromise) return categoryCachePromise;
  categoryCachePromise = (async () => {
    const productCategories = new Map<string, string[]>();
    const categoryNames = new Map<string, string>();
    try {
      const [{ data: items }, { data: cats }] = await Promise.all([
        supabase.from("menu_items").select("id, category, additional_categories"),
        supabase.from("categories").select("id, name"),
      ]);
      (items || []).forEach((mi: any) => {
        const list: string[] = [];
        if (mi.category) list.push(String(mi.category));
        if (Array.isArray(mi.additional_categories)) {
          mi.additional_categories.forEach((c: string) => {
            if (c && !list.includes(String(c))) list.push(String(c));
          });
        }
        productCategories.set(String(mi.id), list);
      });
      (cats || []).forEach((c: any) => categoryNames.set(String(c.id), c.name));
    } catch (e) {
      console.error("Erro ao carregar categorias para brindes:", e);
    }
    return { productCategories, categoryNames };
  })();
  return categoryCachePromise;
};

const GiftOptionsPicker: React.FC<Props> = ({ opcoes, escolhas, totalAlvo, onChange }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [grupos, setGrupos] = useState<
    { categoryId: string; categoryName: string; opcoes: GiftOption[] }[] | null
  >(null);

  useEffect(() => {
    let cancel = false;
    loadCategoryCache().then(({ productCategories, categoryNames }) => {
      if (cancel) return;
      const map = new Map<string, { categoryName: string; opcoes: GiftOption[] }>();
      const semCategoria: GiftOption[] = [];
      opcoes.forEach((opt) => {
        const cats = productCategories.get(opt.product_id) || [];
        if (!cats.length) {
          semCategoria.push(opt);
          return;
        }
        cats.forEach((cid) => {
          const name = categoryNames.get(cid) || "Outros";
          if (!map.has(cid)) map.set(cid, { categoryName: name, opcoes: [] });
          map.get(cid)!.opcoes.push(opt);
        });
      });
      const arr = Array.from(map.entries())
        .map(([categoryId, v]) => ({ categoryId, ...v }))
        .sort((a, b) => a.categoryName.localeCompare(b.categoryName, "pt-BR"));
      if (semCategoria.length) {
        arr.push({ categoryId: "__sem__", categoryName: "Outros", opcoes: semCategoria });
      }
      setGrupos(arr);
    });
    return () => {
      cancel = true;
    };
  }, [opcoes]);

  const getQtd = (pid: string) =>
    escolhas.find((e) => e.product_id === pid)?.quantidade || 0;
  const somaAtual = escolhas.reduce((s, e) => s + (e.quantidade || 0), 0);
  const restante = Math.max(0, totalAlvo - somaAtual);
  const hasOverflow = opcoes.length > MAX_VISIBLE;

  const setQtd = (opt: GiftOption, delta: number) => {
    const map = new Map(escolhas.map((e) => [e.product_id, { ...e }]));
    const atual =
      map.get(opt.product_id) || {
        product_id: opt.product_id,
        product_name: opt.product_name,
        quantidade: 0,
      };
    const novaQtd = atual.quantidade + delta;
    if (novaQtd < 0) return;
    if (delta > 0 && restante <= 0) return;
    atual.quantidade = novaQtd;
    atual.product_name = opt.product_name;
    if (novaQtd === 0) map.delete(opt.product_id);
    else map.set(opt.product_id, atual);
    onChange(Array.from(map.values()));
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setScrolledToEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
  };

  useEffect(() => {
    handleScroll();
  }, [opcoes.length]);

  const renderRow = (opt: GiftOption) => {
    const qtd = getQtd(opt.product_id);
    return (
      <div
        key={opt.product_id}
        className="flex items-center justify-between gap-2 text-sm"
        style={{ minHeight: ROW_HEIGHT - 4 }}
      >
        <span className="flex-1 truncate text-foreground">{opt.product_name}</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              setQtd(opt, -1);
            }}
            disabled={qtd <= 0}
            aria-label={`Remover ${opt.product_name}`}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-6 text-center font-medium">{qtd}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              setQtd(opt, 1);
            }}
            disabled={restante <= 0}
            aria-label={`Adicionar ${opt.product_name}`}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  const usarAgrupamento = !!grupos && grupos.length > 1;

  return (
    <div className="space-y-2">
      <label className="text-xs text-green-700 font-medium flex items-center gap-1">
        <Gift className="h-3 w-3" /> Escolha seus brindes
        <span className="ml-auto text-[11px] font-normal text-green-700/80">
          {somaAtual}/{totalAlvo} selecionados
        </span>
      </label>

      <div className="relative bg-white rounded border border-green-200">
        {usarAgrupamento ? (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="overflow-y-auto p-2"
            style={{ maxHeight: ROW_HEIGHT * MAX_VISIBLE + 40 }}
          >
            <Accordion type="multiple" className="w-full">
              {grupos!.map((g) => {
                const somaGrupo = g.opcoes.reduce((s, o) => s + getQtd(o.product_id), 0);
                return (
                  <AccordionItem
                    key={g.categoryId}
                    value={g.categoryId}
                    className="border-b border-green-100 last:border-0"
                  >
                    <AccordionTrigger className="px-2 py-2 text-sm font-medium hover:no-underline bg-green-50/60 rounded">
                      <span className="flex-1 text-left">{g.categoryName}</span>
                      {somaGrupo > 0 && (
                        <span className="mr-2 text-[11px] font-normal text-green-700">
                          {somaGrupo} selecionado{somaGrupo > 1 ? "s" : ""}
                        </span>
                      )}
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-2 px-2 space-y-1">
                      {g.opcoes.map(renderRow)}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="overflow-y-auto p-2 space-y-1"
            style={{ maxHeight: hasOverflow ? ROW_HEIGHT * MAX_VISIBLE : undefined }}
          >
            {opcoes.map(renderRow)}
          </div>
        )}

        {!usarAgrupamento && hasOverflow && !scrolledToEnd && (
          <>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white via-white/90 to-transparent rounded-b" />
            <div className="pointer-events-none absolute bottom-1 left-0 right-0 flex justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-600 text-white text-[10px] font-semibold px-2 py-0.5 shadow animate-bounce">
                <ChevronDown className="h-3 w-3" />
                Role para ver mais
              </span>
            </div>
          </>
        )}
      </div>

      {restante > 0 && (
        <p className="text-[11px] text-amber-700">
          Selecione mais {restante} {restante === 1 ? "brinde" : "brindes"} para concluir.
        </p>
      )}
    </div>
  );
};

export default GiftOptionsPicker;
