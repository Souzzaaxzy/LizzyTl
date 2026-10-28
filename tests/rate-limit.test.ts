import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RateLimiter } from '../src/core/rate-limiter';
import { parsePositiveInt } from '../src/config/config';

/** Relógio falso, para testar a janela sem esperar tempo real. */
function fakeClock(start = 1_000_000) {
  let agora = start;
  return {
    now: () => agora,
    avanca: (ms: number) => {
      agora += ms;
    },
  };
}

describe('RateLimiter', () => {
  it('permite até o limite e bloqueia o excedente', () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ limit: 3, windowMs: 1000, now: clock.now });

    assert.equal(limiter.check(1).allowed, true);
    assert.equal(limiter.check(1).allowed, true);
    assert.equal(limiter.check(1).allowed, true);
    assert.equal(limiter.check(1).allowed, false, 'a quarta deve ser bloqueada');
  });

  it('libera de novo depois que a janela passa', () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ limit: 2, windowMs: 1000, now: clock.now });

    limiter.check(1);
    limiter.check(1);
    assert.equal(limiter.check(1).allowed, false);

    clock.avanca(1001);
    assert.equal(limiter.check(1).allowed, true, 'depois da janela, libera');
  });

  it('informa o tempo de espera em segundos', () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ limit: 1, windowMs: 5000, now: clock.now });

    limiter.check(1);
    const bloqueio = limiter.check(1);
    assert.equal(bloqueio.allowed, false);
    assert.ok(bloqueio.retryAfterSeconds >= 1 && bloqueio.retryAfterSeconds <= 5);
  });

  it('não estende o castigo quando o usuário insiste', () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000, now: clock.now });

    limiter.check(1);
    limiter.check(1); // negada
    clock.avanca(900);
    limiter.check(1); // negada
    clock.avanca(200); // passou 1100ms desde a unica permitida
    assert.equal(limiter.check(1).allowed, true, 'insistir não pode adiar a liberação');
  });

  it('conta o limite por usuário, não globalmente', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000, now: fakeClock().now });

    assert.equal(limiter.check(1).allowed, true);
    assert.equal(limiter.check(2).allowed, true, 'outro usuário tem a própria cota');
    assert.equal(limiter.check(1).allowed, false);
  });

  it('prune remove usuários sem atividade recente', () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ limit: 5, windowMs: 1000, now: clock.now });

    limiter.check(1);
    limiter.check(2);
    assert.equal(limiter.size(), 2);

    clock.avanca(2000);
    limiter.prune();
    assert.equal(limiter.size(), 0, 'mapa não pode crescer sem limite');
  });

  it('prune mantém quem ainda está na janela', () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ limit: 5, windowMs: 5000, now: clock.now });

    limiter.check(1);
    clock.avanca(1000);
    limiter.check(2);
    limiter.prune();
    assert.equal(limiter.size(), 2);
  });
});

describe('parsePositiveInt', () => {
  it('usa o valor válido', () => {
    assert.equal(parsePositiveInt('30', 20), 30);
  });

  it('cai no padrão quando ausente ou vazio', () => {
    assert.equal(parsePositiveInt(undefined, 20), 20);
    assert.equal(parsePositiveInt('', 20), 20);
    assert.equal(parsePositiveInt('   ', 20), 20);
  });

  it('cai no padrão quando inválido ou não positivo', () => {
    // Uma variável mal preenchida não pode desligar a proteção.
    assert.equal(parsePositiveInt('abc', 20), 20);
    assert.equal(parsePositiveInt('0', 20), 20);
    assert.equal(parsePositiveInt('-5', 20), 20);
    assert.equal(parsePositiveInt('1.5', 20), 20);
  });
});
