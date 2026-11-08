import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";
import { supabase } from "@/integrations/supabase/client";

interface Empresa {
  nome?: string;
  cnpj?: string;
  telefone?: string;
  whatsapp?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-base font-semibold">{title}</h2>
    <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">{children}</div>
  </section>
);

const PoliticaPrivacidade: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useLayoutSettings();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  useEffect(() => {
    document.title = "Política de Privacidade";
    (async () => {
      const { data } = await supabase
        .from("empresa_info")
        .select("nome,cnpj,telefone,whatsapp,rua,numero,bairro,cidade,estado")
        .limit(1)
        .maybeSingle();
      if (data) setEmpresa(data as Empresa);
    })();
  }, []);

  const nome = empresa?.nome || settings.empresa_nome || "o Restaurante";
  const endereco = [
    empresa?.rua && empresa?.numero ? `${empresa.rua}, ${empresa.numero}` : empresa?.rua,
    empresa?.bairro,
    empresa?.cidade && empresa?.estado ? `${empresa.cidade}/${empresa.estado}` : empresa?.cidade,
  ]
    .filter(Boolean)
    .join(" - ");
  const contato = empresa?.whatsapp || empresa?.telefone;

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: settings.cor_background }}>
      <div className="sticky top-0 z-10 border-b" style={{ backgroundColor: settings.cor_background_header }}>
        <div className="container mx-auto px-4 py-3 flex items-center gap-3 max-w-[720px]">
          <Button variant="ghost" size="icon" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}>
            <ArrowLeft className="h-5 w-5" style={{ color: settings.cor_fonte }} />
          </Button>
          <h1 className="text-lg font-bold" style={{ color: settings.cor_fonte }}>
            Política de Privacidade
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-[720px]">
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 shrink-0" />
              <p className="text-sm text-muted-foreground">
                Esta política explica como seus dados pessoais são tratados ao usar o cardápio digital de{" "}
                <strong className="text-foreground">{nome}</strong>, em conformidade com a Lei Geral de Proteção de
                Dados (Lei nº 13.709/2018 – LGPD).
              </p>
            </div>

            <Section title="1. Quem é responsável pelos seus dados">
              <p>
                <strong className="text-foreground">Controlador:</strong> {nome}
                {empresa?.cnpj && `, CNPJ ${empresa.cnpj}`}
                {endereco && `, com endereço em ${endereco}`}. É quem decide como e por que seus dados são usados para
                vender e entregar seus pedidos.
              </p>
              <p>
                <strong className="text-foreground">Operador:</strong> a empresa fornecedora da plataforma tecnológica
                do cardápio digital, que trata os dados apenas em nome do restaurante, seguindo suas instruções, para
                hospedagem, funcionamento e segurança do sistema.
              </p>
            </Section>

            <Section title="2. Quais dados coletamos">
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-foreground">Cadastro:</strong> nome, e-mail, telefone/WhatsApp e senha (armazenada de forma criptografada).</li>
                <li><strong className="text-foreground">Entrega:</strong> endereço, bairro, cidade, CEP e complemento.</li>
                <li><strong className="text-foreground">Pedidos:</strong> itens, valores, forma de pagamento, cupons e histórico de compras.</li>
                <li><strong className="text-foreground">Navegação:</strong> produtos visualizados, itens adicionados ao carrinho, origem do acesso (ex.: Google, Instagram, campanhas), tipo de dispositivo e cidade aproximada.</li>
              </ul>
            </Section>

            <Section title="3. Para que usamos seus dados">
              <ul className="list-disc pl-5 space-y-1">
                <li>Processar, preparar e entregar seus pedidos (execução de contrato).</li>
                <li>Enviar atualizações do pedido e confirmações pelo WhatsApp.</li>
                <li>Gerenciar o programa de fidelidade, cupons e recompensas.</li>
                <li>Cumprir obrigações legais e fiscais (ex.: emissão de documentos).</li>
                <li>Melhorar o cardápio, entender o uso do app e medir campanhas (legítimo interesse).</li>
                <li>Enviar ofertas e lembretes, como de carrinho abandonado, sempre com opção de não receber.</li>
              </ul>
            </Section>

            <Section title="4. Com quem compartilhamos">
              <p>Não vendemos seus dados. Eles são compartilhados apenas quando necessário:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Entregadores: nome, telefone e endereço, somente para realizar a entrega.</li>
                <li>Provedores de pagamento, para processar transações com segurança.</li>
                <li>Serviços de tecnologia (hospedagem, banco de dados, mensagens) que operam a plataforma.</li>
                <li>Ferramentas de análise e anúncios (ex.: Google Analytics, Meta), com dados de navegação.</li>
                <li>Autoridades públicas, quando exigido por lei.</li>
              </ul>
            </Section>

            <Section title="5. Cookies e tecnologias semelhantes">
              <p>
                Usamos armazenamento local do navegador e cookies para manter seu login, seu carrinho e medir o uso do
                cardápio. Você pode limpá-los a qualquer momento nas configurações do seu navegador.
              </p>
            </Section>

            <Section title="6. Por quanto tempo guardamos">
              <p>
                Mantemos os dados enquanto sua conta estiver ativa ou pelo tempo necessário para cumprir obrigações
                legais e fiscais. Após esse período, os dados são excluídos ou anonimizados.
              </p>
            </Section>

            <Section title="7. Segurança">
              <p>
                Adotamos medidas técnicas e administrativas para proteger seus dados, como conexão criptografada
                (HTTPS), controle de acesso restrito e armazenamento seguro de senhas.
              </p>
            </Section>

            <Section title="8. Seus direitos">
              <p>Pela LGPD, você pode a qualquer momento:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Confirmar se tratamos seus dados e acessá-los;</li>
                <li>Corrigir dados incompletos ou desatualizados;</li>
                <li>Solicitar a exclusão da sua conta e dos seus dados;</li>
                <li>Revogar consentimentos e deixar de receber mensagens promocionais;</li>
                <li>Solicitar a portabilidade dos seus dados.</li>
              </ul>
            </Section>

            <Section title="9. Contato">
              <p>
                Para exercer seus direitos ou tirar dúvidas, fale com {nome}
                {contato ? ` pelo telefone/WhatsApp ${contato}` : " pelos canais informados na página de informações"}.
              </p>
            </Section>

            <Section title="10. Alterações">
              <p>
                Esta política pode ser atualizada. A versão vigente estará sempre disponível nesta página.
              </p>
              <p className="text-xs">Última atualização: outubro de 2026.</p>
            </Section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PoliticaPrivacidade;
