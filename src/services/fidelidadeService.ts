import { supabase } from "@/integrations/supabase/client";
import { phoneDigitsBr } from "@/utils/phoneUtils";

// Referência a um produto específico OU a uma categoria (mesma estrutura do cupom "compre e ganhe")
export type ProdutoRefFid = {
  tipo: "produto" | "categoria";
  product_id?: string;
  product_name?: string;
  category_id?: string;
  category_name?: string;
  category_ids?: string[];
  category_names?: string[];
  // Quando o produto for uma pizza, é possível restringir a um tamanho específico
  size_id?: string;
  size_name?: string;
};

export interface FidelidadeRegra {
  id: string;
  nome: string;
  descricao: string | null;
  // PRODUTO que conta para a meta
  produto_requerido: ProdutoRefFid | null;
  // X = quantidade necessária
  quantidade_necessaria: number;
  // Y = janela de validade do acúmulo (0 = indeterminado)
  validade_dias: number;
  // PRÊMIO
  premio_tipo: "produto" | "categoria" | "cupom";
  premio_produto: ProdutoRefFid | null; // quando premio_tipo = produto | categoria
  premio_cupom_tipo: "percentual" | "fixo" | "frete_gratis" | null; // quando premio_tipo = cupom
  premio_cupom_valor: number | null;
  // Validade (em dias) do cupom de prêmio gerado (0 = sem validade)
  premio_validade_dias: number;
  ativo: boolean;
  criado_em: string | null;
}

type FidEvento = { data: string; qtd: number };

const mapRegra = (r: any): FidelidadeRegra => ({
  id: r.id,
  nome: r.nome,
  descricao: r.descricao ?? null,
  produto_requerido: r.produto_requerido ?? null,
  quantidade_necessaria: Number(r.quantidade_necessaria ?? 1),
  validade_dias: Number(r.validade_dias ?? 0),
  premio_tipo: (r.premio_tipo as FidelidadeRegra["premio_tipo"]) ?? "cupom",
  premio_produto: r.premio_produto ?? null,
  premio_cupom_tipo: r.premio_cupom_tipo ?? null,
  premio_cupom_valor: r.premio_cupom_valor != null ? Number(r.premio_cupom_valor) : null,
  premio_validade_dias: Number(r.premio_validade_dias ?? 30),
  ativo: r.ativo ?? true,
  criado_em: r.criado_em ?? null,
});

type RegraInput = Omit<FidelidadeRegra, "id" | "criado_em">;

const toRow = (regra: Partial<RegraInput>) => ({
  nome: regra.nome,
  descricao: regra.descricao,
  produto_requerido: regra.produto_requerido as any,
  quantidade_necessaria: regra.quantidade_necessaria,
  validade_dias: regra.validade_dias,
  premio_tipo: regra.premio_tipo,
  premio_produto: regra.premio_produto as any,
  premio_cupom_tipo: regra.premio_cupom_tipo,
  premio_cupom_valor: regra.premio_cupom_valor,
  premio_validade_dias: regra.premio_validade_dias,
  ativo: regra.ativo,
  // Mantém compatibilidade com colunas legadas
  criterio: "quantidade_compras",
  meta: regra.quantidade_necessaria ?? 1,
});

// ===== CRUD =====
export const getFidelidadeRegras = async (): Promise<FidelidadeRegra[]> => {
  const { data, error } = await supabase
    .from("fidelidade_regras")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) {
    console.error("Erro ao buscar regras de fidelidade:", error);
    throw error;
  }
  return (data || []).map(mapRegra);
};

export const getRegrasAtivas = async (): Promise<FidelidadeRegra[]> => {
  const { data, error } = await supabase
    .from("fidelidade_regras")
    .select("*")
    .eq("ativo", true);
  if (error) {
    console.error("Erro ao buscar regras ativas:", error);
    throw error;
  }
  return (data || []).map(mapRegra);
};

export const createFidelidadeRegra = async (regra: RegraInput): Promise<FidelidadeRegra> => {
  const { data, error } = await supabase
    .from("fidelidade_regras")
    .insert(toRow(regra) as any)
    .select()
    .single();
  if (error) {
    console.error("Erro ao criar regra de fidelidade:", error);
    throw error;
  }
  return mapRegra(data);
};

