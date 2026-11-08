# Atualizar categoria ativa durante a rolagem

## Objetivo
No `/cardapio-qr`, fazer o menu fixo destacar automaticamente a categoria cuja seção está sendo exibida enquanto o cliente rola a página.

## Implementação
- Observar a posição dos títulos das categorias em relação ao menu fixo.
- Atualizar a categoria ativa durante a rolagem manual, incluindo a primeira e a última seção.
- Manter o clique nas categorias com rolagem suave e evitar conflito entre o clique e a detecção automática.
- Validar no cardápio de mesa em viewport de celular.

## Escopo
A alteração será limitada ao cardápio de mesa; o cardápio normal continuará com o comportamento atual.
