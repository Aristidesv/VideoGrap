# VidGrab
## Requisitos

- Node.js 20 ou mais recente
- PostgreSQL 14 ou mais recente
- `yt-dlp` e FFmpeg disponíveis no `PATH` para análise e transferência de vídeos

## Configuração do PostgreSQL

Crie uma base de dados no servidor PostgreSQL local com o nome configurado em
`DATABASE_URL` (o exemplo abaixo usa `yt_downloader`):

```sql
CREATE DATABASE yt_downloader;
```

Copie `.env.example` para `.env` e configure `DATABASE_URL` para apontar para a
base de dados local, por exemplo:

```text
DATABASE_URL=******localhost:5432/yt_downloader
```

A API cria automaticamente um esquema PostgreSQL chamado `vidgrab`, aplica
nele `server/schema.sql` e regista a versão em
`vidgrab.schema_migrations`. Assim, as tabelas da aplicação ficam separadas de
quaisquer tabelas já existentes na base de dados configurada. O esquema cria
utilizadores, sessões de início de sessão e tarefas de transferência, bem como
índices para o histórico e as vistas de administração.

Para criar o primeiro administrador, defina `ADMIN_EMAIL` e `ADMIN_PASSWORD`
em `.env`. A palavra-passe deve ter pelo menos 12 caracteres. Se já existir uma
conta com esse endereço de email, a aplicação promove-a a administradora.
Mantenha estas credenciais privadas e remova as definições iniciais depois de
a conta de administrador ser criada.

Se `yt-dlp` ou FFmpeg estiver instalado fora do `PATH`, configure `YT_DLP_PATH`
ou `FFMPEG_LOCATION` em `.env`. O frontend usa `PORT` e encaminha os pedidos
para `/api` para a API, que usa `API_PORT` (3101 por predefinição).

## Pagamentos Premium

O plano Premium custa 100 MT. No painel de administração, preencha os dados
das contas e instruções de pagamento para e-Mola/dinheiro móvel, banco e
PayPal. Os utilizadores autenticados veem as instruções no perfil, pagam fora
da plataforma e enviam a referência da transação para revisão.

Os pedidos ficam guardados no painel e uma notificação por email é enviada
para `PREMIUM_NOTIFICATION_EMAIL` (ou para `ADMIN_EMAIL` se a primeira não
estiver definida). A aprovação manual pelo administrador ativa o plano
Premium; confirme o pagamento antes de aprovar. Configure o endereço de
notificação e Mailgun no serviço de produção para receber estes emails.

## Email, recuperação de palavra-passe e verificação

Os links de verificação e de reposição de palavra-passe são enviados pelo
Mailgun. Configure `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `EMAIL_FROM` e
`PUBLIC_APP_URL` em `.env`. Se a conta Mailgun estiver na região da UE, defina
`MAILGUN_API_BASE_URL=https://api.eu.mailgun.net`; para a região dos EUA, use
`https://api.mailgun.net`. Em desenvolvimento local, quando as credenciais
Mailgun não estão configuradas, os links são escritos no terminal da API para
testes. Configure as credenciais antes de disponibilizar a aplicação
publicamente.

### Configurar Mailgun

1. Adicione um domínio de envio no Mailgun e conclua a autenticação DNS
   (incluindo SPF e DKIM). Um domínio sandbox só pode enviar para destinatários
   autorizados pelo Mailgun.
2. Crie uma chave API privada no painel Mailgun e configure as variáveis no
   backend:

   ```text
   MAILGUN_API_KEY=<chave-privada-do-Mailgun>
   MAILGUN_DOMAIN=<dominio-de-envio-verificado>
   MAILGUN_API_BASE_URL=https://api.mailgun.net
   EMAIL_FROM=VidGrab <no-reply@<dominio-de-envio-verificado>>
   PUBLIC_APP_URL=https://<endereco-publico-da-aplicacao>
   ```

   Para contas da UE, substitua `MAILGUN_API_BASE_URL` por
   `https://api.eu.mailgun.net`. O domínio em `EMAIL_FROM` deve estar
   autorizado no Mailgun. Guarde a chave apenas nas variáveis do servidor;
   nunca a inclua no frontend, em `VITE_*` ou no repositório. Os links enviados
   expiram após uma hora e só podem ser usados uma vez.

As variáveis da API devem ser configuradas no serviço que aloja o backend e
aplicadas numa nova publicação. `PUBLIC_APP_URL` deve apontar para o endereço
público do frontend (ou para o domínio personalizado configurado), e não para
`localhost`. Não coloque segredos do servidor nas variáveis do frontend.

Os links de verificação e de reposição de palavra-passe expiram após uma hora e
só podem ser usados uma vez. O servidor guarda apenas hashes dos tokens. Há
limites de pedidos para as rotas de início de sessão, registo, pedidos de
email, análise de vídeos e criação de transferências. Estes limites são
mantidos na memória da aplicação e destinam-se a um único processo de API; use
um armazenamento partilhado de limites de pedidos se executar várias instâncias
de produção.

### Publicar no Render com Supabase e Mailgun

Os passos seguintes publicam o frontend e a API juntos num **Web Service**
Docker do Render e usam o Supabase como PostgreSQL. Para email, o exemplo
configura o envio por API HTTPS do Mailgun.

1. **Crie a base de dados no Supabase.** Crie um projeto e guarde a palavra-
   passe da base de dados. No painel do projeto, abra **Connect** e copie a
   cadeia de ligação PostgreSQL para a aplicação. Prefira a ligação indicada
   para servidores persistentes; se a ligação direta não funcionar no Render,
   use o **Session pooler**. Copie a cadeia completa com utilizador, palavra-
   passe, host, porta e base de dados. Não use as chaves `anon` ou
   `service_role` como `DATABASE_URL`.