export const updateFidelidadeRegra = async (
  id: string,
  regra: Partial<RegraInput>
): Promise<FidelidadeRegra> => {
  const { data, error } = await supabase
    .from("fidelidade_regras")
    .update(toRow(regra) as any)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("Erro ao atualizar regra de fidelidade:", error);
    throw error;
  }
  return mapRegra(data);
};

export const deleteFidelidadeRegra = async (id: string): Promise<void> => {
  const { error } = await supabase.from("fidelidade_regras").delete().eq("id", id);
  if (error) {
    console.error("Erro ao excluir regra de fidelidade:", error);
    throw error;
  }
};

// ===== Lógica de verificação =====

const ehItemBrinde = (item: any): boolean => {
  if (item?.isGift) return true;
  const id = String(item?.menuItemId ?? item?.id ?? "");
  if (id.startsWith("gift-")) return true;
  const nome = String(item?.name ?? item?.nome ?? "");
  return nome.trim().startsWith("🎁");
};

const getItemId = (item: any): string => String(item?.menuItemId ?? item?.id ?? "");
const getItemQtd = (item: any): number => Number(item?.quantity ?? item?.quantidade ?? 1) || 1;

// Constrói mapa: id do produto -> { categorias, sizes configurados (nomes) }
const carregarMapaMenu = async (): Promise<
  Map<string, { cats: Set<string>; sizes: Set<string> }>
> => {
  const mapa = new Map<string, { cats: Set<string>; sizes: Set<string> }>();
  const { data } = await supabase
    .from("menu_items")
    .select("id, category, additional_categories, pizza_sizes, tipo");
  (data || []).forEach((mi: any) => {
    const cats = new Set<string>();
    if (mi.category) cats.add(String(mi.category));
    if (Array.isArray(mi.additional_categories)) {
      mi.additional_categories.forEach((c: string) => c && cats.add(String(c)));
    }
    const sizes = new Set<string>();
    if (mi.tipo === "pizza" && Array.isArray(mi.pizza_sizes)) {
      mi.pizza_sizes.forEach((s: any) => s?.name && sizes.add(String(s.name)));
    }
    mapa.set(String(mi.id), { cats, sizes });
  });
  return mapa;
};

const categoriasDaRegra = (ref: ProdutoRefFid | null): string[] => {
  if (!ref) return [];
  if (ref.category_ids && ref.category_ids.length) return ref.category_ids;
  if (ref.category_id) return [ref.category_id];
  return [];
};

// Conta quantas unidades do PRODUTO exigido existem neste pedido
const contarUnidadesQualificadas = (
  regra: FidelidadeRegra,
  itens: any[],
  mapaMenu: Map<string, { cats: Set<string>; sizes: Set<string> }>
): number => {
  const ref = regra.produto_requerido;
  if (!ref) return 0;
  let total = 0;
  const getItemSizeId = (item: any): string | undefined =>
    item?.selectedSize?.id || item?.combination?.size?.id || undefined;
  const getItemSizeName = (item: any): string | undefined =>
    item?.selectedSize?.name || item?.combination?.size?.name || item?.combination?.tamanho || undefined;

  for (const item of itens) {
    if (ehItemBrinde(item)) continue;
    const itemId = getItemId(item);
    if (ref.tipo === "categoria") {
      const info = mapaMenu.get(itemId);
      const cats = info?.cats || new Set<string>();
      const alvo = categoriasDaRegra(ref);
      if (!alvo.some((c) => cats.has(c))) continue;
      // Restrição por tamanho na categoria: itens sem tamanho configurado
      // são elegíveis; itens com tamanho configurado precisam ter tamanho igual.
      if (ref.size_name) {
        const temSizesConfig = (info?.sizes.size || 0) > 0;
        if (temSizesConfig) {
          const sname = getItemSizeName(item);
          if (!sname || sname !== ref.size_name) continue;
        }
      }
      total += getItemQtd(item);
    } else {
      if (itemId === ref.product_id) {
        // Se a regra restringe por tamanho, exige match do size_id ou size_name
        if (ref.size_id || ref.size_name) {
          const sid = getItemSizeId(item);
          const sname = getItemSizeName(item);
          const match =
            (ref.size_id && sid && ref.size_id === sid) ||
            (ref.size_name && sname && ref.size_name === sname);
          if (!match) continue;
        }
        total += getItemQtd(item);
      }
    }
  }
  return total;
};

