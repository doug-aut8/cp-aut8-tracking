import { Order, OrderItem, SelectedVariationGroup } from "@/types/order";

type PrintableVariation = {
  name?: string;
  quantity?: number;
  additionalPrice?: number;
  halfSelection?: "first" | "second" | "whole" | string;
};

const getDisplayName = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "name" in value) {
    return String((value as { name?: unknown }).name ?? "");
  }
  return String(value ?? "");
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
    payroll_discount: "Desconto em Folha"
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

// Função principal para imprimir o pedido
export const printOrder = (order: Order) => {
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Pedido #${order.id}</title>
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


        .footer {
          margin-top: 6px;
          text-align: left;
          font-size: 9px;
          border-top: 1px dashed #ccc;
          padding-top: 4px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Comanda de Pedido</h1>
        <h2>Pedido #${order.id}</h2>
      </div>

      <div class="order-info">
        <div><strong>Data:</strong> ${formatDate(order.createdAt as string)}</div>
        <div><strong>Cliente:</strong> ${order.customerName}</div>
        <div><strong>Telefone:</strong> ${order.customerPhone}</div>
        <div><strong>Endereço:</strong> ${order.address}</div>
        <div><strong>Pagamento:</strong> ${translatePaymentMethod(order.paymentMethod)}</div>
        ${order.observations ? `<div><strong>Obs.:</strong> ${order.observations}</div>` : ''}
      </div>

      <!-- ITENS -->
      <div class="items-head">
        <span>Item</span>
        <span>Qtd &nbsp; Subtotal</span>
      </div>
      ${order.items.map(item => {
        const itemSubtotal = item.subtotal ?? calculateItemSubtotal(item);
        const comb: any = item.combination;
        const combinationText = item.isHalfPizza && comb
          ? (comb.sabor1?.name
              ? `1/2 ${comb.sabor1?.name} + 1/2 ${comb.sabor2?.name ?? ''}`
              : Array.isArray(comb)
                ? comb.map(getDisplayName).map((n: string) => `1/2 ${n}`).join(' + ')
                : Array.isArray(comb.flavors)
                  ? comb.flavors.map(getDisplayName).map((n: string) => `1/2 ${n}`).join(' + ')
                  : '')
          : '';

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
                <span class="item-qty">${item.quantity}x</span>${item.name}
                ${combinationText ? `<div class="item-combination">${combinationText}</div>` : ''}
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
          </div>
        `;
      }).join('')}


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

      <div class="footer">
        ${new Date().toLocaleString('pt-BR')}
      </div>
    </body>
    </html>
  `;

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
