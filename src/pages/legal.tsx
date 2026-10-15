import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

function LegalDraftNotice() {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
      Minuta para revisão.   
    </div>
  );
}

export function TermsOfUse() {
  return (
    <article className="mx-auto w-full max-w-3xl space-y-6">
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <p className="text-sm text-muted-foreground">Versão {TERMS_VERSION}</p>
          <h1 className="text-3xl font-extrabold">Termos de Utilização</h1>
          <p className="text-muted-foreground">VidGrab · Moçambique</p>
        </CardHeader>
        <CardContent className="space-y-6 leading-relaxed text-muted-foreground">
          <LegalDraftNotice />
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">1. Aceitação e responsável</h2>
            <p>
              Ao criar uma conta ou utilizar o VidGrab, aceita estes Termos e a nossa{" "}
              <Link href="/privacy" className="text-primary underline">Política de Privacidade</Link>.
              O serviço é operado por Aristides Nunes Vundo, com endereço e
              contacto a completar antes da publicação.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">2. Utilização permitida</h2>
            <p>
              Utilize o serviço apenas para conteúdos que tenha autorização para
              aceder e guardar, e de forma compatível com a legislação aplicável,
              os direitos de autor e os termos da plataforma de origem. É sua
              responsabilidade obter as autorizações necessárias.
            </p>
            <p>
              Não utilize o serviço para contornar controlos de acesso ou medidas
              técnicas, violar direitos de terceiros, distribuir conteúdo ilícito,
              abusar do serviço ou tentar perturbar, sondar ou comprometer os
              nossos sistemas.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">3. Conta e segurança</h2>
            <p>
              Forneça um endereço de email seu e mantenha a palavra-passe
              confidencial. É responsável pela atividade realizada através da
              sua conta. Podemos suspender acessos perante abuso ou risco de
              segurança, respeitando a lei aplicável.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">4. Serviço e limites</h2>
            <p>
              O serviço pode sofrer interrupções, alterações ou indisponibilidade.
              Os limites do plano gratuito são apresentados no perfil. O VidGrab
              não garante a disponibilidade de um vídeo, formato ou resultado
              específico.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">5. Serviços de terceiros</h2>
            <p>
              O VidGrab não é afiliado, patrocinado nem aprovado pelo YouTube.
              O acesso a plataformas e conteúdos de terceiros continua sujeito
              aos respetivos termos e políticas.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">6. Eliminação e alterações</h2>
            <p>
              Pode eliminar a conta no perfil. A eliminação remove a conta,
              sessões, histórico e ficheiros associados, salvo informação cuja
              conservação seja exigida pela lei. Podemos atualizar estes Termos;
              quando uma alteração exigir novo consentimento, pediremos nova
              aceitação antes de continuar a utilizar a conta.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">7. Lei aplicável e contacto</h2>
            <p>
              Estes Termos devem ser interpretados segundo as leis aplicáveis
              da República de Moçambique. Questões, reclamações e avisos devem
              ser enviados para aristidesvundo@gmail.com .
            </p>
          </section>
        </CardContent>
      </Card>
    </article>
  );
}

export function PrivacyPolicy() {
  return (
    <article className="mx-auto w-full max-w-3xl space-y-6">
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <p className="text-sm text-muted-foreground">Versão {PRIVACY_VERSION}</p>
          <h1 className="text-3xl font-extrabold">Política de Privacidade</h1>
          <p className="text-muted-foreground">VidGrab · Moçambique</p>
        </CardHeader>
        <CardContent className="space-y-6 leading-relaxed text-muted-foreground">
          <LegalDraftNotice />
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">1. Responsável pelo tratamento</h2>
            <p>
              O responsável é Aristides Nunes Vundo, estudante de engenharia Informatica 
              na Cidade da beira. Esta minuta deve ser confirmada face às obrigações legais aplicáveis em Moçambique.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">2. Dados tratados</h2>
            <p>
              Tratamos o nome, email, palavra-passe armazenada sob a forma de
              resumo criptográfico, estado de verificação, preferências e
              versões dos termos aceites, sessões autenticadas e histórico dos
              trabalhos solicitados (URL, título, formato, estado e datas).
              Os ficheiros pedidos são temporariamente armazenados no servidor.
            </p>
            <p>
              As rotas de proteção contra abuso mantêm contadores técnicos
              temporários associados ao pedido. O servidor e os fornecedores
              necessários à operação podem ainda gerar registos de diagnóstico
              e segurança.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">3. Finalidades</h2>
            <p>
              Utilizamos os dados para criar e proteger contas, verificar o
              endereço de email, recuperar o acesso, executar e apresentar os
              trabalhos de transferência solicitados, aplicar limites de uso,
              manter o serviço e responder a pedidos de suporte ou obrigações legais.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">4. Emails e fornecedores</h2>
            <p>
              Um fornecedor SMTP configurado recebe o email necessário para
              entregar links de verificação e recuperação. O yt-dlp consulta a
              plataforma de origem para obter as informações do vídeo solicitado.
              A infraestrutura de alojamento e base de dados processa os dados
              necessários para manter a aplicação. Consulte também as políticas
              desses fornecedores; a localização e eventuais transferências
              internacionais dependem da infraestrutura efetivamente contratada.
            </p>
            <p>Não vendemos dados pessoais.</p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">5. Sessões e segurança</h2>
            <p>
              A sessão utiliza um cookie estritamente necessário, protegido por
              HTTP-only e SameSite. Guardamos o resumo do token, e não o token
              da sessão em texto simples. Links de verificação e recuperação
              expiram após uma hora e os seus tokens são armazenados sob a forma
              de resumo.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">6. Conservação e eliminação</h2>
            <p>
              Os dados da conta, sessões, histórico e ficheiros associados são
              conservados enquanto a conta existir. Os tokens temporários são
              eliminados quando utilizados ou ao expirar. Ao eliminar a conta,
              o sistema elimina a conta e os registos associados e tenta remover
              os ficheiros dessa conta. Podem subsistir cópias técnicas de
              segurança por um período limitado, se existirem na infraestrutura
              contratada, bem como dados que a lei exija conservar.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">7. Os seus pedidos</h2>
            <p>
              Pode consultar os dados de perfil e solicitar a eliminação da
              conta no perfil. Para pedidos de acesso, correção ou outras
              questões de privacidade, contacte [contacto do responsável a
              completar]. O tratamento dos pedidos depende da lei aplicável.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">8. Atualizações</h2>
            <p>
              Esta política pode ser atualizada para refletir alterações no
              serviço ou nos requisitos legais. A versão aceite no registo fica
              registada na conta.
            </p>
          </section>
        </CardContent>
      </Card>
    </article>
  );
}