2. **Envie o código para GitHub.** Coloque o projeto num repositório privado
   ou público. Nunca inclua `.env`, palavras-passe, chaves API ou outras
   credenciais no repositório.
3. **Crie o serviço no Render.** No Render, escolha **New → Web Service**,
   ligue o repositório GitHub e selecione **Docker** como ambiente. Mantenha o
   `Dockerfile` na raiz do projeto. Escolha uma região próxima da base de dados
   do Supabase e crie o serviço. O Dockerfile instala Node.js, `yt-dlp` e
   FFmpeg e compila a aplicação.
   Consulte as [limitações dos serviços Free do Render](https://render.com/docs/free).
4. **Configure as variáveis de ambiente.** No serviço Render, abra
   **Environment** e configure as credenciais Mailgun:

   ```text
   DATABASE_URL=<cadeia-completa-de-ligacao-do-Supabase>
   DATABASE_SSL=true
   DOWNLOAD_DIR=/tmp/vidgrab-downloads
   MAILGUN_API_KEY=<chave-privada-do-Mailgun>
   MAILGUN_DOMAIN=<dominio-de-envio-verificado>
   MAILGUN_API_BASE_URL=https://api.mailgun.net
   EMAIL_FROM=VidGrab <no-reply@<dominio-de-envio-verificado>>
   PREMIUM_NOTIFICATION_EMAIL=<endereco-do-administrador>
   PUBLIC_APP_URL=https://<nome-do-servico>.onrender.com
   ```

   Para contas Mailgun na região da UE, use
   `MAILGUN_API_BASE_URL=https://api.eu.mailgun.net`. O remetente em
   `EMAIL_FROM` deve pertencer ao domínio autenticado no Mailgun. Guarde a chave
   API apenas nas variáveis do serviço Render (nunca no frontend, em `VITE_*`
   ou no repositório).

   O Render atribui o endereço `.onrender.com` ao serviço; copie o endereço
   real para `PUBLIC_APP_URL`. Este endereço é usado nos links de verificação e
   de reposição de palavra-passe. Não adicione segredos como variáveis `VITE_*`
   nem os coloque no GitHub. O Render fornece `PORT`; não é necessário defini-la.
5. **Crie um administrador (opcional).** Se quiser criar a conta inicial de
   administrador no arranque, adicione também `ADMIN_EMAIL` e
   `ADMIN_PASSWORD` (mínimo de 12 caracteres) e, opcionalmente, `ADMIN_NAME`.
   Depois de a conta ser criada, remova `ADMIN_EMAIL` e `ADMIN_PASSWORD` das
variáveis do Render. Defina `PREMIUM_NOTIFICATION_EMAIL` separadamente para
continuar a receber pedidos de pagamento por email.
6. **Publique e verifique a aplicação.** Guarde as variáveis e inicie ou
   volte a publicar o serviço. Abra
   `https://<nome-do-servico>.onrender.com/api/health`; uma resposta saudável
   confirma que a API consegue aceder à base de dados. O servidor cria o
   esquema e aplica as migrações automaticamente no primeiro arranque.
7. **Teste o email e as funcionalidades.** Registe uma conta com um endereço
   seu, abra o link recebido para verificar o email e teste a reposição de
   palavra-passe. Os links expiram após uma hora e só podem ser usados uma vez.
   Verifique também a pasta de spam e os registos do serviço no Render se a
   mensagem não chegar.

Para melhorar a entrega, autentique o domínio remetente no Mailgun, incluindo
os registos DNS SPF e DKIM exigidos pelo serviço.

A aplicação aplica as migrações do PostgreSQL no esquema `vidgrab` durante o
arranque. Use um projeto/base de dados Supabase dedicado a esta aplicação. As
chaves de API `anon` e `service_role` do Supabase não são cadeias de ligação
PostgreSQL e não devem ser usadas como `DATABASE_URL`.

Esta configuração publica toda a aplicação no Render, e não no Vercel. Alojar
o frontend e o backend em domínios separados exige configurar o URL da API,
CORS e cookies entre domínios. As funções do Vercel não são adequadas ao worker
de transferências atual, que executa `yt-dlp`/FFmpeg e depende de um processo
de longa duração e de ficheiros locais.

O histórico guarda apenas os dados das últimas 100 análises por utilizador
(título, URL, canal, duração, miniatura e data), não os ficheiros de vídeo ou
áudio. Os ficheiros convertidos são temporários: são removidos depois de
entregues ao utilizador e eliminados automaticamente se não forem transferidos
no prazo de uma hora. Por isso, não é necessário anexar um disco persistente
para guardar downloads.

O worker e os contadores de limites de pedidos estão atualmente na memória do
processo. Use uma única instância da aplicação nesta configuração inicial;
várias instâncias exigiriam armazenamento partilhado para as tarefas e os
limites de pedidos.

Um utilizador autenticado pode eliminar a sua conta no perfil, confirmando a
palavra-passe e escrevendo `ELIMINAR`. Esta ação elimina a conta, as sessões, o
histórico de transferências e os ficheiros associados. A última conta de
administrador não pode ser eliminada até ser nomeado outro administrador.

A API verifica a ligação ao PostgreSQL em `GET /api/health`. Para uma
compilação de produção, execute `npm run build` e, em seguida, `npm start`; a
API serve o frontend compilado e processa as rotas `/api` na mesma porta.
