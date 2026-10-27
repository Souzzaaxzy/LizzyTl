/**
 * Definição central do menu principal da 𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲.
 *
 * Tudo que diz respeito à legenda, aos botões e às respostas dos callbacks
 * fica neste módulo para que futuras alterações não exijam mexer no comando
 * /start nem no handler de callbacks.
 */

import { Markup } from 'telegraf';
import type { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

/** Identificadores estáveis de callback. Nunca reaproveite um valor antigo. */
export const MENU_CALLBACKS = {
  PROFILE: 'menu_profile',
  SETTINGS: 'menu_settings',
  WHATSAPP: 'menu_whatsapp',
  ABOUT: 'menu_about',
} as const;

export type MenuCallback = (typeof MENU_CALLBACKS)[keyof typeof MENU_CALLBACKS];

export interface MenuButton {
  /** Identificador de callback enviado ao Telegram. */
  callback: MenuCallback;
  /** Rótulo exibido no botão inline. */
  label: string;
  /** Texto apresentado quando o botão é pressionado. */
  response: string;
}

/** Nome oficial do bot. Não substitua por nomes genéricos. */
export const BOT_NAME = '𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲';

export const MENU_BUTTONS: readonly MenuButton[] = [
  {
    callback: MENU_CALLBACKS.PROFILE,
    label: '👤 Perfil',
    response: [
      '👤 𝐏𝐞𝐫𝐟𝐢𝐥',
      '',
      'A seção de perfil já está reservada e será implementada em uma próxima etapa.',
    ].join('\n'),
  },
  {
    callback: MENU_CALLBACKS.SETTINGS,
    label: '⚙️ Configurações',
    response: [
      '⚙️ 𝐂𝐨𝐧𝐟𝐢𝐠𝐮𝐫𝐚𝐜̧𝐨̃𝐞𝐬',
      '',
      'A seção de configurações será implementada posteriormente.',
    ].join('\n'),
  },
  {
    callback: MENU_CALLBACKS.WHATSAPP,
    label: '📱 WhatsApp',
    response: [
      '📱 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩',
      '',
      'Módulo em preparação.',
      'A integração com o WhatsApp ainda não foi implementada e nenhuma conexão real foi validada até o momento.',
    ].join('\n'),
  },
  {
    callback: MENU_CALLBACKS.ABOUT,
    label: 'ℹ️ Sobre a Lizzy',
    response: [
      BOT_NAME,
      '',
      'Bot em desenvolvimento, com suporte ao Telegram e integração com WhatsApp planejada.',
    ].join('\n'),
  },
];

const BUTTONS_BY_CALLBACK = new Map<string, MenuButton>(
  MENU_BUTTONS.map((button) => [button.callback, button]),
);

/**
 * Escapa os caracteres que a API do Telegram interpreta como HTML.
 * Impede que dados enviados pelo usuário sejam interpretados como marcação.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Monta a legenda oficial do menu com a saudação personalizada. */
export function buildStartCaption(displayName: string): string {
  const name = escapeHtml(displayName.trim());
  return [
    `✦ 𝐎𝐢𝐢, ${name}! 𖤐`,
    '',
    `♛ 𝐒𝐢𝐬𝐭𝐞𝐦𝐚 ${BOT_NAME} 𝐚𝐭𝐢𝐯𝐨.`,
    '',
    '𝐒𝐞𝐥𝐞𝐜𝐢𝐨𝐧𝐞 𝐮𝐦𝐚 𝐨𝐩çã𝐨 𝐚𝐛𝐚𝐢𝐱𝐨 𝐩𝐚𝐫𝐚 𝐚𝐜𝐞𝐬𝐬𝐚𝐫 𝐨 𝐬𝐢𝐬𝐭𝐞𝐦𝐚. ♛',
  ].join('\n');
}

/**
 * Teclado inline do menu: quatro botões em duas colunas.
 *
 * ┌─────────────────┬──────────────────┐
 * │    👤 Perfil    │ ⚙️ Configurações │
 * ├─────────────────┼──────────────────┤
 * │   📱 WhatsApp   │ ℹ️ Sobre a Lizzy │
 * └─────────────────┴──────────────────┘
 */
export function buildMainMenuKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [Markup.button.callback(MENU_BUTTONS[0]!.label, MENU_BUTTONS[0]!.callback), Markup.button.callback(MENU_BUTTONS[1]!.label, MENU_BUTTONS[1]!.callback)],
    [Markup.button.callback(MENU_BUTTONS[2]!.label, MENU_BUTTONS[2]!.callback), Markup.button.callback(MENU_BUTTONS[3]!.label, MENU_BUTTONS[3]!.callback)],
  ]).reply_markup;
}

/** Retorna a resposta de um callback válido, ou undefined se for desconhecido. */
export function getMenuResponse(callbackData: string): string | undefined {
  return BUTTONS_BY_CALLBACK.get(callbackData)?.response;
}
