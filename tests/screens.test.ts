import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { UserRecord } from '../src/data/user-store.js';
import {
  BACK_BUTTON_LABEL,
  BOT_COMMANDS,
  CALLBACKS,
  SCREENS,
  buildAdminStatsCaption,
  buildAdminUsersCaption,
  buildHelpCaption,
  buildMenuCaption,
  buildMenuKeyboard,
  buildProfileCaption,
  displayNameFor,
  resolveDisplayName,
  menuKeyboardFor,
  screenContext,
  escapeHtml,
  formatDate,
  screenForCallback,
} from '../src/telegram/screens/screens.js';

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
    const caption = buildProfileCaption(screenContext(sampleUser));
    assert.match(caption, /👤 𝐏𝐞𝐫𝐟𝐢𝐥/);
    assert.match(caption, /𝐍𝐨𝐦𝐞: Souzza/);
    assert.match(caption, /𝐔𝐬𝐮𝐚́𝐫𝐢𝐨: @souzza/);
    assert.match(caption, /𝐈𝐃: 12345/);
    assert.match(caption, /𝐏𝐥𝐚𝐧𝐨: 𝐏𝐚𝐝𝐫𝐚̃𝐨/);
    assert.match(caption, /𝐄𝐧𝐭𝐫𝐨𝐮 𝐞𝐦: 15\/01\/2026/);
    assert.match(caption, /𝐀𝐜𝐞𝐬𝐬𝐨𝐬: 7/);
  });

  it('mostra o plano Dono quando o plano é dono', () => {
    const caption = buildProfileCaption(screenContext({ ...sampleUser, plan: 'dono' }));
    assert.match(caption, /𝐏𝐥𝐚𝐧𝐨: 𝐃𝐨𝐧𝐨/);
  });

  it('indica username não definido em vez de mostrar vazio', () => {
    const caption = buildProfileCaption(screenContext({ ...sampleUser, username: undefined }));
    assert.match(caption, /𝐔𝐬𝐮𝐚́𝐫𝐢𝐨: 𝑛𝑎̃𝑜 𝑑𝑒𝑓𝑖𝑛𝑖𝑑𝑜/);
    assert.equal(caption.includes('@undefined'), false);
  });

  it('não quebra quando não há registro do usuário', () => {
    const caption = buildProfileCaption(screenContext(null));
    assert.match(caption, /👤 𝐏𝐞𝐫𝐟𝐢𝐥/);
    assert.match(caption, /Não foi possível carregar seus dados/);
  });

  it('escapa o nome para impedir injeção de HTML', () => {
    const caption = buildProfileCaption(screenContext({ ...sampleUser, firstName: '<script>x</script>' }));
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
      const keyboard = SCREENS[id].buildKeyboard(screenContext(sampleUser));
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
    const keyboard = SCREENS.menu.buildKeyboard(screenContext(sampleUser));
    const callbacks = keyboard.inline_keyboard.flat().map((b) => callbackOf(b));
    assert.equal(callbacks.includes(CALLBACKS.NAV_BACK), false);
    assert.equal(callbacks.length, 4);
  });
});


describe('resolveDisplayName', () => {
  it('prefere o registro persistido', () => {
    assert.equal(resolveDisplayName(sampleUser, { id: 1, username: 'outro' }), '@souzza');
  });

  it('usa o Telegram quando não há registro', () => {
    assert.equal(resolveDisplayName(null, { id: 1, username: 'lizzy' }), '@lizzy');
    assert.equal(resolveDisplayName(null, { id: 1, first_name: 'Ana' }), 'Ana');
  });

  it('nunca devolve "@usuario" nem string vazia', () => {
    assert.equal(resolveDisplayName(null), 'usuário');
    assert.equal(resolveDisplayName(null, {}), 'usuário');
    assert.equal(resolveDisplayName(null, { id: 1, username: '  ' }), 'usuário');
    assert.notEqual(resolveDisplayName(null), '@usuario');
  });
});

