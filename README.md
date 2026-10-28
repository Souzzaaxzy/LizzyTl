# 𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲

Bot de Telegram com identidade visual própria, arquitetura modular e preparação
para uma futura integração com o WhatsApp através de um fork da Baileys.

Esta é a **primeira etapa** do projeto: estrutura inicial, configuração, menu
principal do comando `/start` e o tratamento dos botões inline. Nenhuma outra
funcionalidade foi implementada nesta fase.

---

## Sumário

- [Descrição do projeto](#descrição-do-projeto)
- [Tecnologias utilizadas](#tecnologias-utilizadas)
- [Requisitos](#requisitos)
- [Instalação no Termux](#instalação-no-termux)
- [Configuração do token](#configuração-do-token)
- [Localização da mídia](#localização-da-mídia)
- [Perfil](#perfil)
- [Comandos para iniciar e compilar](#comandos-para-iniciar-e-compilar)
- [Como executar os testes](#como-executar-os-testes)
- [Solução para problemas comuns](#solução-para-problemas-comuns)
- [Estado atual da integração com WhatsApp](#estado-atual-da-integração-com-whatsapp)
- [Migração futura para Linux](#migração-futura-para-linux)
- [Estrutura do projeto](#estrutura-do-projeto)

---

## Descrição do projeto

Ao enviar `/start`, a Lizzy:

1. identifica o usuário e monta uma saudação personalizada;
2. envia a mídia do menu (`assets/start.mp4`) **com a legenda e os botões
   inline na mesma mensagem**;
3. apresenta quatro botões organizados em duas colunas.

Representação ilustrativa do menu (os botões reais são inline da API do Telegram):

```
┌─────────────────┬──────────────────┐
│    👤 Perfil    │ ⚙️ Configurações │
├─────────────────┼──────────────────┤
│   📱 WhatsApp   │ ℹ️ Sobre a Lizzy │
└─────────────────┴──────────────────┘
```

Os callbacks são estáveis e centralizados em `src/telegram/menus/main-menu.ts`:

| Botão            | Callback         |
| ---------------- | ---------------- |
| 👤 Perfil        | `menu_profile`   |
| ⚙️ Configurações | `menu_settings`  |
| 📱 WhatsApp      | `menu_whatsapp`  |
| ℹ️ Sobre a Lizzy | `menu_about`     |

Cada botão apenas informa o estado real da seção. Nenhuma função fictícia é
executada nesta etapa.

## Tecnologias utilizadas

- **Node.js** (>= 20)
- **TypeScript**
- **Telegraf** — biblioteca estável para a API do Telegram
- **dotenv** — leitura do arquivo `.env`
- **tsx** — execução de TypeScript em desenvolvimento
- **node:test** — testes automatizados sem dependências extras
- **npm** e **Git**

## Requisitos

- Node.js 20 ou superior
- npm
- Um token de bot do Telegram (obtido com o [@BotFather](https://t.me/BotFather))

## Instalação no Termux

```bash
pkg update && pkg upgrade
pkg install nodejs-lts git

git clone https://github.com/Souzzaaxzy/LizzyTl.git
cd LizzyTl

npm install
cp .env.example .env
# edite o .env e informe o TELEGRAM_BOT_TOKEN
```

## Configuração do token

O arquivo `.env` (não versionado) deve conter:

```env
TELEGRAM_BOT_TOKEN=seu-token-aqui
START_MEDIA_PATH=assets/start.mp4
LOG_LEVEL=info
```

- `TELEGRAM_BOT_TOKEN` é **obrigatório**. Se estiver ausente, o processo encerra
  com uma mensagem explicando como configurá-lo, sem imprimir o token.
- `START_MEDIA_PATH` é o caminho da mídia do menu. Aceita caminho relativo à
  raiz do projeto ou absoluto. O valor padrão é `assets/start.mp4`.
- `OWNER_TELEGRAM_ID` é opcional e sobrescreve o dono definido no código. O
  usuário com esse ID recebe o plano `Dono` no perfil.
- `LOG_LEVEL` aceita `error`, `warn`, `info` ou `debug`. Valores inválidos
  assumem `info`.
- `DATA_DIR` é opcional e reserva um diretório para dados locais privados
  (futuras sessões do WhatsApp). Não é versionado.

## Localização da mídia

A mídia do menu fica em `assets/start.mp4`. O caminho é configurável por
`START_MEDIA_PATH`, então o arquivo pode ser trocado sem alterar a lógica do
`/start`.

O envio usa `sendAnimation`, que exibe a mídia rodando sozinha, em loop, dentro
do balão da mensagem. A legenda e os botões vão na mesma mensagem.

Se o arquivo não existir, o bot **não encerra e não gera erro sem explicação**:
ele registra um aviso no log com o caminho onde procurou e envia a legenda com
os botões, sem a mídia. Ao adicionar o arquivo, o envio volta automaticamente
ao formato normal.

## Comandos para iniciar e compilar

| Comando             | O que faz                                             |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Executa em modo desenvolvimento com recarga (tsx)     |
| `npm run build`     | Compila o TypeScript para `dist/`                     |
| `npm start`         | Compila automaticamente e executa o build             |
| `npm run typecheck` | Verifica os tipos sem gerar arquivos                  |
| `npm test`          | Executa os testes automatizados                       |

## Como executar os testes

```bash
npm test
```

Os testes usam `node:test` e substituem as chamadas HTTP do Telegram por um
gravador, então **não é necessária uma conexão real com o Telegram**. Eles
cobrem: token ausente, mídia ausente, mídia presente, saudação com e sem username,
disposição e callbacks dos quatro botões, callbacks inválidos e ausência de
segredos nas mensagens de erro.

## Perfil

O botão **👤 Perfil** abre um cartão com os dados do usuário, lidos de
`data/users.json`:

```
👤 𝐏𝐞𝐫𝐟𝐢𝐥

♛ 𝐍𝐨𝐦𝐞: Souzza
✦ 𝐔𝐬𝐮𝐚́𝐫𝐢𝐨: @souzza
✧ 𝐈𝐃: 6001

♛ 𝐏𝐥𝐚𝐧𝐨: 𝐏𝐚𝐝𝐫𝐚̃𝐨
✦ 𝐄𝐧𝐭𝐫𝐨𝐮 𝐞𝐦: 28/10/2026
✧ 𝐀𝐜𝐞𝐬𝐬𝐨𝐬: 7
```

O perfil é somente leitura nesta etapa, e toda tela tem o botão **⬅️ Voltar**
para o menu principal. Ao navegar, a legenda da mensagem é editada em vez de
enviar outra — assim a mídia continua rodando e o chat não enche de mensagens.

### Dados salvos

Tudo fica em `data/`, que não é versionado:

| Arquivo | Conteúdo |
| --- | --- |
| `data/users.json` | Usuários: nome, username, plano, data de entrada, acessos |
| `data/media-cache.json` | `file_id` da mídia, para não reenviar o arquivo |

A data de entrada é gravada no **primeiro `/start`**, não ao abrir o perfil. A
escrita é atômica (grava em arquivo temporário e renomeia), para não corromper
o JSON se o processo cair no meio.

Apagar o `data/users.json` zera todos os perfis.

### Dono

O ID do dono está definido no código (`DEFAULT_OWNER_TELEGRAM_ID`, em
`src/config/config.ts`). Quem tiver esse ID aparece com o plano `Dono` no
perfil; os demais ficam como `Padrão`.

Para trocar o dono sem mexer no código, defina `OWNER_TELEGRAM_ID` no `.env` —
esse valor tem prioridade sobre o do código. Para descobrir um ID: abra o
Perfil no bot e veja o campo `𝐈𝐃`.

### Planos

Hoje existem apenas `Padrão` e `Dono`. Novos planos serão adicionados depois.

## Solução para problemas comuns

- **`Error: Cannot find module '.../dist/index.js'`** — o `dist/` é artefato de
  build e não vai para o Git, então um clone novo não o possui. O `npm start`
  já compila automaticamente, mas se o erro aparecer, rode:

  ```bash
  npm run build
  npm start
  ```

  Confirme também que o `npm install` foi executado e que você está na pasta do
  projeto (onde ficam o `package.json` e o `src/`).
- **"TELEGRAM_BOT_TOKEN não foi configurado."** — a própria mensagem mostra qual
  dos dois casos ocorreu:
  - *Nenhum arquivo .env foi encontrado* — você precisa criá-lo:
    `cp .env.example .env`.
  - *O arquivo .env foi encontrado, mas a linha está vazia* — o arquivo existe,
    falta colar o token nele.

  Nos dois casos, edite o `.env` e preencha a linha
  `TELEGRAM_BOT_TOKEN=<numero-do-bot>:<segredo>`, sem espaços e sem aspas.
- **`401 Unauthorized`** — o token está incorreto ou expirado. Gere um novo com
  o @BotFather.
- **`409 Conflict`** — existe outra instância do mesmo bot em execução. Encerre
  a outra sessão.
- **A mensagem chega sem a mídia** — o arquivo não existe no caminho
  configurado. Confira `START_MEDIA_PATH` e o arquivo em `assets/`. O log
  mostra o caminho exato onde o bot procurou.
- **`tsx: command not found`** — execute `npm install` novamente.
- **O bot para quando o Termux fica em segundo plano** — o Android suspende
  processos em segundo plano. Não há garantia de execução contínua no Android;
  para operação contínua use um servidor Linux.

## Estado atual da integração com WhatsApp

**Não implementada.** O arquivo `src/whatsapp/client.ts` é apenas um ponto de
integração futura: ele não abre conexão, não gera QR Code e não armazena sessão.
A escolha do fork da Baileys será feita pelo proprietário do projeto antes de
qualquer implementação. O menu informa esse estado de forma honesta e nunca
declara que o WhatsApp está conectado.

## Migração futura para Linux

- O projeto não depende de caminhos absolutos: os caminhos são resolvidos a
  partir da raiz do projeto.
- Basta instalar Node.js 20+, clonar o repositório, executar `npm install`,
  `npm run build` e `npm start`.
- Para execução contínua, use um gerenciador de processos (por exemplo
  `systemd` ou `pm2`) em vez de deixar o processo em primeiro plano.

## Estrutura do projeto

```
.
├── src/
│   ├── index.ts                     # entrada: configura, registra e inicia o bot
│   ├── config/config.ts             # leitura e validação das variáveis de ambiente
│   ├── core/logger.ts               # logger sem dependências externas
│   ├── telegram/
│   │   ├── client.ts                # criação do cliente Telegraf
│   │   ├── commands/start.ts        # comando /start
│   │   ├── menus/main-menu.ts       # legenda, botões e respostas dos callbacks
│   │   └── handlers/callback-handler.ts # tratamento dos callbacks inline
│   └── whatsapp/client.ts           # ponto de integração futura (sem conexão)
├── tests/                           # testes automatizados (node:test)
├── assets/                          # contém start.mp4
├── data/                            # dados locais privados (não versionado)
├── .env.example
├── package.json
└── tsconfig.json
```
