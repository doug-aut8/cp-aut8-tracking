# Roadmap

- [x] Separar custos de mídia, brindes e total em Campanhas, com toggle ligado por padrão e CMV dinâmico no período principal.
- [x] Validar cálculo (11 testes), troca de períodos, toggle e salvamento exclusivo de mídia com dados controlados; apresentação conferida em computador/celular.
- [ ] Conferir campanhas e salvamento com dados reais na conta administrativa — bloqueado: autenticação externa indisponível nesta prévia.

- [x] Incluir no modal de investimento o preenchimento automático do CMV dos brindes da campanha no período escolhido e validar o cálculo (5 testes aprovados).
- [x] Substituir o salvamento fixo de brindes pelo cálculo dinâmico no relatório; o modal registra somente mídia.

- [ ] Implementar apenas as métricas sem investimento: sessões, receita por visitante/sessão e taxa de utilização de cupons, com filtros e comparação.
- [ ] Testar cálculos e verificar a apresentação das novas métricas; cadastro de custos de campanha fora do escopo.

- [x] Adicionar Localizações com abas Bairros/Cidades e ranking responsivo por valor de vendas.
- [x] Exibir produtos e vendas da localização selecionada, respeitando os filtros, e testar agregações e apresentação isolada em computador/celular.
- [ ] Conferir o ranking com dados reais na conta administrativa — bloqueado: autenticação externa indisponível nesta prévia.

- [ ] Adicionar controle sincronizado Abrir/Fechar/Automático no Painel e Pedidos, integrado ao cardápio e checkout.
- [ ] Testar as três regras de funcionamento e verificar a apresentação do controle.

- [x] Restaurar a jornada histórica pelos eventos de compra, sem estimar o perfil de compradores sem vínculo exato, e testar a regressão.
- [x] Cruzar jornada de acesso com clientes novos/recorrentes no detalhamento de vendas, usando vínculos exatos nos novos eventos.
- [x] Exibir percentual de novos clientes e perfil predominante por campanha.
- [x] Testar classificação por histórico (primeira compra, cancelados, vínculos e limiar de 50%).
- [ ] Validar os relatórios com dados reais na conta administrativa — bloqueado: autenticação externa não disponível para testes nesta prévia.

- [x] Reorganizar Marketing Metrics em quatro abas com relatórios na página.
- [x] Integrar aquisição GA4 e mapas de horários, distinguindo as fontes e removendo Scroll to Goals.
- [x] Verificar navegação e apresentação isolada em computador e celular.
- [ ] Verificar filtros e leitura de dados reais com acesso administrativo — bloqueado: sessão autenticada indisponível nesta prévia.

- [x] Adicionar o card "Pedidos Finalizados" à aba Funil.
- [x] Ajustar o funil para exibir todas as etapas no mobile.
- [x] Conectar "Duração Média por Visita" às sessões de product_events, com filtros, limite de 30 minutos e comparativo.
- [x] Mover o filtro de localização para os filtros principais de Marketing-Metrics (Cidade em todas as abas; Bairro em vendas/produtos).
- [x] Registrar a cidade estimada dos visitantes nos eventos do site e aplicar o filtro nas abas Visitas e Funil.
- [x] Adicionar a configuração de cor do fundo da seção de pesquisa na página Layout.
- [x] Fixar a pesquisa junto ao menu de categorias durante a rolagem do cardápio.
- [x] Corrigir a rolagem ao abrir Bordas e grupos recolhíveis, inclusive quando estão no fim do modal.
- [x] Adicionar observações opcionais por item no modal, carrinho e pedido.
- [x] Compactar Bordas, Adicionais e Observações para aparecerem juntos na primeira dobra do modal.
- [x] Corrigir nomes duplicados de pizzas meio a meio no carrinho, checkout, detalhes e comanda.
- [x] Posicionar a observação geral do pedido no rodapé da comanda impressa.
- [x] Cardápio QR Code para mesas (/cardapio-qr, checkout da mesa, Configuração de Mesas, destaque na comanda).
- [x] Canhoto de entrega destacável na comanda com toggle em Configurações.
- [x] Adicionar controles separados para os tamanhos das fontes do canhoto.
- [x] Mostrar categorias após os nomes dos produtos no modal de cupons e adicionar Selecionar Todos/Nenhum às listas múltiplas.
- [x] Coletar dados de dispositivo (eventos e pedidos) e aba Dispositivos em Marketing Metrics.