describe('ajuda e lista de comandos', () => {
  it('a lista de comandos tem start e help, sem duplicatas', () => {
    const names = BOT_COMMANDS.map((c) => c.command);
    assert.deepEqual(names, ['start', 'help']);
    assert.equal(new Set(names).size, names.length);
  });

  it('cada comando tem descrição não vazia', () => {
    for (const c of BOT_COMMANDS) {
      assert.ok(c.description.trim().length > 0, `${c.command} precisa de descrição`);
    }
  });

  it('a legenda de ajuda lista exatamente os comandos publicados', () => {
    const caption = buildHelpCaption();
    for (const c of BOT_COMMANDS) {
      assert.ok(caption.includes(c.command), `ajuda deve citar /${c.command}`);
      assert.ok(caption.includes(c.description), `ajuda deve descrever /${c.command}`);
    }
  });

  it('a legenda de ajuda aponta para o /start', () => {
    assert.match(buildHelpCaption(), /\/start/);
  });
});

describe('saudação ao voltar para o menu', () => {
  it('usa o @username do usuário registrado', () => {
    const caption = SCREENS.menu.buildCaption(screenContext(sampleUser));
    assert.match(caption, /@souzza/);
  });

  it('cai para o primeiro nome quando não há username', () => {
    const caption = SCREENS.menu.buildCaption(screenContext({ ...sampleUser, username: undefined }));
    assert.match(caption, /Souzza/);
  });

  it('usa rótulo neutro quando não há registro nem dados do Telegram', () => {
    const caption = SCREENS.menu.buildCaption(screenContext(null));
    assert.match(caption, /usuário/);
  });

  it('recupera o nome do Telegram quando o registro falta', () => {
    // Caso do bug relatado: registro ausente nao pode virar placeholder
    // se o proprio update trouxe o username.
    const caption = SCREENS.menu.buildCaption(
      screenContext(null, { id: 99, username: 'souzza', first_name: 'Souzza' }),
    );
    assert.match(caption, /@souzza/);
    assert.equal(caption.includes('usuário'), false);
  });

  it('recupera o primeiro nome do Telegram quando não há username', () => {
    const caption = SCREENS.menu.buildCaption(
      screenContext(null, { id: 99, first_name: 'Souzza' }),
    );
    assert.match(caption, /Souzza/);
  });

  it('displayNameFor prefere username e cai para o nome', () => {
    assert.equal(displayNameFor(sampleUser), '@souzza');
    assert.equal(displayNameFor({ ...sampleUser, username: undefined }), 'Souzza');
  });
});


