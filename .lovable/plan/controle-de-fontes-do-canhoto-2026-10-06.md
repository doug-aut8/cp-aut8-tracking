# Controle de fontes do canhoto

## Alterações
- Separar as configurações de fonte do canhoto das fontes da comanda.
- Adicionar controles para título, informações, destaque e data do canhoto na página de Impressão.
- Salvar os novos tamanhos junto às configurações existentes, preservando compatibilidade com valores já salvos.
- Aplicar os tamanhos na prévia de 72 mm, na impressão de teste e nas impressões reais.
- Incluir os novos campos em “Restaurar Padrões”.

## Validação
- Confirmar que os botões de aumentar e diminuir atualizam apenas a parte correspondente do canhoto.
- Confirmar que as configurações persistem e que a página continua compilando sem erros.

## Detalhes técnicos
- Expandir `ComandaFontSizes` e seus valores padrão no utilitário de impressão.
- Vincular as classes do canhoto aos novos valores no HTML térmico.
- Expor os novos campos na lista de controles da página de Impressão.
