<h1 align="center">
  <img src="https://i.ibb.co/NgdH4xgR/90093.jpg" alt="DTunnel" style="width: 80px; height: 80px; border-radius: 50%;">
</h1>

<p align="center">
 <img src="https://img.shields.io/static/v1?label=DTunnel&message=Mod&color=E51C44&labelColor=0A1033" alt="DTunnelMod" />
 <img src="https://img.shields.io/static/v1?label=Open&message=Source&color=E51C44&labelColor=0A1033" alt="DTunnelMod" />
</p>

![cover](https://i.ibb.co/0yPYBjy/preview.png)

## 🔔 Atualizações

- [x] Suporte DTunnelMod 4.5.7
- [x] Adicionado CDN
- [x] App Text atualizado
- [x] App Layout atualizado
- [x] Adicionado modo HYSTERIA, SSH_DNSTT
- [x] Adicionado gerenciador simples de versões
- [x] Adicionado runtime integrado para `SSH_XHTTP`, com validação de base APK e geração assinada
- [x] Gerenciamento de backup com envio automático ao Telegram a cada 2 horas

## SSH_XHTTP

O modo `SSH_XHTTP` agora é encaminhado para um runtime XHTTP real dentro da APK base, eliminando a falha `Invalid mode: SSH_XHTTP`. Os campos obrigatórios e o mapeamento de compatibilidade estão documentados em [docs/XHTTP.md](docs/XHTTP.md). A integração incorpora código de terceiros sob GPLv3; consulte [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e [LICENSES/GPL-3.0.txt](LICENSES/GPL-3.0.txt) antes de redistribuir a APK.

## :rocket: Principais funções

- [x] Layout storages
- [x] Edição de textos
- [x] Edição de layouts
- [x] Edição de categorias
- [x] Edição de configurações

## Iniciando o projeto

Primeiro você deve criar seu arquivo de variável ambiente `.env` na pasta do projeto.
Exemplo:

```cl
PORT=                // 3000
NODE_ENV=            // "production"
DATABASE_URL=        // "file:./database.db"
CSRF_SECRET=         //
JWT_SECRET_KEY=      //
JWT_SECRET_REFRESH=  //
```

`CSRF_SECRET`, `JWT_SECRET_KEY`, `JWT_SECRET_REFRESH` são chaves secretas sensíveis, ninguém além de você deve ter acesso a elas, para garantir a segurança do painel recomendo que utilizem este comando para gerar chaves privadas:

```js
node -e "console.log(require('crypto').randomBytes(256).toString('base64'));"
```

### 1. Instale as dependências:

```bash
pnpm install
```

### 2. Gerar artefactos do Prisma

```bash
pnpm exec prisma generate
```

### 3. Aplicar as migrations do banco de dados

```bash
pnpm exec prisma migrate deploy
```

### 4. Compilar o projeto

O comando de build regenera o Prisma Client automaticamente antes de executar o TypeScript:

```bash
pnpm build
```

### 5. Rodando o projeto

```bash
pnpm start
```

### Gerenciamento de backup

O instalador padrão já inclui a página **Gerenciamento de backup** no painel administrativo. Depois de entrar como administrador, informe o token do bot do Telegram e o ID do seu chat, ative o backup automático e salve. A configuração é criada automaticamente na inicialização do painel; não é necessário executar um comando separado de backup.

### Notificações FCM para o aplicativo

A opção **Notificações** fica disponível para qualquer usuário autenticado. Cada conta envia título, mensagem e imagem somente aos aparelhos vinculados à própria conta; não há campo para informar tokens de outras pessoas. O envio usa FCM HTTP v1. No Firebase Console, confirme o projeto `dtunnel-ec825`, habilite Firebase Cloud Messaging API (V1) e gere uma chave privada JSON em **Configurações do projeto → Contas de serviço**. Mantenha o arquivo fora deste repositório, por exemplo em `/etc/dtunnel/firebase-admin.json`, com permissões restritas ao usuário do processo. Defina `FIREBASE_PROJECT_ID=dtunnel-ec825` e `FIREBASE_SERVICE_ACCOUNT_FILE=/etc/dtunnel/firebase-admin.json` no `.env` do servidor. Nunca publique ou envie o JSON privado pelo chat.

O gerador de APK grava uma chave individual por geração; o servidor guarda somente o hash dessa chave. Os workers FCM do APK enviam o token ao painel por HTTPS, e o backend confere que a chave pertence ao ID da conta embutido no APK e que o acesso da conta está ativo. Para que uma conta comece a receber notificações, gere um APK com esta versão do painel e abra-o com conexão à internet. A contagem de aparelhos vinculados aparece na própria tela. Em instalações atrás de proxy reverso, configure `PANEL_DOMAIN` com o domínio público do painel no `.env`; sem essa variável, o gerador usa o cabeçalho `Host` da requisição e não confia em `X-Forwarded-Host`.

### Atualização do painel no VPS

O comando manual de atualização do VPS fica na pasta `/root/Dtmod`. Ele baixa `origin/main` com fast-forward, instala as dependências, regenera o Prisma Client, aplica `migrate deploy` **somente se o intervalo trouxer um arquivo `migration.sql`**, compila o projeto e reinicia o processo correto do PM2. Sem alteração de schema/migrations, não toca no banco:

```bash
cd /root/Dtmod
OLD_COMMIT="$(git rev-parse HEAD)"
git fetch origin main && git merge --ff-only origin/main && \
install -m 0755 /root/Dtmod/menuop /usr/local/bin/menuop && \
pnpm install --frozen-lockfile && pnpm exec prisma generate && \
if git diff --name-only "$OLD_COMMIT" HEAD -- prisma/migrations | grep -qE '/migration\.sql$'; then
  pnpm exec prisma migrate deploy
else
  echo 'Nenhuma migration SQL nova; banco inalterado.'
fi && \
pnpm build && pm2 restart DTunnel --update-env
```

O `menuop` também oferece a opção **9. Atualizar painel pelo GitHub**. Ela verifica se o clone está limpo e na branch `main`, busca `origin/main`, pede confirmação, faz backup de `.env` e do banco SQLite local quando aplicável, atualiza em fast-forward, aplica apenas migrations SQL alteradas, compila e reinicia `DTunnel`. Alterações locais ou divergência de histórico interrompem o processo em vez de sobrescrever arquivos. **P3005 não deve ser resolvido com baseline automático**: em banco legado, confirme o backup e compare o schema antes de qualquer `prisma migrate resolve`.

### Atualizações do aplicativo

A versão atual da base do APK valida as quatro chaves de `dtunnelmod.json`: `url`, `credits`, `channel` e `group`. Por isso, **não remova essas quatro chaves dos APKs atuais**: a URL localiza o painel e as demais chaves são mantidas por compatibilidade com o leitor interno da base. A atualização de configurações, textos e layout continua sendo entregue pelas APIs `/api/dtunnelmod/version` e `/api/dtunnelmod/update`; os campos sociais não definem a versão nem o endereço do download.

Para disponibilizar uma nova versão do APK, gere o aplicativo com uma nova versão/código e informe a URL pública do APK no campo `APP_DOWNLOAD_URL` da configuração do aplicativo. A versão exibida usa `APP_CURRENT_VERSION`. A remoção definitiva das chaves sociais só deve ser feita depois que a base do APK for substituída por uma versão cujo leitor aceite o manifesto sem elas.

### Criar ou preservar o administrador

O instalador não executa seed e não cria credenciais administrativas fixas. O arquivo `prisma/seed.ts` é apenas informativo e não cria nem altera contas administrativas. Em uma instalação sem administrador, use a opção 8 do `menuop` para criar o Super ADM diretamente no VPS; não é necessário executar `prisma db seed`.

Na primeira criação, a opção 8 solicita o nome interno, o Gmail, a senha e a confirmação da senha. Se já existir um administrador no banco, a opção 8 solicita a senha atual antes de permitir a troca do Gmail e da senha.

### Configurar Colaboradores e Pix

Depois da atualização, entre no painel com uma conta administradora e abra o menu **Colaboradores**. Informe o Access Token do Mercado Pago, defina o valor em reais e ative a opção **Ativar card de Colaboradores para os usuários**. O token é armazenado protegido no banco e nunca é enviado para usuários comuns.

O card aparece no dashboard somente quando o administrador ativar a opção e existir valor configurado. Usuários comuns podem apenas gerar o código Pix; a criação da cobrança usa o valor definido pelo administrador e retorna o QR Code e o código copia e cola.

O recurso exige `JWT_SECRET_KEY` ou `CSRF_SECRET` no `.env` para proteger o token armazenado. A geração do Pix usa a API de pagamentos do Mercado Pago, com `X-Idempotency-Key` em cada solicitação. A confirmação automática do pagamento ainda não está incluída nesta primeira versão.

### Segurança e login por Gmail

Administradores podem abrir o menu **Mudar Gmail e senha** para alterar o Gmail usado no login e a senha da conta. A senha atual é exigida para confirmar a operação; deixar os campos de nova senha vazios mantém a senha existente.

O painel aceita login somente pelo Gmail cadastrado. O nome de usuário continua sendo mantido como identificação interna e visual, mas não funciona como credencial de acesso. Novas contas criadas no painel devem receber um Gmail válido para entrar.

Depois de publicar a alteração, use a opção **9. Atualizar painel pelo GitHub** do `menuop` ou o comando manual documentado acima. Evite `git reset --hard` em uma instalação de produção: ele pode descartar alterações locais.

<br />

### Criar ou alterar o Super ADM pelo menuop

No menu do terminal, escolha a opção **8. Criar ou mudar Super ADM**. Se não houver administrador no banco, o menu solicitará o nome interno, o Gmail, a senha e a confirmação da senha. Se já existir administrador, solicitará a senha atual, o novo Gmail e, opcionalmente, a nova senha. Pressione Enter no campo de nova senha para manter a senha atual.

A opção altera somente a conta marcada como administradora, preserva a senha quando solicitado e impede o uso de um Gmail já cadastrado em outra conta.
