/**
 * Definição das telas da 𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲.
 *
 * Cada tela sabe montar sua legenda e seu teclado. O handler de callbacks só
 * traduz o identificador recebido em uma tela e a renderiza, então adicionar
 * uma tela nova não exige mexer na navegação.
 */

import { Markup } from 'telegraf';

/**
 * Tipo do teclado inline. Derivado do próprio Markup para não depender de
 * caminhos internos do Telegraf, que não resolvem em ESM.
 */
type InlineKeyboardMarkup = ReturnType<typeof Markup.inlineKeyboard>['reply_markup'];

import type { Plan, StoreStats, TelegramUserLike, UserRecord } from '../../data/user-store.js';
import type { WhatsAppStatus } from '../../whatsapp/client.js';

/** Identificadores estáveis de callback. Nunca reaproveite um valor antigo. */
export const CALLBACKS = {
  MENU_PROFILE: 'menu_profile',
  MENU_SETTINGS: 'menu_settings',
  MENU_WHATSAPP: 'menu_whatsapp',
  MENU_ABOUT: 'menu_about',
  NAV_BACK: 'nav_back',
  WA_CONNECT: 'wa_connect',
  WA_DISCONNECT: 'wa_disconnect',
  MENU_TOOLS: 'menu_tools',
  TOOL_FLOODP: 'tool_floodp',
  TOOL_FLOODGHOST: 'tool_floodghost',
  TOOL_STATUS: 'tool_status',
  TOOL_multi: 'tool_multi',
  TOOL_CONFIG: 'tool_config',
  ADMIN_HOME: 'admin_home',
  ADMIN_STATS: 'admin_stats',
  ADMIN_USERS: 'admin_users',
} as const;

export type CallbackId = (typeof CALLBACKS)[keyof typeof CALLBACKS];

export type ScreenId =
  | 'menu'
  | 'profile'
  | 'settings'
  | 'whatsapp'
  | 'about'
  | 'tools'
  | 'toolfloodp' 
  | 'toolfloodghost'
  | 'toolstatus'
  | 'toolmulti'
  | 'toolTiktok'
  | 'admin'
  | 'adminStats'
  | 'adminUsers';

/**
 * Dados disponíveis para montar uma tela.
 *
 * `user` é o registro persistido (pode não existir) e `telegramUser` são os
 * dados que vieram no próprio update. Manter os dois evita que a tela caia em
 * placeholder quando o registro falta, mesmo tendo o nome real à mão.
 */
export interface ScreenContext {
  user: UserRecord | null;
  telegramUser?: TelegramUserLike;
  /** Nome já resolvido para exibição. */
  displayName: string;
  /** Estado real da conexão do WhatsApp, para a tela correspondente. */
  whatsapp?: WhatsAppStatus;
  /**
   * Dados de administração. Só é preenchido quando quem navega é o dono, e
   * quem decide isso é o servidor — nunca o payload do callback.
   */
  admin?: {
    stats: StoreStats;
    recentUsers: UserRecord[];
    totalUsers: number;
  };
}

export interface Screen {
  id: ScreenId;
  buildCaption(context: ScreenContext): string;
  buildKeyboard(context: ScreenContext): InlineKeyboardMarkup;
  /**
   * Quando verdadeiro, a tela só pode ser aberta pelo dono. O handler de
   * callbacks confere isso no servidor antes de renderizar.
   */
  ownerOnly?: boolean;
}

/** Nome oficial do bot. Não substitua por nomes genéricos. */
export const BOT_NAME = '𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲';

export const BACK_BUTTON_LABEL = '⬅️ Voltar';

/**
 * Comandos do bot. Fonte única: alimenta tanto o /help quanto o setMyCommands,
 * que faz a lista aparecer quando o usuário digita "/" no Telegram.
 */
export const BOT_COMMANDS: ReadonlyArray<{ command: string; description: string }> = [
  { command: 'start', description: 'Abrir o menu principal' },
  { command: 'help', description: 'Ver os comandos disponíveis' },
];