describe('painel do dono', () => {
  const dono = { ...sampleUser, id: 8072791511, plan: 'dono' as const };
  const adminCtx = (u: UserRecord | null) => ({
    ...screenContext(u),
    admin: {
      stats: {
        totalUsers: 3,
        totalAccesses: 12,
        newToday: 2,
        activeToday: 1,
      },
      recentUsers: [
        { ...sampleUser, id: 111, username: 'ana', firstName: 'Ana' },
        { ...sampleUser, id: 8072791511, username: 'souzza', firstName: 'Souzza', plan: 'dono' as const },
      ],
      totalUsers: 3,
    },
  });

  it('o menu do dono tem a linha do painel além dos quatro botões', () => {
    const keyboard = menuKeyboardFor(adminCtx(dono));
    const rows = keyboard.inline_keyboard;
    assert.equal(rows.length, 3, 'três linhas: dois pares e o painel');
    const callbacks = rows.flat().map((b) => callbackOf(b));
    assert.equal(callbacks.length, 5);
    assert.ok(callbacks.includes(CALLBACKS.ADMIN_HOME), 'o menu leva ao hub do painel');
  });

  it('o menu de quem não é dono NÃO mostra o painel', () => {
    const keyboard = menuKeyboardFor(screenContext(sampleUser));
    const callbacks = keyboard.inline_keyboard.flat().map((b) => callbackOf(b));
    assert.equal(callbacks.length, 4);
    assert.equal(callbacks.includes(CALLBACKS.ADMIN_HOME), false);
    assert.equal(callbacks.includes(CALLBACKS.ADMIN_STATS), false);
  });

  it('sem contexto, cai no menu padrão em vez de quebrar', () => {
    const keyboard = menuKeyboardFor();
    assert.equal(keyboard.inline_keyboard.flat().length, 4);
  });

  it('a legenda de estatísticas mostra os números', () => {
    const caption = buildAdminStatsCaption(adminCtx(dono));
    assert.match(caption, /𝐔𝐬𝐮𝐚́𝐫𝐢𝐨𝐬 𝐭𝐨𝐭𝐚𝐢𝐬: 3/);
    assert.match(caption, /𝐀𝐜𝐞𝐬𝐬𝐨𝐬 𝐭𝐨𝐭𝐚𝐢𝐬: 12/);
    assert.match(caption, /𝐍𝐨𝐯𝐨𝐬 𝐡𝐨𝐣𝐞: 2/);
    assert.match(caption, /𝐀𝐭𝐢𝐯𝐨𝐬 𝐡𝐨𝐣𝐞: 1/);
  });

  it('a lista de usuários marca o dono e mostra o ID', () => {
    const caption = buildAdminUsersCaption(adminCtx(dono));
    assert.match(caption, /@souzza — 8072791511/);
    assert.match(caption, /♛/, 'o dono leva a marca');
    assert.match(caption, /3 𝐧𝐨 𝐭𝐨𝐭𝐚𝐥/);
  });

  it('a lista lida com base vazia sem quebrar', () => {
    const ctx = { ...screenContext(dono), admin: { stats: { totalUsers: 0, totalAccesses: 0, newToday: 0, activeToday: 0 }, recentUsers: [], totalUsers: 0 } };
    assert.match(buildAdminUsersCaption(ctx), /Nenhum usuário registrado/);
  });

  it('sem dados de admin, as legendas não quebram', () => {
    assert.match(buildAdminStatsCaption(screenContext(dono)), /indisponíveis/);
    assert.match(buildAdminUsersCaption(screenContext(dono)), /indisponíveis/);
  });

  it('as telas de admin são marcadas como restritas ao dono', () => {
    assert.equal(SCREENS.admin.ownerOnly, true, 'o hub também precisa ser restrito');
    assert.equal(SCREENS.adminStats.ownerOnly, true);
    assert.equal(SCREENS.adminUsers.ownerOnly, true);
  });

  it('o hub do painel é alcançável e leva às duas telas internas', () => {
    assert.equal(screenForCallback(CALLBACKS.ADMIN_HOME)?.id, 'admin');
    const keyboard = SCREENS.admin.buildKeyboard(screenContext(dono));
    const callbacks = keyboard.inline_keyboard.flat().map((b) => callbackOf(b));
    assert.ok(callbacks.includes(CALLBACKS.ADMIN_STATS));
    assert.ok(callbacks.includes(CALLBACKS.ADMIN_USERS));
  });

  it('o Voltar das telas internas volta ao hub, não ao menu', () => {
    for (const id of ['adminStats', 'adminUsers'] as const) {
      const callbacks = SCREENS[id]
        .buildKeyboard(screenContext(dono))
        .inline_keyboard.flat()
        .map((b) => callbackOf(b));
      assert.ok(callbacks.includes(CALLBACKS.ADMIN_HOME), `${id} deve voltar ao hub`);
    }
  });

  it('o Voltar do hub leva ao menu principal', () => {
    const callbacks = SCREENS.admin
      .buildKeyboard(screenContext(dono))
      .inline_keyboard.flat()
      .map((b) => callbackOf(b));
    assert.ok(callbacks.includes(CALLBACKS.NAV_BACK));
  });

  it('telas comuns NÃO são restritas', () => {
    assert.equal(SCREENS.profile.ownerOnly, undefined);
    assert.equal(SCREENS.menu.ownerOnly, undefined);
  });

  it('os callbacks de admin levam às telas de admin', () => {
    assert.equal(screenForCallback(CALLBACKS.ADMIN_STATS)?.id, 'adminStats');
    assert.equal(screenForCallback(CALLBACKS.ADMIN_USERS)?.id, 'adminUsers');
  });
});
