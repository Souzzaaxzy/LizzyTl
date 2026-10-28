import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { UserRecord } from '../src/data/user-store';
import {
  BACK_BUTTON_LABEL,
  CALLBACKS,
  SCREENS,
  buildMenuCaption,
  buildMenuKeyboard,
  buildProfileCaption,
  escapeHtml,
  formatDate,
  screenForCallback,
} from '../src/telegram/screens/screens';

/** Extrai o callback_data de um botão, ignorando variantes que não o possuem. */
function callbackOf(button: { callback_data?: string } | unknown): string | undefined {
  if (typeof button === 'object' && button !== null && 'callback_data' in button) {
    const value = (button as { callback_data?: unknown }).callback_data;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

const sampleUser: UserRecord = {
  id: 12345,
  username: 'souzza',
  firstName: 'Souzza',
  plan: 'padrao',
  firstSeenAt: '2026-01-15T10:00:00.000Z',
  lastSeenAt: '2026-02-01T10:00:00.000Z',
  accessCount: 7,
};

describe('menu principal', () => {
  it('organiza os quatro botões em duas colunas na ordem exigida', () => {
    const keyboard = buildMenuKeyboard();
    assert.equal(keyboard.inline_keyboard.length, 2);
    assert.equal(keyboard.inline_keyboard[0]?.length, 2);
    assert.equal(keyboard.inline_keyboard[1]?.length, 2);

    const row1 = keyboard.inline_keyboard[0]!.map((b) => callbackOf(b));
    const row2 = keyboard.inline_keyboard[1]!.map((b) => callbackOf(b));
    assert.deepEqual(row1, [CALLBACKS.MENU_PROFILE, CALLBACKS.MENU_SETTINGS]);
    assert.deepEqual(row2, [CALLBACKS.MENU_WHATSAPP, CALLBACKS.MENU_ABOUT]);

    const labels = keyboard.inline_keyboard.flat().map((b) => b.text);
    assert.deepEqual(labels, ['👤 Perfil', '⚙️ Configurações', '📱 WhatsApp', 'ℹ️ Sobre a Lizzy']);
  });

  it('gera a saudação preservando a identidade visual', () => {
    const caption = buildMenuCaption('@lizzy_user');
    assert.match(caption, /✦ 𝐎𝐢𝐢, @lizzy_user! 𖤐/);
    assert.match(caption, /♛ 𝐒𝐢𝐬𝐭𝐞𝐦𝐚 𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲 𝐚𝐭𝐢𝐯𝐨\./);
    assert.equal(caption.includes('@usuario'), false);
  });

  it('escapa HTML para que dados do usuário não virem marcação', () => {
    assert.equal(escapeHtml('<b>x</b> & y'), '&lt;b&gt;x&lt;/b&gt; &amp; y');
    const caption = buildMenuCaption('<b>hack</b>');
    assert.equal(caption.includes('<b>hack</b>'), false);
  });
});

describe('tela de perfil', () => {
  it('mostra todos os campos do usuário', () => {
    const caption = buildProfileCaption(sampleUser);
    assert.match(caption, /👤 𝐏𝐞𝐫𝐟𝐢𝐥/);
    assert.match(caption, /𝐍𝐨𝐦𝐞: Souzza/);
    assert.match(caption, /𝐔𝐬𝐮𝐚́𝐫𝐢𝐨: @souzza/);
    assert.match(caption, /𝐈𝐃: 12345/);
    assert.match(caption, /𝐏𝐥𝐚𝐧𝐨: 𝐏𝐚𝐝𝐫𝐚̃𝐨/);
    assert.match(caption, /𝐄𝐧𝐭𝐫𝐨𝐮 𝐞𝐦: 15\/01\/2026/);
    assert.match(caption, /𝐀𝐜𝐞𝐬𝐬𝐨𝐬: 7/);
  });

  it('mostra o plano Dono quando o plano é dono', () => {
    const caption = buildProfileCaption({ ...sampleUser, plan: 'dono' });
    assert.match(caption, /𝐏𝐥𝐚𝐧𝐨: 𝐃𝐨𝐧𝐨/);
  });

  it('indica username não definido em vez de mostrar vazio', () => {
    const caption = buildProfileCaption({ ...sampleUser, username: undefined });
    assert.match(caption, /𝐔𝐬𝐮𝐚́𝐫𝐢𝐨: 𝑛𝑎̃𝑜 𝑑𝑒𝑓𝑖𝑛𝑖𝑑𝑜/);
    assert.equal(caption.includes('@undefined'), false);
  });

  it('não quebra quando não há registro do usuário', () => {
    const caption = buildProfileCaption(null);
    assert.match(caption, /👤 𝐏𝐞𝐫𝐟𝐢𝐥/);
    assert.match(caption, /Não foi possível carregar seus dados/);
  });

  it('escapa o nome para impedir injeção de HTML', () => {
    const caption = buildProfileCaption({ ...sampleUser, firstName: '<script>x</script>' });
    assert.equal(caption.includes('<script>'), false);
    assert.match(caption, /&lt;script&gt;/);
  });

  it('formata data inválida sem quebrar', () => {
    assert.equal(formatDate('nao-e-data'), 'desconhecida');
  });
});

describe('navegação entre telas', () => {
  it('toda tela interna tem apenas o botão de voltar', () => {
    for (const id of ['profile', 'settings', 'whatsapp', 'about'] as const) {
      const keyboard = SCREENS[id].buildKeyboard();
      assert.equal(keyboard.inline_keyboard.length, 1, `${id} deve ter uma linha`);
      assert.equal(keyboard.inline_keyboard[0]?.length, 1, `${id} deve ter um botão`);
      assert.equal(keyboard.inline_keyboard[0]![0]!.text, BACK_BUTTON_LABEL);
      assert.equal(callbackOf(keyboard.inline_keyboard[0]![0]!), CALLBACKS.NAV_BACK);
    }
  });

  it('cada callback de menu abre a tela correspondente', () => {
    assert.equal(screenForCallback(CALLBACKS.MENU_PROFILE)?.id, 'profile');
    assert.equal(screenForCallback(CALLBACKS.MENU_SETTINGS)?.id, 'settings');
    assert.equal(screenForCallback(CALLBACKS.MENU_WHATSAPP)?.id, 'whatsapp');
    assert.equal(screenForCallback(CALLBACKS.MENU_ABOUT)?.id, 'about');
  });

  it('o botão voltar leva ao menu principal', () => {
    assert.equal(screenForCallback(CALLBACKS.NAV_BACK)?.id, 'menu');
  });

  it('devolve undefined para callbacks desconhecidos', () => {
    assert.equal(screenForCallback('menu_inexistente'), undefined);
    assert.equal(screenForCallback(''), undefined);
  });

  it('o menu tem os quatro botões e o de voltar não aparece nele', () => {
    const keyboard = SCREENS.menu.buildKeyboard();
    const callbacks = keyboard.inline_keyboard.flat().map((b) => callbackOf(b));
    assert.equal(callbacks.includes(CALLBACKS.NAV_BACK), false);
    assert.equal(callbacks.length, 4);
  });
});
