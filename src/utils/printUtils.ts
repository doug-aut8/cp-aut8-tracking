import { Order, OrderItem, SelectedVariationGroup } from "@/types/order";
import { groupOrderItemsByCategory, enrichOrderWithCategories } from "@/utils/orderItemCategories";
import { getOrderItemDisplayName } from "@/utils/orderItemDisplay";

type PrintableVariation = {
  name?: string;
  quantity?: number;
  additionalPrice?: number;
  halfSelection?: "first" | "second" | "whole" | string;
};

// Função para formatar data em português
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// Função para traduzir método de pagamento
const translatePaymentMethod = (method: Order["paymentMethod"]) => {
  const methodMap: Record<Order["paymentMethod"], string> = {
    card: "Cartão",
    cash: "Dinheiro",
    pix: "PIX",
    payroll_discount: "Desconto em Folha",
    pix_mesa: "PIX (Salão)",
    cobranca_mesa: "Cobrança na Mesa"
  };
  return methodMap[method] || method;
};

// Função para calcular subtotal do item incluindo variações
const calculateItemSubtotal = (item: OrderItem) => {
  const basePrice = (item.priceFrom ? 0 : (item.price || 0)) * item.quantity;
  let variationsTotal = 0;

  if (item.selectedVariations && Array.isArray(item.selectedVariations)) {
    item.selectedVariations.forEach((group: SelectedVariationGroup) => {
      if (group.variations && Array.isArray(group.variations)) {
        group.variations.forEach((variation: PrintableVariation) => {
          const additionalPrice = variation.additionalPrice || 0;
          const quantity = variation.quantity || 1;
          if (additionalPrice > 0) {
            variationsTotal += additionalPrice * quantity * item.quantity;
          }
        });
      }
    });
  }

  // Adiciona preço da borda recheada
  if (item.selectedBorder && item.selectedBorder.additionalPrice > 0) {
    variationsTotal += item.selectedBorder.additionalPrice * item.quantity;
  }

  return basePrice + variationsTotal;
};

// Tipagem da ponte exposta pelo preload do Electron (impressão silenciosa)
declare global {
  interface Window {
    electronPrint?: {
      printSilent: (html: string) => void;
    };
  }
}

// Configuração "Imprimir Canhoto" (cache local para impressão instantânea; padrão: ligado)
const CANHOTO_CACHE_KEY = "imprimir_canhoto";
export const getPrintCanhotoCache = (): boolean => {
  try {
    return localStorage.getItem(CANHOTO_CACHE_KEY) !== "false";
  } catch {
    return true;
  }
};
export const setPrintCanhotoCache = (enabled: boolean) => {
  try {
    localStorage.setItem(CANHOTO_CACHE_KEY, enabled ? "true" : "false");
  } catch { /* ignore */ }
};
const refreshPrintCanhotoCache = async () => {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "imprimir_canhoto")
      .maybeSingle();
    if (data) setPrintCanhotoCache(data.valor !== "false");
  } catch { /* mantém cache */ }
};

// Tamanhos de fonte da comanda (cache local + banco: chave comanda_font_sizes)
export type ComandaFontSizes = {
  mesa: number; cabecalho: number; resumo: number; cliente: number; produtos: number;
  sabores: number; observacoes: number; troco: number; total: number; rodape: number;
  canhotoTitulo: number; canhotoInformacoes: number; canhotoDestaque: number; canhotoData: number;
};
export const DEFAULT_COMANDA_FONT_SIZES: ComandaFontSizes = {
  mesa: 28, cabecalho: 14, resumo: 12, cliente: 11, produtos: 12,
  sabores: 11, observacoes: 12, troco: 13, total: 16, rodape: 9,
  canhotoTitulo: 15, canhotoInformacoes: 13, canhotoDestaque: 15, canhotoData: 10,
};
export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 36;
const FONT_CACHE_KEY = "comanda_font_sizes";
export const normalizeComandaFontSizes = (raw: unknown): ComandaFontSizes => {
  const out = { ...DEFAULT_COMANDA_FONT_SIZES };
  if (raw && typeof raw === "object") {
    (Object.keys(out) as (keyof ComandaFontSizes)[]).forEach((k) => {
      const v = Number((raw as Record<string, unknown>)[k]);
      if (Number.isFinite(v)) out[k] = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(v)));
    });
  }
  return out;
};
export const getComandaFontSizes = (): ComandaFontSizes => {
  try {
    const raw = localStorage.getItem(FONT_CACHE_KEY);
    return normalizeComandaFontSizes(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_COMANDA_FONT_SIZES };
  }
};
export const setComandaFontSizesCache = (sizes: ComandaFontSizes) => {
  try { localStorage.setItem(FONT_CACHE_KEY, JSON.stringify(sizes)); } catch { /* ignore */ }
};
const refreshComandaFontSizesCache = async () => {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.from("configuracoes").select("valor").eq("chave", FONT_CACHE_KEY).maybeSingle();
    if (data?.valor) setComandaFontSizesCache(normalizeComandaFontSizes(JSON.parse(data.valor)));
  } catch { /* mantém cache */ }
};

