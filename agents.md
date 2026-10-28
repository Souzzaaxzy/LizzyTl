# agents.md — instruções de desenvolvimento

Instruções para agentes (humanos ou automatizados) que continuarem o projeto
**𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲**. Leia o `README.md` antes de alterar qualquer coisa.

## Princípios obrigatórios

1. **Identidade preservada.** O nome oficial é `𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲`. Preserve os
   caracteres especiais e a tipografia. Nunca troque por um nome genérico.
2. **Nada de simulação.** Não crie funções fictícias, conexões falsas nem QR
   Codes inventados. Nunca declare que o WhatsApp está conectado sem uma
   conexão real e validada.
3. **Sem segredos no Git.** `.env`, sessões do WhatsApp, credenciais e dados
   locais privados nunca entram no repositório. Use `.env.example` como modelo.
   Nunca imprima o token nos logs nem passe segredos por argumento de comando.
4. **Mudanças mínimas.** Implemente apenas o que foi pedido. Não crie arquivos
   vazios nem antecipe funcionalidades sem necessidade.
5. **Módulos separados.** A conexão do Telegram e a do WhatsApp são
   independentes; falhas de uma não devem derrubar a outra.

## Convenções de código

- TypeScript em modo `strict` (inclusive `noUncheckedIndexedAccess`).
- Imports de módulos internos do Node com o prefixo `node:`.
- Comentários apenas quando explicam uma decisão não óbvia; não descreva o
  óbvio nem narre o histórico de mudanças.
- Textos exibidos ao usuário ficam em `src/telegram/menus/main-menu.ts`.
- Qualquer entrada do usuário usada em mensagem com `parse_mode: 'HTML'` deve
  passar por `escapeHtml`.
- Todo callback precisa receber `answerCbQuery`, inclusive os desconhecidos.

## Fluxo de trabalho

```bash
npm install
npm run typecheck   # deve passar sem erros
npm run build       # deve gerar dist/ sem erros
npm test            # deve passar sem falhas
```

Não considere uma tarefa concluída se `typecheck`, `build` ou `test` falharem.
Nunca declare um teste aprovado sem tê-lo executado.

## Onde adicionar cada tipo de coisa

| Necessidade                          | Local                                      |
| ------------------------------------ | ------------------------------------------ |
| Novo comando                         | `src/telegram/commands/`                   |
| Novo botão/menu                      | `src/telegram/menus/`                      |
| Novo callback                        | `src/telegram/handlers/`                   |
| Nova variável de ambiente            | `src/config/config.ts` + `.env.example`    |
| Integração com WhatsApp              | `src/whatsapp/client.ts`                   |
| Testes                               | `tests/*.test.ts`                          |

## Integração futura com WhatsApp

- O fork da Baileys será definido pelo proprietário do projeto. **Não escolha
  um fork arbitrariamente** nem instale uma implementação aleatória.
- Não armazene sessões no Git; use `DATA_DIR` (já ignorado).
- A conexão do WhatsApp deve poder rodar no mesmo processo que o Telegram, com
  tratamento de falhas independente.

## Ferramentas (download de redes sociais)

- A tela `tools` reúne os downloads: Instagram, YouTube, Facebook, X, TikTok.
- Os botões existem, mas **as funcionalidades ainda não foram implementadas**.
  As telas dizem isso explicitamente — nunca afirmar que algo funciona sem
  funcionar.
- Para implementar: o fork expõe `downloadMediaMessage` em
  `lib/Utils/messages.js`, e o socket já escuta eventos via `socket.ev.on`.
  O `WhatsAppClient` precisará de um listener de `messages.upsert`.
- O teste "as telas das ferramentas dizem que estão em implementação" falha se
  alguém remover o aviso de uma tela sem implementar a função.

## Notificações e texto tocável

- Textos que o usuário deve copiar (código de pareamento, ID no perfil) vão em
  `<code>`. No Telegram isso vira texto tocável: um toque copia. Sem a tag, o
  usuário teria de selecionar manualmente no celular.
- As mensagens que o bot envia sozinho ficam em
  `src/telegram/messages/notifications.ts`, fora do `index.ts`.
- `onStateChange` só dispara quando o estado **muda**. Reconexão repetida
  geraria a mesma mensagem várias vezes e poluiria o chat.
- `buildStateMessage` devolve `null` para estados que não merecem aviso
  (`conectando`, `aguardando_pareamento`), porque já têm mensagem própria.

## Multi-sessão de WhatsApp

- O bot é público: **cada usuário tem a própria sessão** de WhatsApp. O
  isolamento é o ponto crítico — nunca use a sessão de um para atender outro.