/** Legenda da tela de ajuda, montada a partir de BOT_COMMANDS. */
export function buildHelpCaption(): string {
  const lines = BOT_COMMANDS.map((c) => `/${c.command} — ${c.description}`);
  return [
    '✦ 𝐀𝐣𝐮𝐝𝐚',
    '',
    '𝐂𝐨𝐦𝐚𝐧𝐝𝐨𝐬 𝐝𝐢𝐬𝐩𝐨𝐧í𝐯𝐞𝐢𝐬:',
    '',
    ...lines,
    '',
    '♛ 𝐔𝐬𝐞 /start 𝐩𝐚𝐫𝐚 𝐚𝐛𝐫𝐢𝐫 𝐨 𝐦𝐞𝐧𝐮 𝐩𝐫𝐢𝐧𝐜𝐢𝐩𝐚𝐥.',
  ].join('\n');
}

/** Rótulos dos planos exibidos no perfil. */
export const PLAN_LABELS: Record<Plan, string> = {
  padrao: '𝐏𝐚𝐝𝐫𝐚̃𝐨',
  dono: '𝐃𝐨𝐧𝐨',
};

/** Escapa os caracteres que a API do Telegram interpreta como HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Teclado com um único botão de voltar, usado em toda tela interna. */
export function backKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    Markup.button.callback(BACK_BUTTON_LABEL, CALLBACKS.NAV_BACK),
  ]).reply_markup;
}

/** Adapta um teclado fixo para a assinatura que recebe contexto. */
function fixedKeyboard(keyboard: () => InlineKeyboardMarkup): (context: ScreenContext) => InlineKeyboardMarkup {
  return () => keyboard();
}

/** Formata uma data ISO como dd/mm/aaaa, sem depender de locale do sistema. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'desconhecida';
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Monta a legenda do menu principal, com a saudação personalizada. */
export function buildMenuCaption(displayName: string): string {
  return [
    `✦ 𝐎𝐢𝐢, ${escapeHtml(displayName)}! 𖤐`,
    '',
    `♛ 𝐒𝐢𝐬𝐭𝐞𝐦𝐚 ${BOT_NAME} 𝐚𝐭𝐢𝐯𝐨.`,
    '',
    '𝐒𝐞𝐥𝐞𝐜𝐢𝐨𝐧𝐞 𝐮𝐦𝐚 𝐨𝐩çã𝐨 𝐚𝐛𝐚𝐢𝐱𝐨 𝐩𝐚𝐫𝐚 𝐚𝐜𝐞𝐬𝐬𝐚𝐫 𝐨 𝐬𝐢𝐬𝐭𝐞𝐦𝐚. ♛',
  ].join('\n');
}

/**
 * Teclado do menu: quatro botões em duas colunas.
 *
 * ┌─────────────────┬──────────────────┐
 * │    👤 Perfil    │ ⚙️ Configurações │
 * ├─────────────────┼──────────────────┤
 * │   📱 WhatsApp   │ ℹ️ Sobre a Lizzy │
 * └─────────────────┴──────────────────┘
 */
export function buildMenuKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('👤 Perfil', CALLBACKS.MENU_PROFILE),
      Markup.button.callback('⚙️ Configurações', CALLBACKS.MENU_SETTINGS),
    ],
    [
      Markup.button.callback('📱 WhatsApp', CALLBACKS.MENU_WHATSAPP),
      Markup.button.callback('ℹ️ Sobre a Lizzy', CALLBACKS.MENU_ABOUT),
    ],
    // Largura total, como o painel do dono: as ferramentas não são navegação
    // comum, então ficam destacadas em linha própria.
    [Markup.button.callback('🛠️ Ferramentas', CALLBACKS.MENU_TOOLS)],
  ]).reply_markup;
}

/**
 * Teclado da tela de ferramentas.
 *
 * ┌──────────────┬──────────────┐
 * │ 📸 Instagram │  ▶️ YouTube  │
 * ├──────────────┼──────────────┤
 * │ 📘 Facebook  │     ✖️ X     │
 * ├──────────────┴──────────────┤
 * │          🎵 TikTok          │
 * └─────────────────────────────┘
 */
