// Motor de cálculo do simulador de financiamentos (sem dependências).
// Funciona no navegador (window.Motor) e no Node (require).
(function (root, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else root.Motor = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  const EPS = 0.005;

  const aaParaAm = (aa) => Math.pow(1 + aa, 1 / 12) - 1;
  const amParaAa = (am) => Math.pow(1 + am, 12) - 1;

  function pmt(saldo, i, n) {
    if (n <= 0) return saldo;
    if (i === 0) return saldo / n;
    return (saldo * i) / (1 - Math.pow(1 + i, -n));
  }

  // Taxa interna de retorno mensal por bisseção. fluxo[0] é o recebido; os demais, negativos.
  function tir(fluxo) {
    const vp = (r) => fluxo.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0);
    if (vp(0) >= 0) return 0;
    let lo = 0, hi = 1;
    for (let k = 0; k < 200; k++) {
      const mid = (lo + hi) / 2;
      if (vp(mid) < 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /**
   * Simula um financiamento mês a mês.
   * o: { valorBem, entrada, prazo, taxaAm, sistema:'price'|'sac', correcaoAm,
   *      seguroPct (a.m. sobre o saldo), seguroFixo, tarifaMensal, tarifaInicial,
   *      iof:boolean, iofFixo, iofDia, financiarCustos:boolean,
   *      extraMensal, extraAnual, taxaOport (a.m., para valor presente) }
   */
  function simular(o) {
    const i = o.taxaAm || 0;
    const corr = o.correcaoAm || 0;
    const sistema = o.sistema === 'sac' ? 'sac' : 'price';
    const n = Math.max(1, Math.round(o.prazo));
    const base = Math.max(0, o.valorBem - o.entrada);
    const tarifaInicial = o.tarifaInicial || 0;

    // IOF: alíquota fixa sobre o principal + diária (teto de 365 dias) sobre cada amortização.
    let iof = 0;
    if (o.iof && base > 0) {
      const ref = roda({ ...o, principal: base, i, corr: 0, sistema, n, extraMensal: 0, extraAnual: 0, seguroPct: 0, seguroFixo: 0, tarifaMensal: 0 });
      const fixo = o.iofFixo != null ? o.iofFixo : 0.0038;
      const dia = o.iofDia != null ? o.iofDia : 0.000082;
      iof = base * fixo + ref.rows.reduce((s, r) => s + r.amort * dia * Math.min(30 * r.mes, 365), 0);
    }
    const custosIniciais = iof + tarifaInicial;
    const principal = base + (o.financiarCustos ? custosIniciais : 0);

    const { rows } = roda({ ...o, principal, i, corr, sistema, n });

    const recebido = base - (o.financiarCustos ? 0 : custosIniciais);
    const fluxo = [recebido];
    rows.forEach((r) => fluxo.push(-(r.parcela + r.extra)));
    const cetAm = base > 0 ? tir(fluxo) : 0;

    const d = o.taxaOport != null ? o.taxaOport : 0;
    const vpParcelas = rows.reduce((s, r) => s + (r.parcela + r.extra) / Math.pow(1 + d, r.mes), 0);
    const naoFinanciado = o.financiarCustos ? 0 : custosIniciais;

    const soma = (campo) => rows.reduce((s, r) => s + r[campo], 0);
    const totalParcelas = soma('parcela') + soma('extra');
    const totalFinanciamento = totalParcelas + naoFinanciado;
    return {
      rows, principal, iof, tarifaInicial, custosIniciais,
      parcelaInicial: rows.length ? rows[0].parcela : 0,
      parcelaFinal: rows.length ? rows[rows.length - 1].parcela : 0,
      prazoReal: rows.length,
      totalJuros: soma('juros'),
      totalSeguros: soma('seguro'),
      totalTarifas: soma('tarifa') + tarifaInicial,
      totalFinanciamento,
      totalPago: totalFinanciamento + o.entrada,
      custoCredito: totalFinanciamento - base,
      cetAm, cetAa: amParaAa(cetAm),
      vp: vpParcelas + naoFinanciado + o.entrada,
    };
  }

  function roda(p) {
    let saldo = p.principal, restante = p.n, mes = 0;
    const i = p.i, rows = [];
    const extraMensal = p.extraMensal || 0, extraAnual = p.extraAnual || 0;
    while (saldo > EPS && mes < p.n * 2) {
      mes++;
      saldo *= 1 + p.corr;
      const juros = saldo * i;
      const seguro = saldo * (p.seguroPct || 0) + (p.seguroFixo || 0);
      const tarifa = p.tarifaMensal || 0;
      let parcelaBase;
      if (restante <= 1) parcelaBase = saldo + juros;
      else if (p.sistema === 'price') parcelaBase = pmt(saldo, i, restante);
      else parcelaBase = saldo / restante + juros;
      const amort = Math.min(saldo, parcelaBase - juros);
      let apos = saldo - amort;
      let extra = extraMensal + (extraAnual && mes % 12 === 0 ? extraAnual : 0);
      extra = Math.max(0, Math.min(extra, apos));
      rows.push({ mes, saldoInicial: saldo, juros, amort, seguro, tarifa, extra, parcela: amort + juros + seguro + tarifa, saldoFinal: apos - extra });
      apos -= extra;
      if (extra > 0 && apos > EPS) {
        // a amortização extra encurta o prazo, mantendo a prestação (Price) ou a amortização (SAC)
        if (p.sistema === 'price') {
          const juroProx = apos * i;
          const n2 = parcelaBase > juroProx && i > 0 ? Math.ceil(-Math.log(1 - juroProx / parcelaBase) / Math.log(1 + i)) : Math.ceil(apos / parcelaBase);
          restante = Math.max(1, Math.min(restante - 1, n2));
        } else {
          restante = Math.max(1, Math.min(restante - 1, Math.ceil(apos / amort)));
        }
      } else restante--;
      saldo = apos;
    }
    return { rows };
  }

  /** Ordena ofertas já simuladas pelo critério escolhido. */
  function ordenar(lista, criterio) {
    const chave = { cet: 'cetAm', total: 'totalPago', vp: 'vp', parcela: 'parcelaInicial' }[criterio] || 'cetAm';
    return lista.slice().sort((a, b) => a.res[chave] - b.res[chave]);
  }

  /**
   * Procura a melhor combinação entrada × prazo para uma oferta.
   * c: { valorBem, caixa, renda, comprometimento, taxaOport, descontoAvista, minEntradaPct, prazos[], oferta }
   * O objetivo é o menor valor presente de tudo que sai do bolso (entrada + parcelas),
   * descontado à taxa de oportunidade; o caixa que sobra continua rendendo.
   */
  function otimizar(c) {
    const teto = c.renda * c.comprometimento;
    const maxEntrada = Math.min(c.caixa, c.valorBem);
    const entradas = new Set();
    for (let p = c.minEntradaPct; p <= 90; p += 5) {
      const e = Math.round(c.valorBem * p) / 100;
      if (e <= maxEntrada) entradas.add(e);
    }
    if (maxEntrada >= c.valorBem * c.minEntradaPct / 100 && maxEntrada < c.valorBem) entradas.add(Math.round(maxEntrada * 100) / 100);
    const todas = [];
    for (const entrada of [...entradas].sort((a, b) => a - b)) {
      for (const prazo of c.prazos) {
        const res = simular({ ...c.oferta, valorBem: c.valorBem, entrada, prazo, taxaOport: c.taxaOport });
        todas.push({ entrada, prazo, res, cabe: res.parcelaInicial <= teto + 0.005 });
      }
    }
    const viaveis = todas.filter((x) => x.cabe).sort((a, b) => a.res.vp - b.res.vp);
    const aVista = c.caixa >= c.valorBem * (1 - c.descontoAvista) ? c.valorBem * (1 - c.descontoAvista) : null;
    return { todas, viaveis, aVista, teto };
  }

  /** Efeito de amortizações extras mensais sobre a mesma oferta. */
  function cenariosExtra(base, valores) {
    const zero = simular({ ...base, extraMensal: 0, extraAnual: 0 });
    return valores.map((v) => {
      const r = v === 0 ? zero : simular({ ...base, extraMensal: v });
      return { extra: v, res: r, economia: zero.totalPago - r.totalPago, mesesPoupados: zero.prazoReal - r.prazoReal };
    });
  }

  return { aaParaAm, amParaAa, pmt, tir, simular, ordenar, otimizar, cenariosExtra };
});