- `WhatsAppManager` (`src/whatsapp/manager.ts`) é a única porta de entrada:
  o resto do bot nunca mexe em socket direto. Ele resolve estado, conexão e
  desconexão por `userId`.
- `WhatsappSessionStore` guarda `data/whatsapp/<userId>.json` (número) e
  `data/whatsapp-auth/<userId>/` (credenciais). Nada versionado.
- `MAX_SESSIONS_PER_USER = 1`: cada usuário tem um número. Reconectar
  substitui, nunca acumula. Testado em "reconectar o mesmo usuário substitui
  a sessão, sem acumular".
- `WHATSAPP_MAX_SESSIONS` limita as sessões simultâneas. Sem teto, muitas
  conexões derrubam o processo e **todas** as sessões caem junto.
- **Memória medida** (não estimada): ~100 MB fixos do Baileys + ~2 MB por
  sessão ociosa. 30 sessões = ~170 MB. Com tráfego, cada sessão usa mais.
- O código de pareamento vai para o chat de quem pediu, via
  `onPairingCode(userId, code)`. Nunca para outro usuário.

## Instalação: fork vendorizado em `vendor/baileys.tgz`

O **npm 12 bloqueia por padrão** dependências fora do registro oficial:
`allow-git = none` e `allow-remote = none` (erros `EALLOWGIT`, `EALLOWREMOTE`).
`allow-file` e `allow-directory` continuam `all`.

Como o fork da Baileys não está publicado no npm, qualquer referência
`github:` ou a tarball remoto falha. A solução é **vendorizar**:

```
vendor/baileys.tgz                        # tarball do commit, versionado (4.5 MB)
"@souzzaaxzy/baileys": "file:vendor/baileys.tgz"
```

Isso funciona com `npm install` puro, sem flag e sem `.npmrc` — essencial para
hospedagem que roda `npm i` automaticamente (painel Pterodactyl, CI, etc.).

Para atualizar o fork: baixe o tarball do novo commit, substitua o arquivo e
ajuste nada no `package.json` (o caminho continua o mesmo).

Não use `.npmrc` com `allow-*`: é configuração do npm na máquina, e alterar
política de instalação exige consentimento explícito do proprietário.

O npm 11.20+ **bloqueia dependências do tipo git** por padrão
(`allow-git = "none"`), com o erro `EALLOWGIT`. Além disso, uma referência
`github:` é resolvida por **SSH** (`git+ssh://git@github.com/...`), o que exige
chave SSH configurada na máquina — algo que o servidor de produção não tem.

Por isso a dependência aponta para o **tarball do commit**:

```
https://github.com/Souzzaaxzy/baileys/archive/<sha>.tar.gz
```

Vantagens: não exige `git` instalado, não usa SSH, o npm não bloqueia, e o
commit fica fixado (build reproduzível). Para atualizar o fork, troque o SHA.

## ESM e o fork da Baileys

- O projeto é **ESM** (`"type": "module"`, tsconfig `NodeNext`). Todo import
  relativo precisa terminar em `.js`. Não existe `__dirname`: use
  `fileURLToPath(import.meta.url)`.
- O fork `@souzzaaxzy/baileys` publica `WAProto/index.d.ts` com um `enum`
  aninhado em classe, que é sintaxe inválida em arquivo de declaração. O
  `skipLibCheck` **não** cobre erro de sintaxe. Por isso o pacote é carregado
  por `baileys-loader.ts`, com o contrato declarado em `baileys-types.ts`.
  Se o fork corrigir a tipagem, o loader pode virar import normal.
- O pareamento usa `requestPairingCode(numero, codigo)`. O código precisa ter
  **exatamente 8 caracteres** do alfabeto Crockford Base32 — sem I, O, L nem
  símbolos. O padrão da Lizzy é `L1ZZYB9T`.
- `@roamhq/wrtc` não tem binário para Android: VoIP não roda no Termux. O resto
  funciona, porque ele é carregado por import dinâmico dentro do módulo de voz.

## Lições aprendidas (não repita estes erros)

### Auditoria de bugs (corrigidos)

1. **Bot respondia em grupos.** Sem filtro de tipo de chat, ele respondia
   qualquer mensagem de qualquer membro, virando spam e misturando dados.
   Corrigido em `isIgnoredChat` (rate-limit.ts), que ignora tudo que não é
   conversa privada.
2. **"message is not modified" duplicava o menu.** O Telegram recusa editar sem
   mudança com 400; tratar como falha enviava mensagem nova. Corrigido com
   `isNotModified` no callback-handler.
3. **file_id obsoleto.** Trocar o arquivo de mídia continuava enviando a mídia
   antiga. Corrigido com assinatura (tamanho + mtime) no media-cache.