export function buildToolsKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📸 Instagram', CALLBACKS.TOOL_INSTAGRAM),
      Markup.button.callback('▶️ YouTube', CALLBACKS.TOOL_YOUTUBE),
    ],
    [
      Markup.button.callback('📘 Facebook', CALLBACKS.TOOL_FACEBOOK),
      Markup.button.callback('✖️ X', CALLBACKS.TOOL_X),
    ],
    [Markup.button.callback('🎵 TikTok', CALLBACKS.TOOL_TIKTOK)],
    [Markup.button.callback(BACK_BUTTON_LABEL, CALLBACKS.NAV_BACK)],
  ]).reply_markup;
}

/**
 * Tela de uma ferramenta que ainda não foi implementada.
 *
 * O botão existe para o usuário saber o que vem, mas a tela diz a verdade:
 * ainda não está pronto. Nunca afirmamos que uma operação funciona sem ela
 * existir de fato.
 */
function toolScreen(id: ScreenId, titulo: string, descricao: string): Screen {
  return {
    id,
    buildCaption: () => [titulo, '', descricao, '', '♛ 𝐄𝐦 𝐢𝐦𝐩𝐥𝐞𝐦𝐞𝐧𝐭𝐚𝐜̧𝐚̃𝐨.'].join('\n'),
    buildKeyboard: fixedKeyboard(backKeyboard),
  };
}

/**
 * Teclado do menu para o dono: os mesmos quatro botões mais a linha do painel.
 *
 * Esconder o botão é conveniência, não segurança — quem não é dono não
 * consegue abrir o painel mesmo forjando o callback, porque a autorização é
 * reconferida no servidor a cada ação.
 */
export function buildOwnerMenuKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('👤 Perfil', CALLBACKS.MENU_PROFILE),
      Markup.button.callback('⚙️ Configurações', CALLBACKS.MENU_SETTINGS),
    ],
    [
      Markup.button.callback('📱 WhatsApp', CALLBACKS.MENU_WHATSAPP),
      Markup.button.callback('ℹ️ Sobre a Lizzy', CALLBACKS.MENU_ABOUT),
    ],
    [Markup.button.callback('🛠️ Ferramentas', CALLBACKS.MENU_TOOLS)],
    [Markup.button.callback('🛡️ Painel do dono', CALLBACKS.ADMIN_HOME)],
  ]).reply_markup;
}

/**
 * Teclado do menu conforme quem está navegando: o dono ganha a linha do painel.
 */
export function menuKeyboardFor(context?: ScreenContext): InlineKeyboardMarkup {
  return context?.admin ? buildOwnerMenuKeyboard() : buildMenuKeyboard();
}

/**
 * Nome exibido de um usuário registrado: prefere o @username e cai para o
 * primeiro nome. Mantém a saudação igual à do /start.
 */
export function displayNameFor(user: UserRecord): string {
  return user.username ? `@${user.username}` : user.firstName;
}

/**
 * Nome para exibição, na ordem: registro persistido, dados do Telegram e, por
 * último, um rótulo neutro. Nunca devolve "@usuario" nem string vazia.
 */
export function resolveDisplayName(
  user: UserRecord | null,
  telegramUser?: TelegramUserLike,
): string {
  if (user) {
    return displayNameFor(user);
  }
  const username = telegramUser?.username?.trim();
  if (username) {
    return `@${username}`;
  }
  const firstName = telegramUser?.first_name?.trim();
  if (firstName) {
    return firstName;
  }
  return 'usuário';
}

/** Monta o contexto de uma tela a partir do registro e do usuário do Telegram. */
export function screenContext(
  user: UserRecord | null,
  telegramUser?: TelegramUserLike,
): ScreenContext {
  return { user, telegramUser, displayName: resolveDisplayName(user, telegramUser) };
}

