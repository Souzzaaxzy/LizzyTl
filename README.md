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
- [Localização do GIF](#localização-do-gif)
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
2. envia o GIF do menu (`assets/start.gif`) **com a legenda e os botões inline
   na mesma mensagem**;
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
START_GIF_PATH=assets/start.gif
LOG_LEVEL=info
```

- `TELEGRAM_BOT_TOKEN` é **obrigatório**. Se estiver ausente, o processo encerra
  com uma mensagem explicando como configurá-lo, sem imprimir o token.
- `START_GIF_PATH` é opcional e aceita caminho relativo à raiz do projeto ou
  absoluto. O valor padrão é `assets/start.gif`.
- `START_MP4_PATH` é o caminho do MP4 do menu. No modo `animation` ele tem
  prioridade sobre o GIF, porque o Telegram usa o arquivo como está, sem
  reencodar. O valor padrão é `assets/start.mp4`.
- `START_MEDIA_MODE` controla como a mídia é enviada:
  - `animation` (padrão): a mídia roda sozinha, em loop infinito, dentro do
    balão da mensagem. É o comportamento de GIF que o Telegram exibe no chat.
  - `document`: envia o arquivo como anexo `.gif`, preservando a extensão, mas
    sem rodar em loop no balão.
- `LOG_LEVEL` aceita `error`, `warn`, `info` ou `debug`. Valores inválidos
  assumem `info`.
- `DATA_DIR` é opcional e reserva um diretório para dados locais privados
  (futuras sessões do WhatsApp). Não é versionado.

## Localização do GIF

O menu usa dois arquivos, ambos já presentes no repositório:

| Arquivo | Tamanho | Papel |
| --- | --- | --- |
| `assets/start.mp4` | 293 KB | Preferido no modo `animation` |
| `assets/start.gif` | 2,6 MB | Alternativa e modo `document` |

Por que o MP4 é preferido: o Telegram não exibe GIF como GIF. Ele reencoda a
mídia para MP4 antes de exibir como animação, e nessa reencodagem o loop pode
se perder. Enviando um MP4 H.264 já pronto, sem áudio, o Telegram usa o arquivo
como está e a animação roda em loop, sem reencodagem.

A escolha é automática: no modo `animation` o MP4 é usado se existir; se não
existir, o GIF é usado. No modo `document` a ordem se inverte. Os caminhos são
configuráveis por `START_MP4_PATH` e `START_GIF_PATH`.

Para regerar os arquivos a partir de um vídeo de origem (requer `ffmpeg`):

```bash
# MP4 para animação: H.264, sem áudio, pixel format yuv420p
ffmpeg -y -i origem.mp4 -c:v libx264 -pix_fmt yuv420p -profile:v main -crf 20 -an \
  -movflags +faststart assets/start.mp4

# GIF alternativo, com paleta própria para evitar quadriculado
ffmpeg -y -i origem.mp4 -vf "fps=10,scale=540:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle" -loop 0 assets/start.gif
```

Se nenhum dos dois arquivos existir, o bot **não encerra e não gera erro sem
explicação**: ele registra um aviso no log e envia a legenda com os botões, sem
a mídia. Ao adicionar o arquivo, o envio volta automaticamente ao formato
normal.

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
cobrem: token ausente, GIF ausente, GIF presente, saudação com e sem username,
disposição e callbacks dos quatro botões, callbacks inválidos e ausência de
segredos nas mensagens de erro.

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
- **A mensagem chega sem o GIF** — o arquivo não existe no caminho configurado.
  Confira `START_GIF_PATH` e o arquivo em `assets/`.
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
├── assets/                          # contém start.gif (não versionado)
├── data/                            # dados locais privados (não versionado)
├── .env.example
├── package.json
└── tsconfig.json
```
