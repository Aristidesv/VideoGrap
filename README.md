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

## Email, recuperação de palavra-passe e verificação

Configure `SMTP_URL` ou, em alternativa, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASSWORD`, `SMTP_SECURE` e `EMAIL_FROM` em `.env`. Para usar a API HTTPS
do Brevo, configure `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY` e `EMAIL_FROM`.
Defina `PUBLIC_APP_URL` com o URL público do frontend; este valor é usado para
criar os links de verificação e de reposição de palavra-passe. Apenas no
desenvolvimento local, quando não há SMTP nem API de email configurados, os
links são escritos no terminal da API para testes. Configure um método de
envio antes de disponibilizar a aplicação publicamente.

### Exemplo: SMTP do Gmail

Este método pode servir para começar ou para uma aplicação de baixo volume. O
Gmail pode impor limites de envio e filtros anti-spam; para envio regular a
muitos utilizadores, use um serviço de email transacional e siga os requisitos
de autenticação do remetente desse serviço. **Importante para o Render:** os
serviços Free bloqueiam ligações de saída nas portas SMTP 25, 465 e 587. Assim,
o Gmail SMTP não funciona num Web Service Free do Render, mesmo com as
credenciais corretas. Para o plano Free, use a API HTTPS do Brevo descrita
abaixo.

1. Na Conta Google que enviará as mensagens, ative a **Verificação em dois
   passos**. Abra **Segurança** e crie uma **Palavra-passe de app** para a
   aplicação. Esta opção pode não estar disponível em todas as contas Google.
   Use a palavra-passe de app, não a palavra-passe normal da conta.
2. Nas variáveis de ambiente do backend, configure:

   ```text
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=<endereco-gmail>
   SMTP_PASSWORD=<palavra-passe-de-app>
   EMAIL_FROM=VidGrab <endereco-gmail>
   PUBLIC_APP_URL=https://<endereco-publico-da-aplicacao>
   ```

   Substitua os valores entre `<...>` e use o mesmo endereço Gmail em
   `SMTP_USER` e em `EMAIL_FROM`. Em `PUBLIC_APP_URL`, use o endereço público
   do frontend, não `localhost`. Mantenha a palavra-passe de app privada:
   nunca a coloque no código, numa variável `VITE_*`, num ficheiro versionado
   ou numa mensagem. Se deixar de a usar, remova-a nas definições da Conta
   Google.
3. Guarde as variáveis e reinicie ou volte a publicar a aplicação. Teste com
   um endereço seu e verifique também as pastas de spam e os registos do
   servidor.

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

### Publicar no Render com Supabase e Gmail SMTP

Os passos seguintes publicam o frontend e a API juntos num **Web Service**
Docker do Render e usam o Supabase como PostgreSQL. Para email, o exemplo
configura o Gmail SMTP, que requer um plano Render que permita ligações SMTP.
Para usar o Render Free, siga a alternativa Brevo API HTTPS no passo 4.

1. **Crie a base de dados no Supabase.** Crie um projeto e guarde a palavra-
   passe da base de dados. No painel do projeto, abra **Connect** e copie a
   cadeia de ligação PostgreSQL para a aplicação. Prefira a ligação indicada
   para servidores persistentes; se a ligação direta não funcionar no Render,
   use o **Session pooler**. Copie a cadeia completa com utilizador, palavra-
   passe, host, porta e base de dados. Não use as chaves `anon` ou
   `service_role` como `DATABASE_URL`.
2. **Envie o código para GitHub.** Coloque o projeto num repositório privado
   ou público. Nunca inclua `.env`, palavras-passe, chaves SMTP ou outras
   credenciais no repositório.
3. **Crie o serviço no Render.** No Render, escolha **New → Web Service**,
   ligue o repositório GitHub e selecione **Docker** como ambiente. Mantenha o
   `Dockerfile` na raiz do projeto. Escolha uma região próxima da base de dados
   do Supabase e crie o serviço. O Dockerfile instala Node.js, `yt-dlp` e
   FFmpeg e compila a aplicação. Se for usar Gmail SMTP, não escolha o plano
   Free: o Render bloqueia nesse plano a saída para as portas 25, 465 e 587.
   Consulte as [limitações dos serviços Free do Render](https://render.com/docs/free).
4. **Configure as variáveis de ambiente.** No serviço Render, abra
   **Environment**. Para Gmail SMTP num plano que permita SMTP, adicione:

   ```text
   DATABASE_URL=<cadeia-completa-de-ligacao-do-Supabase>
   DATABASE_SSL=true
   DOWNLOAD_DIR=/tmp/vidgrab-downloads
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=<endereco-gmail>
   SMTP_PASSWORD=<palavra-passe-de-app-do-Google>
   EMAIL_FROM=VidGrab <endereco-gmail>
   PUBLIC_APP_URL=https://<nome-do-servico>.onrender.com
   ```

   Substitua cada valor entre `<...>`. Use o endereço Gmail da conta onde criou
   a palavra-passe de app, tanto em `SMTP_USER` como em `EMAIL_FROM`.

   **Alternativa para Render Free: Brevo API HTTPS.** Crie uma chave de API no
   painel Brevo e configure/verifique um remetente autorizado pelo Brevo. Em
   seguida, use estas variáveis em vez das variáveis `SMTP_*`:

   ```text
   EMAIL_PROVIDER=brevo
   BREVO_API_KEY=<chave-de-api-do-Brevo>
   EMAIL_FROM=VidGrab <remetente-verificado-no-Brevo>
   PUBLIC_APP_URL=https://<nome-do-servico>.onrender.com
   ```

   A aplicação envia as mensagens para a API transacional do Brevo por HTTPS.
   A chave de API é um segredo: guarde-a apenas nas variáveis do serviço Render
   (nunca no frontend, em `VITE_*`, no repositório ou numa mensagem). Se a
   conta Brevo tiver restrições de IP para chaves API, autorize os endereços de
   saída do serviço Render ou ajuste essa restrição nas definições da chave;
   os endereços de saída podem variar por região/serviço. O remetente tem de
   ser aceite pelo Brevo, e a autenticação do domínio melhora a entrega.

   Em ambos os métodos, o Render atribui o endereço `.onrender.com` ao
   serviço; copie o endereço real para `PUBLIC_APP_URL`. Este endereço é usado
   nos links de verificação e de reposição de palavra-passe. Não adicione
   segredos como variáveis `VITE_*` nem os coloque no GitHub. O Render fornece
   `PORT`; não é necessário defini-la.
5. **Crie um administrador (opcional).** Se quiser criar a conta inicial de
   administrador no arranque, adicione também `ADMIN_EMAIL` e
   `ADMIN_PASSWORD` (mínimo de 12 caracteres) e, opcionalmente, `ADMIN_NAME`.
   Depois de a conta ser criada, remova `ADMIN_EMAIL` e `ADMIN_PASSWORD` das
   variáveis do Render; se já existir uma conta com esse email, o arranque
   volta a promovê-la a administradora.
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

O SMTP do Gmail é uma solução simples para começar, mas pode ter limites de
envio e não é recomendado para campanhas ou volume elevado. A entrega pode
depender das políticas de segurança da Google. No Render Free use a integração
Brevo API; para uso público regular, considere autenticar um domínio próprio no
serviço de envio para melhorar a entrega.

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
