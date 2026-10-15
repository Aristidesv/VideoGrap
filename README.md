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

## Executar localmente

Instale as ferramentas externas de vídeo, instale as dependências JavaScript e
inicie a API e o frontend:

```powershell
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg.Shared
npm install
npm run dev
```

Se `yt-dlp` ou FFmpeg estiver instalado fora do `PATH`, configure `YT_DLP_PATH`
ou `FFMPEG_LOCATION` em `.env`. O frontend usa `PORT` e encaminha os pedidos
para `/api` para a API, que usa `API_PORT` (3101 por predefinição).

## Email, recuperação de palavra-passe e verificação

Configure `SMTP_URL` ou, em alternativa, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASSWORD`, `SMTP_SECURE` e `EMAIL_FROM` em `.env`. Defina `PUBLIC_APP_URL`
com o URL público do frontend; este valor é usado para criar os links de
verificação e de reposição de palavra-passe. Apenas no desenvolvimento local,
quando o SMTP não está configurado, os links são escritos no terminal da API
para testes. Configure o SMTP antes de disponibilizar a aplicação
publicamente.

### Exemplo: SMTP do Resend

1. Crie uma conta Resend, adicione um domínio que controla e conclua a
   verificação desse domínio (incluindo os registos DNS fornecidos pelo Resend).
2. Crie uma chave de API do Resend com permissão para enviar emails.
3. Configure as seguintes variáveis de ambiente localmente ou nas definições do
   serviço que aloja a API:

   ```text
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=resend
   SMTP_PASSWORD=<a sua chave de API do Resend>
   EMAIL_FROM=VidGrab <no-reply@o-seu-dominio-verificado.example>
   PUBLIC_APP_URL=https://a-sua-aplicacao-publica.example
   ```

   Substitua o domínio do remetente pelo domínio verificado. Mantenha a chave
   de API privada; nunca a coloque no código do frontend, numa variável
   `VITE_*` ou num ficheiro `.env` versionado. Em alternativa, o Resend também
   suporta a porta `587` com `SMTP_SECURE=false`.
4. Reinicie ou volte a publicar a API depois de alterar as variáveis. Em
   seguida, teste o registo com um endereço de email seu e consulte os registos
   da API e o painel do Resend.

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

## Publicação: Vercel ou Render com Supabase

**É possível publicar o frontend no Vercel, mas não é recomendável publicar a
aplicação completa no Vercel tal como está.** O frontend é uma aplicação React
que pode ser compilada como ficheiros estáticos. No entanto, O backend atual é
um servidor Express que inicia tarefas de `yt-dlp` e FFmpeg, mantém o estado
das tarefas na memória e cria ficheiros temporários para as transferências.
As funções serverless do Vercel não são adequadas a este worker de longa duração.

Para usar o Vercel, seria necessário alojar a API e o worker noutro serviço
compatível, como o Render, e configurar o frontend para comunicar com essa API.
Como frontend e API ficariam em domínios diferentes, também seria necessário
configurar o URL da API, CORS e os cookies entre domínios. Para publicar a
aplicação completa com o mínimo de alterações, a opção recomendada é alojar o
frontend e a API juntos como um serviço Docker no Render e usar o Supabase para
o PostgreSQL.

### Publicar no Render com Supabase

1. Crie um projeto Supabase. Em **Connect**, escolha uma cadeia de ligação
   PostgreSQL adequada a um servidor de aplicação persistente. Se o seu
   fornecedor de alojamento não conseguir aceder à ligação direta, use os
   dados do **Session pooler** fornecidos pelo Supabase. Copie a cadeia de
   ligação completa, incluindo o nome de utilizador e a palavra-passe da base
   de dados.
2. Envie este projeto para um repositório GitHub e crie um **Web Service** no
   Render usando esse repositório e selecionando **Docker** como ambiente de
   execução. O Render compilará o `Dockerfile` incluído, que instala Node.js,
   `yt-dlp` e FFmpeg e compila o frontend e a API.
3. Adicione estas variáveis de ambiente nas definições do serviço Render:

   ```text
   DATABASE_URL=<cadeia de ligação PostgreSQL do Supabase>
   DATABASE_SSL=true
   PUBLIC_APP_URL=https://<dominio-do-seu-servico-render>
   DOWNLOAD_DIR=/tmp/vidgrab-downloads
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=resend
   SMTP_PASSWORD=<a sua chave de API do Resend>
   EMAIL_FROM=VidGrab <no-reply@o-seu-dominio-verificado.example>
   ```

   Substitua o URL e o remetente pelos domínios reais. Adicione `ADMIN_EMAIL`,
   `ADMIN_PASSWORD` (com pelo menos 12 caracteres) e, opcionalmente,
   `ADMIN_NAME` se quiser criar um administrador durante o arranque. Nunca
   defina segredos como variáveis frontend `VITE_*` nem os envie para o GitHub.
   O Render fornece `PORT`; o servidor começa automaticamente a escutar nessa
   porta. `DOWNLOAD_DIR` aponta para armazenamento temporário; não configure um
   disco persistente para os ficheiros convertidos.
4. Publique a aplicação e verifique
   `https://<dominio-do-seu-servico-render>/api/health`. Uma resposta saudável
   deve indicar que a ligação ao PostgreSQL está ativa. Depois, teste o registo,
   o envio de emails, a análise de vídeos e uma transferência pequena.

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

## Páginas de conta e informação legal

As novas contas têm de verificar o endereço de email e aceitar explicitamente
os Termos de Utilização e a Política de Privacidade antes do registo. Essas
páginas são versões iniciais para Moçambique; confirme os dados da entidade
responsável, preencha todas as informações de contacto em falta e obtenha
revisão jurídica local qualificada antes do lançamento público.

Um utilizador autenticado pode eliminar a sua conta no perfil, confirmando a
palavra-passe e escrevendo `ELIMINAR`. Esta ação elimina a conta, as sessões, o
histórico de transferências e os ficheiros associados. A última conta de
administrador não pode ser eliminada até ser nomeado outro administrador.

A API verifica a ligação ao PostgreSQL em `GET /api/health`. Para uma
compilação de produção, execute `npm run build` e, em seguida, `npm start`; a
API serve o frontend compilado e processa as rotas `/api` na mesma porta.