// Pedido completo de exemplo (simulador e impressão de teste)
export const SAMPLE_PRINT_ORDER = {
  id: "a1b2c3d4-0000-0000-0000-000000000000",
  createdAt: new Date().toISOString(),
  customerName: "Cliente Exemplo",
  customerPhone: "(11) 99999-0000",
  address: "Rua das Flores, 123 - Centro",
  paymentMethod: "cash",
  changeFor: 100,
  origem: "salao",
  mesa: 4,
  subtotal: 82,
  discount: 8.2,
  total: 73.8,
  items: [
    {
      id: "p1", name: "Pizza Meio a Meio", quantity: 1, price: 58, category: "Pizzas",
      isHalfPizza: true,
      combination: { sabor1: { name: "Calabresa" }, sabor2: { name: "Frango c/ Catupiry" } },
      selectedVariations: [{ groupId: "g1", groupName: "Adicionais", variations: [
        { variationId: "v1", name: "Bacon", quantity: 1, additionalPrice: 4, halfSelection: "half1" },
        { variationId: "v2", name: "Cebola", quantity: 1, additionalPrice: 0, halfSelection: "whole" },
      ] }],
      selectedBorder: { id: "b1", name: "Catupiry", additionalPrice: 8 },
      itemObservation: "Sem orégano, bem assada",
    },
    { id: "e1", name: "Esfiha Aberta de Carne", quantity: 2, price: 6, category: "Esfihas" },
  ],
} as unknown as Order;

export const printTestOrder = () => printOrder(SAMPLE_PRINT_ORDER);

// Função principal para imprimir o pedido
export const printOrder = (order: Order) => sendToPrinter(buildOrderPrintHtml(order));