/** Legenda do perfil, montada a partir do registro do usuário. */
export function buildProfileCaption(context: ScreenContext): string {
  const { user } = context;
  if (user === null) {
    return ['👤 𝐏𝐞𝐫𝐟𝐢𝐥', '', 'Não foi possível carregar seus dados.'].join('\n');
  }

  const username = user.username ? `@${escapeHtml(user.username)}` : '𝑛𝑎̃𝑜 𝑑𝑒𝑓𝑖𝑛𝑖𝑑𝑜';

  return [
    '👤 𝐏𝐞𝐫𝐟𝐢𝐥',
    '',
    `♛ 𝐍𝐨𝐦𝐞: ${escapeHtml(user.firstName)}`,
    `✦ 𝐔𝐬𝐮𝐚́𝐫𝐢𝐨: ${username}`,
    // <code> deixa o ID tocável: um toque copia, sem selecionar o texto.
    `✧ 𝐈𝐃: <code>${user.id}</code>`,
    '',
    `♛ 𝐏𝐥𝐚𝐧𝐨: ${PLAN_LABELS[user.plan]}`,
    `✦ 𝐄𝐧𝐭𝐫𝐨𝐮 𝐞𝐦: ${formatDate(user.firstSeenAt)}`,
    `✧ 𝐀𝐜𝐞𝐬𝐬𝐨𝐬: ${user.accessCount}`,
  ].join('\n');
}

/**
 * Teclado do painel do dono. Os dois botões são as ações disponíveis; o
 * botão de voltar fica na linha de baixo.
 */
export function adminKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📊 Estatísticas', CALLBACKS.ADMIN_STATS),
      Markup.button.callback('👥 Usuários', CALLBACKS.ADMIN_USERS),
    ],
    [Markup.button.callback(BACK_BUTTON_LABEL, CALLBACKS.NAV_BACK)],
  ]).reply_markup;
}

/**
 * Teclado das telas internas do painel. O Voltar retorna ao hub, para o dono
 * navegar entre as telas sem passar pelo menu a cada vez.
 */
/**
 * Teclado da tela do WhatsApp.
 *
 * O bot é público: todo usuário conecta o próprio número, então os botões
 * aparecem para todos. Cada sessão é isolada — o número de um nunca é usado
 * pela sessão de outro.
 */
export function whatsappKeyboard(context: ScreenContext): InlineKeyboardMarkup {
  const conectado = context.whatsapp?.state === 'conectado';
  const acao = conectado
    ? Markup.button.callback('🔌 Desconectar', CALLBACKS.WA_DISCONNECT)
    : Markup.button.callback('🔗 Conectar WhatsApp', CALLBACKS.WA_CONNECT);

  return Markup.inlineKeyboard([
    [acao],
    [Markup.button.callback(BACK_BUTTON_LABEL, CALLBACKS.NAV_BACK)],
  ]).reply_markup;
}

export function adminBackKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    Markup.button.callback(BACK_BUTTON_LABEL, CALLBACKS.ADMIN_HOME),
  ]).reply_markup;
}

/** Legenda da tela de estatísticas do painel. */
export function buildAdminStatsCaption(context: ScreenContext): string {
  const admin = context.admin;
  if (!admin) {
    return ['📊 𝐄𝐬𝐭𝐚𝐭í𝐬𝐭𝐢𝐜𝐚𝐬', '', 'Dados indisponíveis.'].join('\n');
  }
  const { stats } = admin;
  return [
    '📊 𝐄𝐬𝐭𝐚𝐭í𝐬𝐭𝐢𝐜𝐚𝐬',
    '',
    `♛ 𝐔𝐬𝐮𝐚́𝐫𝐢𝐨𝐬 𝐭𝐨𝐭𝐚𝐢𝐬: ${stats.totalUsers}`,
    `✦ 𝐀𝐜𝐞𝐬𝐬𝐨𝐬 𝐭𝐨𝐭𝐚𝐢𝐬: ${stats.totalAccesses}`,
    '',
    `♛ 𝐍𝐨𝐯𝐨𝐬 𝐡𝐨𝐣𝐞: ${stats.newToday}`,
    `✦ 𝐀𝐭𝐢𝐯𝐨𝐬 𝐡𝐨𝐣𝐞: ${stats.activeToday}`,
  ].join('\n');
}

/**
 * Legenda da lista de usuários recentes. O Telegram limita a legenda a 1024
 * caracteres, então a lista é curta por padrão.
 */
