# Corrigir nomes de pizzas meio a meio

## Objetivo
Exibir cada pizza meio a meio uma única vez, no formato `1/2 Sabor 1 + 1/2 Sabor 2 (Tamanho)`, sem mudar preços, adicionais, quantidades, dados salvos ou o fluxo do pedido.

## Alterações
- Criar uma função única de apresentação para formar o nome da pizza pela combinação já salva.
- Aplicar essa apresentação no carrinho e no resumo do checkout, removendo as linhas repetidas apenas para pizzas meio a meio.
- Aplicar a mesma apresentação nos detalhes do pedido e na impressão da comanda.
- Manter adicionais, borda, observação, preço e subtotal nas posições e cálculos atuais.
- Preservar o nome original como alternativa para pedidos antigos sem dados completos da combinação.

## Validação
- Conferir pizzas comuns e meio a meio nas quatro telas/saídas.
- Confirmar que a comanda mostra somente `1x 1/2 Atum + 1/2 Mussarela (Grande)` no título do exemplo.
- Confirmar que o projeto continua compilando sem erros.

## Detalhes técnicos
A correção será exclusivamente de formatação visual. O objeto do carrinho e o conteúdo gravado nos pedidos permanecerão inalterados para evitar impacto no funcionamento existente.
