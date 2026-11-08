# Relatório Completo de Vendas

Adicionar, dentro do modal "Detalhamento das Vendas" (aberto pelo botão "Detalhes" do card **Valor das Vendas**), um link **Relatório Completo** que abre um segundo modal listando todas as vendas do período selecionado.

## Comportamento

- O link aparece no rodapé do modal de Detalhamento das Vendas, abaixo do conteúdo existente.
- Ao clicar, abre um novo modal com o mesmo visual dos modais existentes (mesmo cabeçalho, botão vermelho de fechar, mesma tipografia e cores).
- O modal antigo permanece aberto atrás; ao fechar o relatório, o usuário volta ao detalhamento.

## Conteúdo do relatório

Lista de todas as vendas do período (respeitando também os filtros de origem e campanha já aplicados na página). Para cada venda:

- Data e hora
- Código do pedido
- Nome do cliente
- Quantidade de itens
- Valor total

Rodapé fixo com o total de pedidos e a soma de valores do mês exibido.

## Rolagem e paginação por mês

- Se o período selecionado abrange mais de um mês, o modal mostra um mês por vez, com navegação "‹ mês anterior / próximo mês ›" e o nome do mês no centro (ex.: "Setembro 2026"). Apenas meses dentro do período selecionado são navegáveis.
- Dentro de cada mês, a lista tem rolagem vertical própria, com o cabeçalho e a navegação fixos.
- Se o período couber em um único mês, a navegação não aparece.

## Detalhes técnicos

- `src/services/salesAnalyticsService.ts`: nova função `fetchSalesReport(startDate, endDate, sourceFilter, campaignFilter)` que busca em `pedidos_sabor_delivery` (`data_criacao`, `codigo_pedido`/`codigo_curto`, `nome_cliente`, `valor_total`, `itens`), aplicando os mesmos filtros de `fetchOrderCountDetail` (exclui `status_atual = 'cancelled'` e `valor_total <= 0`), retornando as linhas ordenadas por data decrescente com a contagem de itens já calculada.
- `src/pages/MarketingMetrics.tsx`: estados `salesReportOpen`, `salesReportRows`, `salesReportLoading` e `reportMonthIndex`; efeito que carrega o relatório quando o modal abre ou quando período/filtros mudam; agrupamento das linhas por mês via `date-fns` (`startOfMonth`/`format`) e reset do índice ao recarregar.
- Novo `Dialog` reutilizando as mesmas classes do modal de detalhamento; a lista usa um container `overflow-y-auto` com altura máxima.
