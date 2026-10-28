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

## Lições aprendidas (não repita estes erros)

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
- Novos comandos: adicione em `BOT_COMMANDS` (`screens.ts`), crie o módulo em
  `commands/` e registre no `index.ts`. A lista de `BOT_COMMANDS` alimenta o
  `/help` e o `setMyCommands`, então não duplique descrições.
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