// Gera código único de cupom de fidelidade
const gerarCodigoCupom = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `FID-${code}`;
};

// Cria o cupom de prêmio na tabela de cupons e devolve o código
const criarCupomPremio = async (
  regra: FidelidadeRegra
): Promise<{ codigo: string; descricaoPremio: string } | null> => {
  const hoje = new Date();
  const inicio = hoje.toISOString().slice(0, 10);
  const validade = regra.premio_validade_dias && regra.premio_validade_dias > 0
    ? regra.premio_validade_dias
    : 3650; // ~10 anos = "sem validade"
  const fim = new Date(hoje.getTime() + validade * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const codigo = gerarCodigoCupom();
  const base: any = {
    nome: codigo,
    descricao: `Recompensa de fidelidade: ${regra.nome}`,
    data_inicio: inicio,
    data_fim: fim,
    limite_uso: 1,
    usos_por_usuario: 1,
    ativo: true,
    origem: "fidelidade",
    valor: 0,
  };

  let descricaoPremio = "";

  if (regra.premio_tipo === "cupom") {
    base.tipo = regra.premio_cupom_tipo || "percentual";
    base.valor = regra.premio_cupom_valor || 0;
    descricaoPremio =
      base.tipo === "frete_gratis"
        ? "Frete grátis"
        : base.tipo === "percentual"
        ? `${base.valor}% de desconto`
        : `R$ ${Number(base.valor).toFixed(2)} de desconto`;
  } else if (regra.premio_tipo === "produto") {
    const ref = regra.premio_produto;
    base.tipo = "compre_e_ganhe";
    base.produtos_requeridos = [];
    base.produto_brinde = {
      tipo: "produto",
      modo: "fixo",
      product_id: ref?.product_id || "",
      product_name: ref?.product_name || "",
      quantidade: 1,
      size_id: ref?.size_id || "",
      size_name: ref?.size_name || "",
    };
    const sizeSuffix = ref?.size_name ? ` (${ref.size_name})` : "";
    descricaoPremio = `Brinde: ${ref?.product_name || "produto"}${sizeSuffix}`;
  } else {
    // categoria: oferece produtos da categoria como opções de brinde.
    // Se a regra tem size_name definido, itens sem tamanho configurado
    // continuam elegíveis; itens com tamanho configurado só entram na lista
    // caso possuam o tamanho escolhido.
    const ref = regra.premio_produto;
    const alvo = categoriasDaRegra(ref);
    const sizeName = ref?.size_name || "";
    let opcoes: { product_id: string; product_name: string; size_id?: string; size_name?: string }[] = [];
    if (alvo.length) {
      const { data } = await supabase
        .from("menu_items")
        .select("id, name, category, additional_categories, pizza_sizes, tipo")
        .eq("available", true);
      opcoes = (data || [])
        .filter((mi: any) => {
          const cats = new Set<string>();
          if (mi.category) cats.add(String(mi.category));
          if (Array.isArray(mi.additional_categories))
            mi.additional_categories.forEach((c: string) => c && cats.add(String(c)));
          if (!alvo.some((c) => cats.has(c))) return false;
          if (!sizeName) return true;
          const sizes: any[] = mi.tipo === "pizza" && Array.isArray(mi.pizza_sizes) ? mi.pizza_sizes : [];
          if (sizes.length === 0) return true; // sem tamanho configurado → elegível
          return sizes.some((s: any) => String(s?.name || "") === sizeName);
        })
        .map((mi: any) => {
          const sizes: any[] = mi.tipo === "pizza" && Array.isArray(mi.pizza_sizes) ? mi.pizza_sizes : [];
          const matched = sizeName ? sizes.find((s: any) => String(s?.name || "") === sizeName) : undefined;
          return {
            product_id: String(mi.id),
            product_name: mi.name,
            ...(matched ? { size_id: String(matched.id || ""), size_name: String(matched.name || "") } : {}),
          };
        });
    }
    base.tipo = "compre_e_ganhe";
    base.produtos_requeridos = [];
    base.produto_brinde = {
      tipo: "categoria",
      modo: "escolha",
      product_id: "",
      product_name: "",
      quantidade: 1,
      ...(sizeName ? { size_name: sizeName } : {}),
      opcoes,
    };
    const sizeSuffix = sizeName ? ` — ${sizeName}` : "";
    descricaoPremio = `Brinde à escolha (${ref?.category_names?.[0] || ref?.category_name || "categoria"})${sizeSuffix}`;
  }

  const { error } = await supabase.from("cupons" as any).insert([base]);
  if (error) {
    console.error("Erro ao criar cupom de prêmio:", error);
    return null;
  }
  return { codigo, descricaoPremio };
};

const getWebhookFidelidade = async (): Promise<string> => {
  try {
    const { data } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "webhook_fidelidade")
      .maybeSingle();
    if (data?.valor && data.valor.trim()) return data.valor.trim();
  } catch (e) {
    console.error("Erro ao buscar webhook de fidelidade:", e);
  }
  return "https://n8n-n8n-start.yh11mi.easypanel.host/webhook/fidelidade_Aut5";
};

