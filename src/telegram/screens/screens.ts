/**
 * Definição das telas da 𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲.
 *
 * Cada tela sabe montar sua legenda e seu teclado. O handler de callbacks só
 * traduz o identificador recebido em uma tela e a renderiza, então adicionar
 * uma tela nova não exige mexer na navegação.
 */

import { Markup } from 'telegraf';
import type { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

import type { Plan, UserRecord } from '../../data/user-store';

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

export interface Screen {
  id: ScreenId;
  /** Recebe o registro do usuário (ou null quando não há) e devolve a legenda. */
  buildCaption(user: UserRecord | null): string;
  buildKeyboard(): InlineKeyboardMarkup;
}

/** Nome oficial do bot. Não substitua por nomes genéricos. */
export const BOT_NAME = '𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲';

export const BACK_BUTTON_LABEL = '⬅️ Voltar';

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

/** Legenda do perfil, montada a partir do registro do usuário. */
export function buildProfileCaption(user: UserRecord | null): string {
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
    buildCaption: () => buildMenuCaption('usuário'),
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
