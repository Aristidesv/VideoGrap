import {
  Download,
  History,
  MailCheck,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const services = [
  {
    icon: Search,
    title: "Análise de vídeos",
    description:
      "Consulte informações e formatos disponíveis para um link do YouTube antes de iniciar uma transferência.",
  },
  {
    icon: Download,
    title: "Transferência de vídeo e áudio",
    description:
      "Escolha um dos formatos apresentados pela análise e acompanhe o estado do trabalho na aplicação.",
  },
  {
    icon: UserRound,
    title: "Conta pessoal",
    description:
      "Crie uma conta para aceder às transferências, consultar o histórico e gerir os seus dados.",
  },
  {
    icon: MailCheck,
    title: "Verificação e recuperação",
    description:
      "Confirme o seu endereço de email e recupere o acesso à conta através de um link temporário.",
  },
  {
    icon: History,
    title: "Histórico de trabalhos",
    description:
      "Consulte o estado e os detalhes das transferências solicitadas na sua conta.",
  },
  {
    icon: ShieldCheck,
    title: "Segurança e privacidade",
    description:
      "Use limites de proteção contra abuso, consulte os documentos legais e solicite a eliminação da conta.",
  },
];

export default function ServicesPage() {
  return (
    <article className="mx-auto w-full max-w-5xl space-y-8">
      <header className="space-y-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          VidGrab
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Serviços
        </h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Ferramentas para analisar links do YouTube, consultar formatos e
          acompanhar os trabalhos de transferência numa conta pessoal.
        </p>
      </header>

      <section
        aria-label="Serviços disponíveis"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {services.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="border-border/50 bg-card/80">
            <CardHeader className="space-y-4">
              <div className="w-fit rounded-xl bg-primary/10 p-3 text-primary">
                <Icon aria-hidden="true" className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold">{title}</h2>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4 rounded-xl border border-border/50 bg-card/60 p-6">
        <h2 className="text-xl font-bold">Utilização responsável</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Utilize o VidGrab apenas com conteúdos que tenha autorização para
          aceder e guardar, respeitando os direitos de terceiros e os termos da
          plataforma de origem. A disponibilidade dos formatos depende do vídeo
          e do serviço de origem.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/">
            <Button>Começar a analisar</Button>
          </Link>
          <Link href="/terms">
            <Button variant="outline">Consultar os Termos de Utilização</Button>
          </Link>
        </div>
      </section>
    </article>
  );
}