// Verifica fidelidade ao concluir um pedido (chamado na transição para "entregue")
export const verificarFidelidade = async (
  customerName: string,
  customerPhone: string,
  itens: any[],
  userId?: string
): Promise<void> => {
  try {
    if (!customerPhone || !Array.isArray(itens) || itens.length === 0) return;
    customerPhone = phoneDigitsBr(customerPhone) || customerPhone;

    const regras = await getRegrasAtivas();
    if (regras.length === 0) return;

    const mapaMenu = await carregarMapaMenu();
    const agora = new Date();

    for (const regra of regras) {
      const novas = contarUnidadesQualificadas(regra, itens, mapaMenu);
      if (novas <= 0) continue;

      // Carrega progresso atual desta regra para o cliente
      const { data: existing } = await (supabase
        .from("fidelidade_progresso") as any)
        .select("*")
        .eq("telefone_cliente", customerPhone)
        .eq("regra_id", regra.id)
        .maybeSingle();

      let eventos: FidEvento[] = Array.isArray((existing as any)?.eventos)
        ? ((existing as any).eventos as FidEvento[])
        : [];

      // Adiciona a compra atual
      eventos.push({ data: agora.toISOString(), qtd: novas });

      // Remove compras fora da janela Y (se houver validade)
      if (regra.validade_dias && regra.validade_dias > 0) {
        const limite = agora.getTime() - regra.validade_dias * 24 * 60 * 60 * 1000;
        eventos = eventos.filter((ev) => new Date(ev.data).getTime() >= limite);
      }

      let total = eventos.reduce((s, ev) => s + (Number(ev.qtd) || 0), 0);
      let premioConcedido = false;

      // Atingiu a meta?
      if (total >= regra.quantidade_necessaria) {
        const premio = await criarCupomPremio(regra);
        if (premio) {
          premioConcedido = true;
          // Carrega excedente para a próxima meta
          const excedente = total - regra.quantidade_necessaria;
          eventos = excedente > 0
            ? [{ data: agora.toISOString(), qtd: excedente }]
            : [];
          total = excedente > 0 ? excedente : 0;

          // Registra histórico (exibido em "Meus Pedidos")
          await supabase.from("fidelidade_historico").insert({
            regra_id: regra.id,
            telefone_cliente: customerPhone,
            nome_cliente: customerName,
            cupom_codigo: premio.codigo,
            premio_descricao: premio.descricaoPremio,
            premio_concedido: true,
            observacao: `Cupom ${premio.codigo} — ${premio.descricaoPremio}`,
          } as any);

          // Dispara webhook
          try {
            const url = await getWebhookFidelidade();
            const payload = {
              cliente: { nome: customerName, whatsapp: customerPhone },
              regra: {
                id: regra.id,
                nome: regra.nome,
                quantidade_necessaria: regra.quantidade_necessaria,
                validade_dias: regra.validade_dias,
                premio_tipo: regra.premio_tipo,
              },
              premio: {
                descricao: premio.descricaoPremio,
                cupom_codigo: premio.codigo,
              },
              timestamp: agora.toISOString(),
            };
            const { withComunicacaoMeta } = await import("@/utils/webhookPayload");
            const enriched = await withComunicacaoMeta(payload);
            await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(enriched),
            });
          } catch (whErr) {
            console.error("Erro ao enviar webhook de fidelidade:", whErr);
          }
        }
      }

      // Persiste progresso
      if (existing) {
        await (supabase.from("fidelidade_progresso") as any)
          .update({
            nome_cliente: customerName,
            user_id: userId || (existing as any).user_id || null,
            contagem_pizzas: total,
            eventos: eventos,
            ultima_atualizacao: agora.toISOString(),
          })
          .eq("id", (existing as any).id);
      } else {
        await (supabase.from("fidelidade_progresso") as any).insert({
          telefone_cliente: customerPhone,
          nome_cliente: customerName,
          regra_id: regra.id,
          user_id: userId || null,
          contagem_pizzas: total,
          eventos: eventos,
        });
      }

      if (premioConcedido) {
        console.log(`🎉 Prêmio de fidelidade concedido (${regra.nome}) para ${customerPhone}`);
      }
    }
  } catch (error) {
    console.error("Erro ao verificar fidelidade:", error);
  }
};

