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

## Estado atual (primeira etapa)

Implementado: configuração validada, logger, comando `/start` com GIF + legenda
+ botões em uma única mensagem, menu de quatro botões em duas colunas e
tratamento de callbacks.

Pendente e dependente do proprietário: arquivo `assets/start.gif`, token real e
definição do fork da Baileys.
