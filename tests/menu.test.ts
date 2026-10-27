import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MENU_BUTTONS,
  MENU_CALLBACKS,
  buildMainMenuKeyboard,
  buildStartCaption,
  escapeHtml,
  getMenuResponse,
} from '../src/telegram/menus/main-menu';

describe('menu principal', () => {
  it('tem exatamente quatro botões com callbacks estáveis e únicos', () => {
    assert.equal(MENU_BUTTONS.length, 4);
    const callbacks = MENU_BUTTONS.map((button) => button.callback);
    assert.deepEqual(callbacks, [
      'menu_profile',
      'menu_settings',
      'menu_whatsapp',
      'menu_about',
    ]);
    assert.equal(new Set(callbacks).size, 4);
  });

  it('organiza os botões em duas colunas na ordem exigida', () => {
    const keyboard = buildMainMenuKeyboard();
    assert.equal(keyboard.inline_keyboard.length, 2);
    assert.equal(keyboard.inline_keyboard[0]?.length, 2);
    assert.equal(keyboard.inline_keyboard[1]?.length, 2);

    const row1 = keyboard.inline_keyboard[0]!.map((button) => button.callback_data);
    const row2 = keyboard.inline_keyboard[1]!.map((button) => button.callback_data);
    assert.deepEqual(row1, [MENU_CALLBACKS.PROFILE, MENU_CALLBACKS.SETTINGS]);
    assert.deepEqual(row2, [MENU_CALLBACKS.WHATSAPP, MENU_CALLBACKS.ABOUT]);

    const labels = keyboard.inline_keyboard
      .flat()
      .map((button) => button.text);
    assert.deepEqual(labels, ['👤 Perfil', '⚙️ Configurações', '📱 WhatsApp', 'ℹ️ Sobre a Lizzy']);
  });

  it('gera a saudação com username preservando a identidade visual', () => {
    const caption = buildStartCaption('@lizzy_user');
    assert.match(caption, /✦ 𝐎𝐢𝐢, @lizzy_user! 𖤐/);
    assert.match(caption, /♛ 𝐒𝐢𝐬𝐭𝐞𝐦𝐚 𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲 𝐚𝐭𝐢𝐯𝐨\./);
    assert.match(
      caption,
      /𝐒𝐞𝐥𝐞𝐜𝐢𝐨𝐧𝐞 𝐮𝐦𝐚 𝐨𝐩çã𝐨 𝐚𝐛𝐚𝐢𝐱𝐨 𝐩𝐚𝐫𝐚 𝐚𝐜𝐞𝐬𝐬𝐚𝐫 𝐨 𝐬𝐢𝐬𝐭𝐞𝐦𝐚\. ♛/,
    );
  });

  it('nunca imprime o texto literal "@usuario"', () => {
    const caption = buildStartCaption('Maria');
    assert.equal(caption.includes('@usuario'), false);
  });

  it('escapa HTML para que dados do usuário não virem marcação', () => {
    assert.equal(escapeHtml('<b>x</b> & y'), '&lt;b&gt;x&lt;/b&gt; &amp; y');
    const caption = buildStartCaption('<b>hack</b>');
    assert.equal(caption.includes('<b>hack</b>'), false);
    assert.match(caption, /&lt;b&gt;hack&lt;\/b&gt;/);
  });

  it('devolve a resposta correta para cada callback válido', () => {
    assert.match(getMenuResponse(MENU_CALLBACKS.PROFILE) ?? '', /perfil/i);
    assert.match(getMenuResponse(MENU_CALLBACKS.SETTINGS) ?? '', /configurações/i);
    assert.match(getMenuResponse(MENU_CALLBACKS.ABOUT) ?? '', /integração com WhatsApp planejada/);
  });

  it('não afirma que o WhatsApp está conectado', () => {
    const response = getMenuResponse(MENU_CALLBACKS.WHATSAPP) ?? '';
    assert.match(response, /em preparação/i);
    assert.match(response, /não foi implementada|nenhuma conexão real/i);
    assert.equal(/conectado/i.test(response), false);
  });

  it('devolve undefined para callbacks desconhecidos', () => {
    assert.equal(getMenuResponse('menu_inexistente'), undefined);
    assert.equal(getMenuResponse(''), undefined);
  });
});