export const buildOrderPrintHtml = (order: Order, fs: ComandaFontSizes = getComandaFontSizes(), includeCanhoto: boolean = getPrintCanhotoCache()) => {
  const shortOrderCode = String(order.id).substring(0, 6);


  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Pedido #${shortOrderCode}</title>
      <style>
        @page {
          size: auto;
          margin: 0;
        }

        html, body {
          width: 72mm;
          height: auto;
          margin: 0;
          padding: 2mm;
          overflow: visible;
          font-family: Arial, sans-serif;
          font-size: 11px;
          color: #000;
          box-sizing: border-box;
        }

        * {
          box-sizing: border-box;
        }

        .header {
          text-align: center;
          border-bottom: 1px dashed #000;
          margin-bottom: 6px;
          padding-bottom: 4px;
        }

        .header h1 {
          font-size: 14px;
          margin: 0;
          text-transform: uppercase;
        }

        .header h2 {
          font-size: 12px;
          margin: 2px 0 0 0;
        }

        .order-info {
          margin-bottom: 6px;
        }

        .order-info div {
          margin-bottom: 2px;
        }

        .items-head {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .5px;
          border-top: 2px solid #000;
          border-bottom: 1px solid #000;
          padding: 3px 0;
          font-weight: bold;
        }

        .category-title {
          margin-top: 6px;
          padding: 3px 0;
          font-weight: bold;
          font-size: 12px;
          text-transform: uppercase;
          text-align: center;
          border-top: 1px solid #000;
          border-bottom: 1px solid #000;
        }

        .item-block {
          padding: 5px 0;
          border-bottom: 1px dashed #999;
        }

        .item-main {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 6px;
        }

        .item-title {
          font-size: 12px;
          font-weight: bold;
          flex: 1;
        }

        .item-qty {
          font-weight: bold;
          margin-right: 4px;
        }

        .item-values {
          text-align: right;
          font-size: 11px;
          white-space: nowrap;
        }

        .item-combination {
          font-size: 11px;
          margin-top: 1px;
        }

        .sub-label {
          font-size: 10px;
          font-weight: bold;
          margin: 3px 0 1px 14px;
        }

        .sub-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          margin-left: 14px;
          gap: 6px;
        }

        .sub-row .price {
          white-space: nowrap;
          font-weight: bold;
        }

        .separator {
          border-top: 2px solid #000;
          margin: 4px 0;
        }

        .separator-thin {
          border-top: 1px solid #000;
          margin: 3px 0;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 12px;
        }

        .summary-row strong {
          font-weight: bold;
        }

        .summary-row.total-final {
          font-size: 16px;
          font-weight: bold;
          text-align: center;
          justify-content: center;
          gap: 8px;
          padding: 8px 0;
        }

        .order-observations {
          margin-top: 6px;
          padding: 6px 0;
          border-top: 1px solid #000;
          font-size: 12.1px;
          line-height: 1.35;
        }


        .footer {
          margin-top: 6px;
          text-align: left;
          font-size: 9px;
          border-top: 1px dashed #ccc;
          padding-top: 4px;
          color: #666;
        }

        .cut-line {
          margin-top: 10px;
          text-align: center;
          font-size: 11px;
          font-weight: bold;
          white-space: nowrap;
          overflow: hidden;
        }

        .stub {
          padding-top: 6px;
          line-height: 1.35;
        }

        .stub-title {
          text-align: center;
          font-weight: bold;
          margin-bottom: 6px;
        }

        .stub-row {
          margin-bottom: 5px;
        }

        .stub-highlight {
          font-weight: bold;
        }

        .stub-date {
        }
        .mesa-destaque { border:3px solid #000; text-align:center; font-weight:900; padding:6px; margin-bottom:8px; font-size:${fs.mesa}px; }
        .header h1 { font-size:${fs.cabecalho}px; }
        .header h2, .summary-row { font-size:${fs.resumo}px; }
        .order-info { font-size:${fs.cliente}px; }
        .category-title, .item-title { font-size:${fs.produtos}px; }
        .item-combination, .sub-row, .item-values { font-size:${fs.sabores}px; }
        .sub-label { font-size:${Math.max(8, fs.sabores - 1)}px; }
        .item-observation { margin:4px 0 0 14px; white-space:pre-wrap; word-break:break-word; line-height:1.3; font-size:${fs.sabores + 2}px; }
        .order-observations { font-size:${fs.observacoes}px; }
        .order-observations.troco { font-size:${fs.troco}px; }
        .summary-row.total-final { font-size:${fs.total}px; }
        .footer { font-size:${fs.rodape}px; }
        .stub { font-size:${fs.canhotoInformacoes}px; }
        .stub-title { font-size:${fs.canhotoTitulo}px; }
        .stub-highlight { font-size:${fs.canhotoDestaque}px; }
        .stub-date { font-size:${fs.canhotoData}px; }
      </style>
    </head>
    <body>
      ${order.origem === "salao" && order.mesa ? `<div class="mesa-destaque">MESA ${order.mesa} - SALÃO</div>` : ""}
      <div class="header">
        <h1>Comanda de Pedido</h1>
        <h2>Pedido #${shortOrderCode}</h2>
      </div>

      <div class="order-info">
        <div><strong>Data:</strong> ${formatDate(order.createdAt as string)}</div>
        <div><strong>Cliente:</strong> ${order.customerName}</div>
        <div><strong>Telefone:</strong> ${order.customerPhone}</div>
        <div><strong>Endereço:</strong> ${order.address}</div>
        <div><strong>Pagamento:</strong> ${translatePaymentMethod(order.paymentMethod)}</div>
      </div>

      <!-- ITENS -->
      <div class="items-head">
        <span>Item</span>
        <span>Qtd &nbsp; Subtotal</span>
      </div>
      ${groupOrderItemsByCategory(order.items).map(group => `
        <div class="category-title">${group.name}</div>
        ${group.items.map(item => {
        const itemSubtotal = item.subtotal ?? calculateItemSubtotal(item);
        const comb: any = item.combination;
        // Coleta adicionais com metade e preço
        const adicionais: { name: string; price: number }[] = [];
        if (item.selectedVariations && Array.isArray(item.selectedVariations)) {
          item.selectedVariations.forEach((group: SelectedVariationGroup) => {
            if (group.variations && Array.isArray(group.variations)) {
              group.variations.forEach((v: PrintableVariation) => {
                const qty = v.quantity || 1;
                const isWhole = v.halfSelection === 'whole';
                const halfLabel = !item.isHalfPizza || !v.halfSelection ? '' :
                  v.halfSelection === 'half1' || v.halfSelection === 'first' ? ` — 1/2 ${comb?.sabor1?.name ?? 'Metade 1'}` :
                  v.halfSelection === 'half2' || v.halfSelection === 'second' ? ` — 1/2 ${comb?.sabor2?.name ?? 'Metade 2'}` :
                  isWhole ? ' — Pizza inteira' : '';

                adicionais.push({
                  name: `${qty}x ${v.name || ''}${halfLabel}`,
                  price: (v.additionalPrice || 0) * qty * (item.isHalfPizza && isWhole ? 2 : 1),
                });
              });
            }
          });
        }

        const adicionaisComPreco = adicionais.filter(a => a.price > 0);
        const hasBorda = !!item.selectedBorder && item.selectedBorder.additionalPrice > 0;

        return `
          <div class="item-block">
            <div class="item-main">
              <div class="item-title">
                <span class="item-qty">${item.quantity}x</span>${getOrderItemDisplayName(item)}
              </div>
              <div class="item-values">
                ${item.quantity} &nbsp; <strong>R$ ${itemSubtotal.toFixed(2).replace('.', ',')}</strong>
                <div>Unit: R$ ${(item.price || 0).toFixed(2).replace('.', ',')}</div>
              </div>
            </div>

            ${adicionaisComPreco.length ? `
              <div class="sub-label">Adicionais:</div>
              ${adicionaisComPreco.map(a => `
                <div class="sub-row">
                  <span>${a.name}</span>
                  <span class="price">+R$ ${(a.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                </div>
              `).join('')}
            ` : ''}

            ${hasBorda ? `
              <div class="sub-row" style="margin-top:3px;">
                <span><strong>Borda Recheada:</strong> ${item.selectedBorder!.name}</span>
                <span class="price">+R$ ${(item.selectedBorder!.additionalPrice * item.quantity).toFixed(2).replace('.', ',')}</span>
              </div>
            ` : ''}

            ${item.itemObservation && item.itemObservation.trim() ? `
              <div class="item-observation"><strong>Observação:</strong> ${item.itemObservation.trim()}</div>
            ` : ''}
          </div>
        `;
        }).join('')}
      `).join('')}


      <!-- RESUMO FINANCEIRO -->
      ${(order.discount && order.discount > 0) ? `
        <div class="summary-row">
          <strong>Desconto</strong>
          <span>- R$ ${order.discount.toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="separator-thin"></div>
      ` : ''}

      ${order.subtotal ? `
        <div class="summary-row">
          <strong>Sub Total</strong>
          <span style="font-weight:bold;">R$ ${order.subtotal.toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="separator-thin"></div>
      ` : ''}

      ${(order.frete && order.frete > 0) ? `
        <div class="summary-row">
          <strong>Frete</strong>
          <span style="font-weight:bold;">R$ ${order.frete.toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="separator-thin"></div>
      ` : ''}

      <div class="summary-row total-final">
        <span>TOTAL  -  R$ ${order.total.toFixed(2).replace('.', ',')}</span>
      </div>


      ${order.paymentMethod === 'cash' && order.changeFor != null && Number(order.changeFor) > 0 ? `
        <div class="order-observations troco">
          <strong>Troco para:</strong> R$ ${Number(order.changeFor).toFixed(2).replace('.', ',')} (levar R$ ${(Number(order.changeFor) - (order.total || 0)).toFixed(2).replace('.', ',')})
        </div>
      ` : ''}

      <div class="footer">
        ${new Date().toLocaleString('pt-BR')}
      </div>

      ${includeCanhoto ? `
        <div class="cut-line">-------&gt;&nbsp; CORTE AQUI &nbsp;&lt;-------</div>
        <div class="stub">
          <div class="stub-title">* Canhoto de Entrega *</div>
          <div class="stub-row">Pedido: <strong class="stub-highlight">${shortOrderCode}</strong> <span class="stub-date">${formatDate(order.createdAt as string)}</span></div>
          <div class="stub-row">Cliente: <strong>${order.customerName || ''}</strong></div>
          <div class="stub-row">Telefone: <strong>${order.customerPhone || ''}</strong></div>
          ${order.origem === "salao" && order.mesa
            ? `<div class="stub-row"><strong>MESA ${order.mesa} - SALÃO</strong></div>`
            : `<div class="stub-row"><strong>${order.address || ''}</strong></div>`}
          <div class="stub-row">TOTAL: <strong class="stub-highlight">R$ ${(order.total || 0).toFixed(2).replace('.', ',')}</strong></div>
          <div class="stub-row">Pagamento: <strong>${String(translatePaymentMethod(order.paymentMethod) || '').toUpperCase()}</strong></div>
          ${order.paymentMethod === 'cash' && order.changeFor != null && Number(order.changeFor) > 0 ? `
            <div class="stub-row">Troco para: <strong>R$ ${Number(order.changeFor).toFixed(2).replace('.', ',')}</strong></div>
          ` : ''}
        </div>
      ` : ''}
    </body>
    </html>
  `;
  return printContent;
};

const sendToPrinter = (printContent: string) => {
  // Dentro do Electron com ponte de impressão configurada: imprime direto,
  // sem abrir a janela de confirmação do sistema.
  if (window.electronPrint?.printSilent) {
    window.electronPrint.printSilent(printContent);
    return;
  }

  const printFrame = document.createElement('iframe');
  printFrame.setAttribute('aria-hidden', 'true');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '1px';
  printFrame.style.height = '1px';
  printFrame.style.border = '0';
  printFrame.style.opacity = '0';
  printFrame.style.pointerEvents = 'none';
  document.body.appendChild(printFrame);

  const cleanup = () => {
    setTimeout(() => {
      if (printFrame.parentNode) {
        document.body.removeChild(printFrame);
      }
    }, 3000);
  };

  const triggerPrint = () => {
    const targetWindow = printFrame.contentWindow;
    const targetDocument = targetWindow?.document;
    if (!targetWindow || !targetDocument) return;

    targetWindow.focus();
    targetDocument.body.style.height = "auto";
    targetDocument.body.style.overflow = "visible";

    setTimeout(() => {
      targetWindow.print();
      cleanup();
    }, 500);
  };

  const frameDoc = printFrame.contentWindow?.document;
  if (frameDoc) {
    frameDoc.open();
    frameDoc.write(printContent);
    frameDoc.close();

    if (frameDoc.readyState === "complete") {
      triggerPrint();
    } else {
      printFrame.onload = triggerPrint;
    }
  } else {
    cleanup();
  }
};

/** Imprime garantindo que cada item tenha a categoria resolvida (inclusive pedidos antigos). */
export const printOrderWithCategories = async (order: Order) => {
  await Promise.all([refreshPrintCanhotoCache(), refreshComandaFontSizesCache()]);
  try {
    const enriched = await enrichOrderWithCategories(order);
    printOrder(enriched);
  } catch {
    printOrder(order);
  }
};
