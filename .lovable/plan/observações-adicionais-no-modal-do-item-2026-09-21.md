# Observações adicionais no modal do item

## Objetivo
Adicionar, ao final das opções do produto no cardápio, uma seção recolhível **Observações**. Ao abrir, o cliente poderá digitar instruções no campo com o placeholder **“Alguma observação adicional?”**.

## Implementação
- Inserir o novo dropdown após Bordas e todos os grupos de variações, seguindo o mesmo visual e comportamento de rolagem das seções existentes.
- Manter a observação opcional e limpar o campo ao abrir um produto novo.
- Salvar o texto no item do carrinho, preservando-o ao recarregar e ao editar o item no checkout.
- Considerar observações diferentes como personalizações diferentes, evitando juntar automaticamente itens com instruções distintas.
- Enviar a observação junto aos dados do item no pedido e exibi-la no carrinho, checkout, detalhes do pedido e impressão.

## Validação
- Conferir abertura, digitação e rolagem em tela mobile.
- Confirmar que o texto permanece no carrinho, na edição e no pedido salvo.
- Verificar a compilação e a página sem erros.
