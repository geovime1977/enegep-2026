// Testes do motor: node financiamentos/teste.js
const assert = require('assert');
const M = require('./motor.js');
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// Price de referência: 100.000 a 1% a.m. em 12 meses => 8.884,88
let r = M.simular({ valorBem: 100000, entrada: 0, prazo: 12, taxaAm: 0.01, sistema: 'price' });
perto(r.parcelaInicial, 8884.88, 0.01, 'PMT Price');
perto(r.parcelaFinal, 8884.88, 0.01, 'PMT Price final');
perto(r.rows[11].saldoFinal, 0, 0.01, 'quitação');
perto(r.cetAm, 0.01, 1e-8, 'CET = taxa sem custos');
perto(r.totalPago, 8884.88 * 12, 0.2, 'total Price');

// SAC: primeira parcela = 100000/12 + 1000; juros totais = 1% * 100000 * (12+1)/2
r = M.simular({ valorBem: 100000, entrada: 0, prazo: 12, taxaAm: 0.01, sistema: 'sac' });
perto(r.parcelaInicial, 100000 / 12 + 1000, 0.01, 'SAC 1ª');
perto(r.totalJuros, 6500, 0.01, 'SAC juros');
assert.ok(r.parcelaFinal < r.parcelaInicial);

// Custos elevam o CET acima da taxa nominal
const c = M.simular({ valorBem: 100000, entrada: 20000, prazo: 48, taxaAm: 0.015, sistema: 'price', tarifaInicial: 1000, seguroPct: 0.0003, iof: true, financiarCustos: false });
assert.ok(c.cetAm > 0.015, 'CET > taxa');
assert.ok(c.iof > 0 && c.iof < 80000 * 0.04, 'IOF plausível');
perto(c.rows[c.rows.length - 1].saldoFinal, 0, 0.01, 'quitação com custos');

// Financiar custos deixa o principal maior
const f = M.simular({ valorBem: 100000, entrada: 20000, prazo: 48, taxaAm: 0.015, sistema: 'price', tarifaInicial: 1000, iof: true, financiarCustos: true });
perto(f.principal, 80000 + f.iof + 1000, 0.01, 'principal com custos');

// Amortização extra reduz prazo e custo e quita tudo
const base = { valorBem: 300000, entrada: 60000, prazo: 360, taxaAm: M.aaParaAm(0.105), sistema: 'price' };
const ex = M.cenariosExtra(base, [0, 500, 1000]);
assert.ok(ex[1].mesesPoupados > 0 && ex[2].mesesPoupados > ex[1].mesesPoupados);
assert.ok(ex[1].economia > 0 && ex[2].economia > ex[1].economia);
ex.forEach((e) => perto(e.res.rows[e.res.rows.length - 1].saldoFinal, 0, 0.01, 'quitação extra'));

// Correção monetária aumenta o custo
const semC = M.simular({ ...base, correcaoAm: 0 }), comC = M.simular({ ...base, correcaoAm: 0.003 });
assert.ok(comC.totalPago > semC.totalPago);

// Taxa zero
r = M.simular({ valorBem: 12000, entrada: 0, prazo: 12, taxaAm: 0, sistema: 'price' });
perto(r.parcelaInicial, 1000, 1e-9, 'taxa zero');

// Otimizador: com taxa de oportunidade baixa, mais entrada tende a vencer; com alta, menos entrada
const oferta = { taxaAm: 0.015, sistema: 'price' };
const cfg = { valorBem: 80000, caixa: 80000, renda: 15000, comprometimento: 0.3, descontoAvista: 0, minEntradaPct: 20, prazos: [12, 24, 36, 48, 60], oferta };
const baixa = M.otimizar({ ...cfg, taxaOport: 0.005 }).viaveis[0];
const alta = M.otimizar({ ...cfg, taxaOport: 0.03 }).viaveis[0];
assert.ok(baixa.entrada >= alta.entrada, 'entrada ótima cai quando o dinheiro rende mais que a dívida custa');
assert.ok(baixa.res.parcelaInicial <= 4500.01);

// Ordenação
const lista = [{ res: { cetAm: 0.02 } }, { res: { cetAm: 0.01 } }];
assert.strictEqual(M.ordenar(lista, 'cet')[0].res.cetAm, 0.01);
console.log('OK: todos os testes passaram');