4. **users.json derrubava o bot.** Arquivo com `users` não-objeto quebrava, e
   registro antigo gerava `NaN` em acessos. Corrigido com `sanitizeUsers`.
5. **Tela do hub de admin era inalcançável.** O menu levava direto às
   estatísticas, então o botão de Usuários nunca aparecia. Corrigido com o
   callback `admin_home` e `ownerOnly` no hub.
6. **Dados legíveis por outros usuários da máquina** (modo 644). Agora 600.

Ao criar um callback novo, **verifique se ele é alcançável** a partir de algum
teclado, e se o Voltar leva a algum lugar que não seja a própria tela.

### Mídia do menu: use MP4 puro, não GIF

O Telegram **não exibe GIF como GIF**. Ele reencoda a mídia para MP4 antes de
exibir como animação, e nessa reencodagem o loop se perde.

- Use `assets/start.mp4` (H.264, `yuv420p`, sem faixa de áudio).
- Envie com `sendAnimation` e **sempre** informe `filename`, senão o Telegraf
  batiza o upload como `animation.mp4`.
- Não use `sendDocument`: preserva a extensão, mas não roda em loop no balão.
- Não use GIF como fonte: foram cinco tentativas falhas até chegar no MP4 puro.

## Arquitetura das telas

- `src/telegram/screens/screens.ts` centraliza legendas, teclados e callbacks.
  Adicione uma tela nova lá e registre no `screenForCallback`.
- `src/telegram/handlers/callback-handler.ts` só traduz callback em tela e
  renderiza. Ele **edita** a mensagem (`editMessageCaption`) em vez de enviar
  outra, para a mídia continuar rodando e o chat não encher.
- Toda tela interna tem o botão `⬅️ Voltar` (`nav_back`).
- `src/data/` guarda a persistência local: `users.json` e `media-cache.json`.
  Ambos em `DATA_DIR`, que não é versionado.
- Novos campos de perfil vão em `UserRecord` (`src/data/user-store.ts`) e na
  legenda em `buildProfileCaption`.
- **Nunca monte legenda só com o registro persistido.** O `Screen.buildCaption`
  recebe um `ScreenContext` com `user` (pode não existir) e `telegramUser` (vem
  no update). `resolveDisplayName(user, telegramUser)` é a fonte única do nome:
  registro, depois Telegram, depois rótulo neutro. Assim a tela não cai em
  placeholder quando o `data/users.json` está ausente.
- Novos comandos: adicione em `BOT_COMMANDS` (`screens.ts`), crie o módulo em
  `commands/` e registre no `index.ts`. A lista de `BOT_COMMANDS` alimenta o
  `/help` e o `setMyCommands`, então não duplique descrições.
- Telas restritas: marque `ownerOnly: true` na tela. O handler de callbacks
  confere `users.isOwner(ctx.from.id)` antes de renderizar. **Nunca** confie no
  payload do callback para autorização — ele vem do cliente e pode ser forjado.
- O filtro `bot.action` é **derivado de `CALLBACKS`**, então um prefixo novo
  entra sozinho. Mas um callback novo ainda precisa de **tela** em
  `screenForCallback` ou de **tratamento explícito** no handler. O teste
  "callbacks alcançáveis" falha se você esquecer — isso já causou bug duas vezes.
- Ações que não são navegação (ex.: conectar/desconectar) devem ser tratadas
  **antes** da checagem `screen === undefined`, senão caem no fallback.
- Proteção contra abuso: `RateLimiter` (`src/core/rate-limiter.ts`) é puro e
  testável com relógio injetável. O middleware fica em
  `handlers/rate-limit.ts` e **precisa ser registrado antes dos comandos**,
  senão o trabalho caro já terá acontecido. O dono é isento.
- **A ordem de registro no `index.ts` importa**: comandos e callbacks primeiro,
  `registerMessageHandler` por último. Ele é o fallback e só deve tratar o que
  ninguém mais tratou.

## Estado atual (primeira etapa)

Implementado: configuração validada, logger, `/start` com mídia + legenda +
botões em uma única mensagem, menu de quatro botões, tela de perfil com dados
persistidos, navegação com botão de voltar e tratamento de callbacks.

- `assets/start.mp4` é a única mídia do menu (540x300, H.264, sem áudio).
- Persistência local em `data/`: `users.json` e `media-cache.json`.
- Planos: `padrao` e `dono`. O dono vem de `DEFAULT_OWNER_TELEGRAM_ID`
  (`src/config/config.ts`) e pode ser trocado por `OWNER_TELEGRAM_ID` no `.env`.
- O token real fica apenas no `.env` local, que não é versionado.

Pendente e dependente do proprietário: ID do dono e definição do fork da
Baileys.
