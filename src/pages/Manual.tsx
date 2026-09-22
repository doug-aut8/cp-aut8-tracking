import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BookOpen as PageIcon } from "lucide-react";
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  ArrowLeft,
  Building2,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Info,
  UtensilsCrossed,
  ShoppingBag,
  Ticket,
  Award,
  Megaphone,
  BarChart3,
  Brain,
  Settings,
  Palette,
  Image as ImageIcon,
  Download,
  Bike,
  Store,
  Printer,
} from "lucide-react";

const Manual = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <AdminPageHeader title="Manual do Administrador" icon={PageIcon} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
      <p className="text-muted-foreground text-sm text-center mb-6">
        Um guia simples, passo a passo, para você configurar sua loja sem dor de cabeça.
      </p>

      {/* Aviso importante */}
      <Card className="mb-6 border-amber-300 bg-amber-50">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <CardTitle className="text-amber-900 text-lg">Comece por aqui, é muito importante!</CardTitle>
            <CardDescription className="text-amber-800">
              Antes de qualquer outra coisa, configure as duas primeiras seções abaixo:{" "}
              <strong>Minha Empresa</strong> e <strong>Logística</strong>. Se elas não estiverem
              preenchidas corretamente, o site pode apresentar erros e os clientes não conseguirão
              fazer pedidos.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Accordion type="single" collapsible defaultValue="minha-empresa" className="space-y-3">
        {/* 1 - MINHA EMPRESA */}
        <AccordionItem value="minha-empresa" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-orange-100 rounded-full">
                <Building2 className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="font-semibold text-lg">1. Minha Empresa</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Os dados básicos do seu restaurante
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p>
              É aqui que você diz ao sistema <strong>quem é o seu restaurante</strong> e{" "}
              <strong>onde ele fica</strong>. Essas informações aparecem para o cliente e também
              são usadas para calcular a entrega. Sem elas, o cálculo de frete não funciona.
            </p>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Info className="h-4 w-4" /> Como chegar nesta página
              </h3>
              <p className="text-sm">
                No Painel de Administração, clique no card <strong>"Minha Empresa"</strong>.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Passo a passo</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>
                  <strong>Nome do restaurante:</strong> escreva o nome que o cliente vai ver.
                </li>
                <li>
                  <strong>Telefone e WhatsApp:</strong> coloque os números de contato. O WhatsApp é
                  usado quando o cliente quiser falar com você.
                </li>
                <li>
                  <strong>Endereço completo:</strong> preencha o CEP primeiro. O sistema tenta
                  preencher rua, bairro, cidade e estado automaticamente. Depois é só colocar o
                  número e, se precisar, o complemento.
                </li>
                <li>
                  <strong>Horários de funcionamento:</strong> marque os dias em que a loja abre e
                  os horários de abertura e fechamento. Nos dias que a loja fica fechada, marque a
                  opção "Fechado".
                </li>
                <li>
                  Clique em <strong>Salvar</strong>. Pronto!
                </li>
              </ol>
            </div>

            <div className="border-l-4 border-red-500 bg-red-50 p-3 rounded">
              <p className="text-sm text-red-900">
                <strong>Atenção:</strong> o endereço precisa estar correto, pois é dele que o
                sistema mede a distância até o cliente para calcular a entrega. Um endereço errado
                = frete errado.
              </p>
            </div>

            <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded">
              <p className="text-sm text-green-900 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Dica:</strong> os horários controlam quando a loja aparece como
                  "Aberta" ou "Fechada" no site. Fora do horário, o cliente não consegue finalizar
                  pedido.
                </span>
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 2 - LOGÍSTICA */}
        <AccordionItem value="logistica" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-red-100 rounded-full">
                <Truck className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="font-semibold text-lg">2. Logística (Entrega e Frete)</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Como o valor do frete é calculado
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p>
              Aqui você define <strong>quanto o cliente vai pagar de entrega</strong>. Sem essa
              configuração, o cliente vai ver R$ 0,00 de frete (ou erro no checkout) e você pode
              acabar entregando de graça sem querer.
            </p>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Info className="h-4 w-4" /> Como chegar nesta página
              </h3>
              <p className="text-sm">
                No Painel de Administração, clique no card <strong>"Logística"</strong>.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Escolha um dos 3 modelos de frete</h3>
              <p className="text-sm mb-3">
                Você só precisa escolher <strong>um</strong>. Marque a opção desejada no topo da
                página.
              </p>

              <div className="space-y-3">
                <div className="border rounded-lg p-3">
                  <p className="font-semibold">Opção A — Frete por Quilometragem (mais simples)</p>
                  <p className="text-sm mt-1">
                    Você define faixas de distância e o valor de cada uma. Exemplo:
                  </p>
                  <ul className="list-disc list-inside text-sm mt-2 space-y-1 text-muted-foreground">
                    <li>De 0 a 3 km: R$ 5,00</li>
                    <li>De 3 a 6 km: R$ 8,00</li>
                    <li>De 6 a 10 km: R$ 12,00</li>
                  </ul>
                  <p className="text-sm mt-2">
                    Clique em <strong>"Adicionar Faixa"</strong> para criar quantas faixas quiser e
                    depois em <strong>Salvar</strong>.
                  </p>
                </div>

                <div className="border rounded-lg p-3">
                  <p className="font-semibold">Opção B — Frete por CEP / Distância</p>
                  <p className="text-sm mt-1">
                    O sistema calcula a distância real entre a sua loja e o cliente e cobra
                    conforme as faixas de quilometragem que você definir. É mais preciso, mas
                    depende do endereço da loja estar correto na página "Minha Empresa".
                  </p>
                </div>

                <div className="border rounded-lg p-3">
                  <p className="font-semibold">Opção C — Superfrete (para envio pelos Correios)</p>
                  <p className="text-sm mt-1">
                    Útil se você envia produtos pelos Correios (PAC, SEDEX, Mini Envios). Precisa
                    de uma conta no Superfrete e do token. Também é necessário informar peso e
                    medidas padrão da encomenda.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">CEPs Especiais (opcional)</h3>
              <p className="text-sm">
                Se você quer cobrar um valor específico para algum bairro ou CEP (por exemplo,
                uma região mais complicada), cadastre esses CEPs na seção{" "}
                <strong>"CEPs Especiais"</strong>. Esses valores substituem o cálculo automático
                sempre que o cliente for daquele CEP.
              </p>
            </div>

            <div className="border-l-4 border-red-500 bg-red-50 p-3 rounded">
              <p className="text-sm text-red-900">
                <strong>Atenção:</strong> se nenhuma faixa cobrir a distância do cliente, o
                sistema não consegue calcular o frete e o pedido pode travar. Certifique-se de que
                as faixas cobrem toda a área que você atende.
              </p>
            </div>

            <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded">
              <p className="text-sm text-green-900 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Dica:</strong> comece pelo modelo mais simples (Quilometragem). Você
                  pode mudar depois se precisar.
                </span>
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 3 - CARDÁPIO */}
        <AccordionItem value="cardapio" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-emerald-100 rounded-full">
                <UtensilsCrossed className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="font-semibold text-lg">3. Cardápio</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Cadastre categorias, pratos, variações e bordas de pizza
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p>
              O cardápio é o coração do seu site. É aqui que o cliente escolhe o que vai pedir.
              Acesse pelo card <strong>"Cardápio"</strong> no painel.
            </p>

            <div>
              <h3 className="font-semibold mb-2">Categorias</h3>
              <p className="text-sm">
                São os grupos do cardápio (Ex: Entradas, Pizzas, Bebidas, Sobremesas). Crie
                primeiro as categorias antes de cadastrar os pratos. Clique em{" "}
                <strong>"Adicionar Categoria"</strong>, dê um nome e salve. Você pode arrastar para
                mudar a ordem em que aparecem no site.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Pratos (Itens do cardápio)</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Clique na aba <strong>"Pratos"</strong> e depois em <strong>"Adicionar"</strong>.</li>
                <li>Preencha nome, descrição curta, preço e escolha a categoria.</li>
                <li>Envie uma foto boa do prato — imagens claras vendem muito mais.</li>
                <li>Se o prato tiver opções (tamanhos, sabores, adicionais), associe um Grupo de Variações.</li>
                <li>Salve. O prato já aparece no site imediatamente.</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Grupos de Variações</h3>
              <p className="text-sm">
                Servem para oferecer opções ao cliente. Exemplos: "Tamanho" (Pequena, Média,
                Grande), "Adicionais" (Bacon, Queijo extra), "Ponto da carne". Você cria o grupo,
                adiciona as variações com seus preços, e depois liga esse grupo aos pratos que usam
                essas opções.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Bordas de Pizza</h3>
              <p className="text-sm">
                Se você vende pizza, cadastre as bordas (Ex: Catupiry, Cheddar, Chocolate) com seus
                preços. Elas aparecem como opção quando o cliente monta a pizza.
              </p>
            </div>

            <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded">
              <p className="text-sm text-green-900 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Dica:</strong> use o botão de "ativar/desativar" em cada prato para
                  esconder itens que estão em falta, sem precisar apagar.
                </span>
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 4 - PEDIDOS */}
        <AccordionItem value="pedidos" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-blue-100 rounded-full">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-lg">4. Pedidos</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Receber, aceitar e acompanhar os pedidos dos clientes
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p>
              Acesse pelo card <strong>"Pedidos"</strong>. Essa tela mostra em tempo real todos os
              pedidos que chegam. Deixe essa aba aberta durante o expediente.
            </p>
            <div>
              <h3 className="font-semibold mb-2">Fluxo de um pedido</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Pedido chega → aparece no topo como <strong>"Novo"</strong>.</li>
                <li>Clique no pedido para ver os detalhes (itens, endereço, forma de pagamento).</li>
                <li>Clique em <strong>"Aceito"</strong> para confirmar. O cliente recebe o aviso.</li>
                <li>Prepare o pedido e clique em <strong>"Em preparo"</strong> e depois <strong>"Saiu para entrega"</strong>.</li>
                <li>Ao entregar, marque como <strong>"Concluído"</strong>.</li>
              </ol>
            </div>
            <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded">
              <p className="text-sm text-green-900 flex items-start gap-2">
                <Printer className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Impressão automática:</strong> se você configurou a impressora em modo
                  quiosque (kiosk), o pedido imprime sozinho ao chegar. Em{" "}
                  <strong>Configurações</strong> você também pode ligar/desligar a impressão
                  automática ao clicar em "Aceito".
                </span>
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 5 - PDV */}
        <AccordionItem value="pdv" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-indigo-100 rounded-full">
                <Store className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <div className="font-semibold text-lg">5. PDV (Balcão)</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Registre pedidos feitos no balcão ou por telefone
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p>
              O PDV é usado quando o cliente pede pessoalmente ou por telefone. Você monta o
              pedido pelo painel, escolhe os itens, informa forma de pagamento e finaliza. O
              pedido já entra como <strong>"Concluído"</strong> e conta nas suas vendas.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Clique no card <strong>"PDV"</strong>.</li>
              <li>Adicione os itens do cardápio ao carrinho.</li>
              <li>Informe (opcional) o nome do cliente e forma de pagamento.</li>
              <li>Clique em <strong>Finalizar</strong>. Imprima o comprovante, se quiser.</li>
            </ol>
          </AccordionContent>
        </AccordionItem>

        {/* 6 - ENTREGADOR */}
        <AccordionItem value="entregador" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-cyan-100 rounded-full">
                <Bike className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <div className="font-semibold text-lg">6. Entregador</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Tela para o motoboy acompanhar as entregas
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p>
              Essa tela é feita para o entregador usar no celular. Ele vê os pedidos que estão
              prontos para entrega, o endereço, e pode marcar como entregue quando concluir. Basta
              abrir <strong>/entregador</strong> no navegador do celular dele.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* 7 - CUPONS */}
        <AccordionItem value="cupons" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-pink-100 rounded-full">
                <Ticket className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <div className="font-semibold text-lg">7. Cupons de Desconto</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Crie promoções e descontos para atrair clientes
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p>
              Acesse pelo card <strong>"Cupons"</strong>. Você pode criar códigos como{" "}
              <em>BEMVINDO10</em> que dão desconto no carrinho.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Clique em <strong>"Novo Cupom"</strong>.</li>
              <li>Digite o código para o CUPOM (o cliente vai digitar esse código no checkout).</li>
              <li>Escolha o tipo:</li>
              <li style={{ listStyleType: 'none' }}><strong>Percentual</strong> (Ex: 10% de desconto)</li>
              <li style={{ listStyleType: 'none' }}><strong>Valor Fixo</strong> (Ex: R$ 15 desconto)</li>
              <li style={{ listStyleType: 'none' }}><strong>Frete Grátis</strong> (Frete R$0 para o pedido)</li>
              <li style={{ listStyleType: 'none' }}><strong>Compre e Ganhe</strong> (Se o cliente comprar um produto específico ou um produto dentro de uma categoria específica, ele ganha um brinde escolhido por você)</li>
              <li value={4}>Defina se o cupom será válido para todos os clientes ou apenas na 1a compra (clientes novos)</li>
              <li>Defina, se quiser, o valor mínimo do pedido e um limite de usos.</li>
              <li>Defina a data de validade do CUPOM</li>
              <li><strong>Salve</strong></li>
            </ol>
            <div className="border-l-4 border-amber-500 bg-amber-50 p-3 rounded">
              <p className="text-sm text-amber-900">
                <strong>Dica:</strong> divulgue seus cupons nas redes sociais. É a forma mais
                barata de trazer cliente novo.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 8 - FIDELIDADE */}
        <AccordionItem value="fidelidade" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-yellow-100 rounded-full">
                <Award className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="font-semibold text-lg">8. Fidelidade</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Recompense clientes que compram sempre
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p>
              O programa de fidelidade dá recompensas para clientes recorrentes. Um exemplo
              clássico: a cada 10 pizzas compradas, a 11ª é grátis.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Acesse o card <strong>"Fidelidade"</strong>.</li>
              <li>Ative o programa.</li>
              <li>Configure as regras: quantos pedidos/itens são necessários e qual a recompensa.</li>
              <li>Salve. O cliente passa a acompanhar o progresso automaticamente na conta dele.</li>
            </ol>
          </AccordionContent>
        </AccordionItem>

        {/* 9 - MARKETING */}
        <AccordionItem value="marketing" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-fuchsia-100 rounded-full">
                <Megaphone className="h-5 w-5 text-fuchsia-600" />
              </div>
              <div>
                <div className="font-semibold text-lg">9. Marketing</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Integrações com Google, Facebook e outras ferramentas
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p>
              Essa página conecta o seu site com as ferramentas de anúncio (Google Ads, Meta Ads).
              Isso ajuda a saber quais campanhas estão gerando vendas.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li><strong>Google Analytics (GA4):</strong> cole o ID de medição (começa com "G-").</li>
              <li><strong>Google Tag Manager:</strong> cole o ID do container (começa com "GTM-").</li>
              <li><strong>Pixel do Facebook / Meta:</strong> cole o ID do pixel.</li>
              <li><strong>API de Conversões (CAPI):</strong> ative para enviar eventos de compra direto do servidor (mais preciso).</li>
            </ul>
            <div className="border-l-4 border-amber-500 bg-amber-50 p-3 rounded">
              <p className="text-sm text-amber-900">
                Se você não faz anúncios, pode deixar tudo em branco. Não afeta o funcionamento do
                site.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 10 - MÉTRICAS */}
        <AccordionItem value="metricas" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-green-100 rounded-full">
                <BarChart3 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="font-semibold text-lg">10. Métricas</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Veja como sua loja está indo
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p>
              No card <strong>"Métricas"</strong> você acompanha os números do seu negócio:
              faturamento, ticket médio, pratos mais vendidos, horários de pico, novos clientes
              vs. recorrentes. Use os filtros de data para comparar períodos (Ex: essa semana vs.
              semana passada).
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* 11 - INTELIGÊNCIA */}
        <AccordionItem value="inteligencia" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-violet-100 rounded-full">
                <Brain className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <div className="font-semibold text-lg">11. Inteligência</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Insights automáticos sobre a sua loja
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p>
              É uma seção que analisa os seus dados e mostra recomendações simples: quais pratos
              estão vendendo mais, quais estão parados, sugestões de combos, comportamento de
              clientes. Use como apoio para decidir promoções e ajustes no cardápio.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* 12 - LAYOUT */}
        <AccordionItem value="layout" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-rose-100 rounded-full">
                <Palette className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <div className="font-semibold text-lg">12. Layout (Aparência)</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Personalize as cores, logo e a "cara" do seu site
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p>
              Acesse pelo card <strong>"Layout"</strong>. Aqui você deixa o site com a identidade
              da sua marca.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li><strong>Logo:</strong> envie a imagem do seu logotipo.</li>
              <li><strong>Cor principal (destaque):</strong> a cor dos botões e chamadas.</li>
              <li><strong>Cor do fundo:</strong> a cor de fundo das páginas.</li>
              <li><strong>Cor da Fonte:</strong> cor geral dos textos.</li>
              <li><strong>Cor dos Títulos das Seções:</strong> destaca os nomes das categorias.</li>
              <li><strong>Cor do Título do Produto:</strong> cor específica para o nome dos pratos.</li>
            </ul>
            <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded">
              <p className="text-sm text-green-900">
                <strong>Dica:</strong> teste combinações de cores que tenham bom contraste —
                textos claros em fundos escuros, e vice-versa. Assim o cliente lê tudo com
                facilidade.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 13 - BANNERS */}
        <AccordionItem value="banners" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-orange-100 rounded-full">
                <ImageIcon className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="font-semibold text-lg">13. Banners</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Aquelas imagens grandes do topo da página inicial
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p>
              Os banners são as chamadas visuais que aparecem no topo do site. Ótimos para
              destacar promoções, novidades ou um prato do dia.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Clique em <strong>"Novo Banner"</strong>.</li>
              <li>Envie uma imagem formato paisagem (Dimensão Sugerida - 1600 x 400)</li>
              <li>Defina, se quiser, o link que o cliente vai abrir ao clicar no banner (Ex: uma categoriaou um produto específico)</li>
              <li>Salve o banner </li>
            </ol>
          </AccordionContent>
        </AccordionItem>

        {/* 14 - EXPORTAÇÕES */}
        <AccordionItem value="exportacoes" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-slate-200 rounded-full">
                <Download className="h-5 w-5 text-slate-700" />
              </div>
              <div>
                <div className="font-semibold text-lg">14. Exportações</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Baixe planilhas de pedidos e clientes
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p>
              Nessa página você baixa arquivos (planilhas) com os pedidos, os clientes e outras
              informações. Útil para contabilidade, análises externas ou para enviar dados ao
              contador.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Escolha o tipo de dado (Pedidos, Clientes, etc.).</li>
              <li>Selecione o período desejado.</li>
              <li>Clique em <strong>Exportar</strong>. O arquivo baixa no computador.</li>
            </ol>
          </AccordionContent>
        </AccordionItem>

        {/* 15 - CONFIGURAÇÕES */}
        <AccordionItem value="configuracoes" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-gray-200 rounded-full">
                <Settings className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <div className="font-semibold text-lg">15. Configurações</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Ajustes gerais do sistema (impressão automática e mais)
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p>
              É a página de opções avançadas. O ajuste mais usado aqui é a{" "}
              <strong>Impressão Automática ao Aceitar</strong>: quando ligado, ao clicar em
              "Aceito" em um pedido, o comprovante já é enviado para a impressora. Desligue se você
              prefere imprimir manualmente.
            </p>
            <div className="border-l-4 border-amber-500 bg-amber-50 p-3 rounded">
              <p className="text-sm text-amber-900">
                Para a impressão automática funcionar sem clicar em nada, o Chrome precisa estar
                aberto no modo <strong>quiosque</strong> (com a opção{" "}
                <code>--kiosk-printing</code>). Peça ajuda técnica para configurar isso no
                computador da loja uma única vez.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card className="mt-8 bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">Precisa de ajuda?</CardTitle>
          <CardDescription>
            Volte a este manual sempre que precisar. Se ainda restar dúvida, entre em contato com
            o suporte técnico. Boas vendas!
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/minha-empresa">Minha Empresa</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/logistica">Logística</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin">Cardápio</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/layout">Layout</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Manual;
