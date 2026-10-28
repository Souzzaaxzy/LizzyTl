/**
 * Definição das telas da 𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲.
 *
 * Cada tela sabe montar sua legenda e seu teclado. O handler de callbacks só
 * traduz o identificador recebido em uma tela e a renderiza, então adicionar
 * uma tela nova não exige mexer na navegação.
 */

import { Markup } from 'telegraf';
import type { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

import type { Plan, TelegramUserLike, UserRecord } from '../../data/user-store';

/** Identificadores estáveis de callback. Nunca reaproveite um valor antigo. */
export const CALLBACKS = {
  MENU_PROFILE: 'menu_profile',
  MENU_SETTINGS: 'menu_settings',
  MENU_WHATSAPP: 'menu_whatsapp',
  MENU_ABOUT: 'menu_about',
  NAV_BACK: 'nav_back',
} as const;

export type CallbackId = (typeof CALLBACKS)[keyof typeof CALLBACKS];

export type ScreenId = 'menu' | 'profile' | 'settings' | 'whatsapp' | 'about';

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
}

export interface Screen {
  id: ScreenId;
  buildCaption(context: ScreenContext): string;
  buildKeyboard(): InlineKeyboardMarkup;
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
  ]).reply_markup;
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
    `✧ 𝐈𝐃: ${user.id}`,
    '',
    `♛ 𝐏𝐥𝐚𝐧𝐨: ${PLAN_LABELS[user.plan]}`,
    `✦ 𝐄𝐧𝐭𝐫𝐨𝐮 𝐞𝐦: ${formatDate(user.firstSeenAt)}`,
    `✧ 𝐀𝐜𝐞𝐬𝐬𝐨𝐬: ${user.accessCount}`,
  ].join('\n');
}

/** As telas internas compartilham o botão de voltar. */
export const SCREENS: Record<ScreenId, Screen> = {
  menu: {
    id: 'menu',
    // Usa o nome resolvido do contexto: registro persistido ou dados do Telegram.
    buildCaption: (context) => buildMenuCaption(context.displayName),
    buildKeyboard: buildMenuKeyboard,
  },
  profile: {
    id: 'profile',
    buildCaption: buildProfileCaption,
    buildKeyboard: backKeyboard,
  },
  settings: {
    id: 'settings',
    buildCaption: () =>
      [
        '⚙️ 𝐂𝐨𝐧𝐟𝐢𝐠𝐮𝐫𝐚𝐜̧𝐨̃𝐞𝐬',
        '',
        'A seção de configurações será implementada posteriormente.',
      ].join('\n'),
    buildKeyboard: backKeyboard,
  },
  whatsapp: {
    id: 'whatsapp',
    buildCaption: () =>
      [
        '📱 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩',
        '',
        'Módulo em preparação.',
        'A integração com o WhatsApp ainda não foi implementada e nenhuma conexão real foi validada até o momento.',
      ].join('\n'),
    buildKeyboard: backKeyboard,
  },
  about: {
    id: 'about',
    buildCaption: () =>
      [
        BOT_NAME,
        '',
        'Bot em desenvolvimento, com suporte ao Telegram e integração com WhatsApp planejada.',
      ].join('\n'),
    buildKeyboard: backKeyboard,
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
    case CALLBACKS.NAV_BACK:
      return SCREENS.menu;
    default:
      return undefined;
  }
}