// Recompensas de fidelidade do cliente (para exibir em "Meus Pedidos")
export interface FidelidadeRecompensa {
  id: string;
  cupom_codigo: string | null;
  premio_descricao: string | null;
  data: string | null;
  resgatado: boolean;
}

export const getRecompensasCliente = async (
  phones: string[]
): Promise<FidelidadeRecompensa[]> => {
  if (!phones.length) return [];
  const { data, error } = await (supabase
    .from("fidelidade_historico") as any)
    .select("id, cupom_codigo, premio_descricao, data, resgatado")
    .in("telefone_cliente", phones)
    .eq("premio_concedido", true)
    .or("resgatado.eq.false,resgatado.is.null")
    .order("data", { ascending: false });
  if (error) {
    console.error("Erro ao buscar recompensas do cliente:", error);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    cupom_codigo: r.cupom_codigo ?? null,
    premio_descricao: r.premio_descricao ?? null,
    data: r.data ?? null,
    resgatado: r.resgatado ?? false,
  }));
};

// ===== Progresso do cliente (metas em andamento) =====
export interface FidelidadeProgresso {
  id: string;
  regra_id: string | null;
  contagem: number;
  ultima_atualizacao: string | null;
}

export const getProgressoCliente = async (
  phones: string[],
  userId?: string
): Promise<FidelidadeProgresso[]> => {
  if (!phones.length && !userId) return [];
  let query = (supabase.from("fidelidade_progresso") as any).select(
    "id, regra_id, contagem_pizzas, eventos, ultima_atualizacao"
  );
  if (phones.length && userId) {
    query = query.or(
      `user_id.eq.${userId},telefone_cliente.in.(${phones.slice(0, 30).map((p) => `"${p}"`).join(",")})`
    );
  } else if (phones.length) {
    query = query.in("telefone_cliente", phones);
  } else {
    query = query.eq("user_id", userId);
  }
  const { data, error } = await query;
  if (error) {
    console.error("Erro ao buscar progresso de fidelidade:", error);
    return [];
  }
  return (data || []).map((p: any) => {
    const eventos: FidEvento[] = Array.isArray(p.eventos) ? p.eventos : [];
    const somaEventos = eventos.reduce((s, ev) => s + (Number(ev?.qtd) || 0), 0);
    return {
      id: p.id,
      regra_id: p.regra_id ?? null,
      contagem: somaEventos || Number(p.contagem_pizzas ?? 0),
      ultima_atualizacao: p.ultima_atualizacao ?? null,
    };
  });
};