export function buildAdminUsersCaption(context: ScreenContext): string {
  const admin = context.admin;
  if (!admin) {
    return ['👥 𝐔𝐬𝐮𝐚́𝐫𝐢𝐨𝐬', '', 'Dados indisponíveis.'].join('\n');
  }
  if (admin.recentUsers.length === 0) {
    return ['👥 𝐔𝐬𝐮𝐚́𝐫𝐢𝐨𝐬', '', 'Nenhum usuário registrado ainda.'].join('\n');
  }

  const linhas = admin.recentUsers.map((u) => {
    const nome = u.username ? `@${u.username}` : u.firstName;
    const marca = u.plan === 'dono' ? ' ♛' : '';
    return `✦ ${escapeHtml(nome)} — ${u.id}${marca}`;
  });

  return [
    `👥 𝐔𝐬𝐮𝐚́𝐫𝐢𝐨𝐬 (${admin.totalUsers} 𝐧𝐨 𝐭𝐨𝐭𝐚𝐥)`,
    '',
    ...linhas,
    '',
    `♛ 𝐄𝐱𝐢𝐛𝐢𝐧𝐝𝐨 𝐨𝐬 ${admin.recentUsers.length} 𝐦𝐚𝐢𝐬 𝐫𝐞𝐜𝐞𝐧𝐭𝐞𝐬.`,
  ].join('\n');
}

/**
 * Rótulo legível de cada estado do WhatsApp.
 *
 * A tela nunca afirma "conectado" sem conexão real: o texto vem do estado que
 * o cliente reporta, não de uma suposição.
 */
export const WHATSAPP_STATE_LABELS: Record<WhatsAppStatus['state'], string> = {
  desligado: '🔴 Desligado',
  conectando: '🟡 Conectando',
  aguardando_pareamento: '🟡 Aguardando pareamento',
  conectado: '🟢 Conectado',
  erro: '🔴 Erro',
};

/** Legenda da tela do WhatsApp, com o estado real da conexão. */
export function buildWhatsappCaption(context: ScreenContext): string {
  const status = context.whatsapp;
  if (!status) {
    return [
      '📱 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩',
      '',
      'Estado indisponível no momento.',
    ].join('\n');
  }
  const linhas = [
    '📱 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩',
    '',
    `♛ 𝐄𝐬𝐭𝐚𝐝𝐨: ${WHATSAPP_STATE_LABELS[status.state]}`,
    '',
    `✦ ${escapeHtml(status.summary)}`,
  ];

  // Orienta qualquer usuário a conectar o próprio número.
  if (status.state !== 'conectado') {
    linhas.push(
      '',
      '♛ 𝐓𝐨𝐪𝐮𝐞 𝐞𝐦 "𝐂𝐨𝐧𝐞𝐜𝐭𝐚𝐫 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩" 𝐞 𝐞𝐧𝐯𝐢𝐞 𝐨 𝐧𝐮́𝐦𝐞𝐫𝐨 𝐜𝐨𝐦 𝐨',
      '  𝐜𝐨́𝐝𝐢𝐠𝐨 𝐝𝐨 𝐩𝐚𝐢́𝐬. 𝐄𝐱.: 5511999999999',
    );
  }

  return linhas.join('\n');
}

/** As telas internas compartilham o botão de voltar. */
export const SCREENS: Record<ScreenId, Screen> = {
  menu: {
    id: 'menu',
    // Usa o nome resolvido do contexto: registro persistido ou dados do Telegram.
    buildCaption: (context) => buildMenuCaption(context.displayName),
    buildKeyboard: menuKeyboardFor,
  },
  profile: {
    id: 'profile',
    buildCaption: buildProfileCaption,
    buildKeyboard: fixedKeyboard(backKeyboard),
  },
  settings: {
    id: 'settings',
    buildCaption: () =>
      [
        '⚙️ 𝐂𝐨𝐧𝐟𝐢𝐠𝐮𝐫𝐚𝐜̧𝐨̃𝐞𝐬',
        '',
        'A seção de configurações será implementada posteriormente.',
      ].join('\n'),
    buildKeyboard: fixedKeyboard(backKeyboard),
  },
  whatsapp: {
    id: 'whatsapp',
    buildCaption: buildWhatsappCaption,
    buildKeyboard: whatsappKeyboard,
  },
  about: {
    id: 'about',
    buildCaption: () =>
      [
        BOT_NAME,
        '',
        'Bot em desenvolvimento, com suporte ao Telegram e integração com WhatsApp planejada.',
      ].join('\n'),
    buildKeyboard: fixedKeyboard(backKeyboard),
  },
  tools: {
    id: 'tools',
    buildCaption: () =>
      [
        '🛠️ 𝐅𝐞𝐫𝐫𝐚𝐦𝐞𝐧𝐭𝐚𝐬',
        '',
        '♛ 𝐄𝐬𝐜𝐨𝐥𝐡𝐚 𝐨 𝐬𝐞𝐫𝐯𝐢𝐜̧𝐨 𝐩𝐚𝐫𝐚 𝐛𝐚𝐢𝐱𝐚𝐫 𝐨 𝐜𝐨𝐧𝐭𝐞𝐮́𝐝𝐨.',
      ].join('\n'),
    buildKeyboard: fixedKeyboard(buildToolsKeyboard),
  },
  toolfloodp: toolScreen('toolfloodp', '💸 FloodPayemnt', 'Flood de payment.'),
  toolfloodghost: toolScreen('toolfloodghost', '👻 FloodFantasma', 'Flood com mensagens fantasmas.'),
  toolstatus: toolScreen('toolstatus', '📡 FloodStatus', 'Flood em status.'),
  toolmulti: toolScreen('toolmulti', '👾 FloodMulti', 'Flood fantasma com status'),
  toolconfig: toolScreen('toolconfig', '⚙️ Config', 'Config Flood'),
  admin: {
    id: 'admin',
    ownerOnly: true,
    buildCaption: (context) =>
      [
        '🛡️ 𝐏𝐚𝐢𝐧𝐞𝐥 𝐝𝐨 𝐝𝐨𝐧𝐨',
        '',
        `♛ 𝐎𝐥𝐚́, ${escapeHtml(context.displayName)}.`,
        '✦ 𝐀𝐜𝐞𝐬𝐬𝐨 𝐫𝐞𝐬𝐭𝐫𝐢𝐭𝐨 𝐚𝐨 𝐩𝐫𝐨𝐩𝐫𝐢𝐞𝐭𝐚́𝐫𝐢𝐨 𝐝𝐚 𝐋𝐢𝐳𝐳𝐲.',
      ].join('\n'),
    buildKeyboard: adminKeyboard,
  },
  adminStats: {
    id: 'adminStats',
    buildCaption: buildAdminStatsCaption,
    buildKeyboard: fixedKeyboard(adminBackKeyboard),
    ownerOnly: true,
  },
  adminUsers: {
    id: 'adminUsers',
    buildCaption: buildAdminUsersCaption,
    buildKeyboard: fixedKeyboard(adminBackKeyboard),
    ownerOnly: true,
  },
};

/** Traduz um identificador de callback em uma tela, ou undefined se for inválido. */
export function screenForCallback(callbackData: string): Screen | undefined {
  switch (callbackData) {
    case CALLBACKS.MENU_PROFILE:
      return SCREENS.profile;
    case CALLBACKS.MENU_SETTINGS:
      return SCREENS.settings;
    case CALLBACKS.MENU_WHATSAPP:
      return SCREENS.whatsapp;
    case CALLBACKS.MENU_ABOUT:
      return SCREENS.about;
    case CALLBACKS.MENU_TOOLS:
      return SCREENS.tools;
    case CALLBACKS.TOOL_FLOODP:
      return SCREENS.toolfloodp;
    case CALLBACKS.TOOL_FLOODGHOST:
      return SCREENS.toolfloodghost;
    case CALLBACKS.TOOL_STATUS:
      return SCREENS.toolstatus;
    case CALLBACKS.TOOL_MULTI:
      return SCREENS.toolmulti;
    case CALLBACKS.TOOL_CONFIG:
      return SCREENS.toolconfig;
    case CALLBACKS.ADMIN_HOME:
      return SCREENS.admin;
    case CALLBACKS.ADMIN_STATS:
      return SCREENS.adminStats;
    case CALLBACKS.ADMIN_USERS:
      return SCREENS.adminUsers;
    case CALLBACKS.NAV_BACK:
      return SCREENS.menu;
    default:
      return undefined;
  }
}
