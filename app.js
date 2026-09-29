/* Drink League 2026 — lee Sleeper en vivo y cruza con datos.js */
(() => {
  "use strict";

  // ---------- Reglas del One Pager 2026 ----------
  const REGLAS = {
    managers: 12,
    inscripcion: { ronda1: 2000, ronda2: 1500 },
    semanal: 1000,
    badBeat: { ganador: 800, segundo: 200 },
    ultimaSemanaSemanal: 14,
    record: 2000,
    puntos: 2000,
    baba: 1000,
    playoffs: { 1: 10000, 2: 5000, 3: 3500, 4: 2000, 5: 1500, 6: 1000 },
    playoffTeams: 6,
  };
  const BOLSA = REGLAS.managers * (REGLAS.inscripcion.ronda1 + REGLAS.inscripcion.ronda2);
  const LUGAR = { 1: "1ro", 2: "2do", 3: "3ro", 4: "4to", 5: "5to", 6: "6to" };

  const CFG = window.DRINK_LEAGUE || {};
  const params = new URLSearchParams(location.search);
  const DEMO = params.has("demo");
  const LEAGUE_ID = params.get("liga") || CFG.leagueId;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const pts = (n) => (n ?? 0).toFixed(2);
  const fecha = (s) => {
    // Solo se muestra si es fecha AAAA-MM-DD; cualquier otro valor cuenta como "pagado" sin fecha
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return "";
    const d = new Date(s + "T12:00:00");
    return isNaN(d) ? "" : d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  };

  // ---------- API ----------
  async function api(path) {
    if (DEMO) return window.DEMO_API(path);
    const r = await fetch("https://api.sleeper.app/v1/" + path, { cache: "no-store" });
    if (!r.ok) throw new Error("Sleeper respondió " + r.status + " en /" + path);
    return r.json();
  }

  async function loadDemo() {
    if (window.DEMO_API) return;
    await new Promise((ok, bad) => {
      const s = document.createElement("script");
      s.src = "demo.js";
      s.onload = ok;
      s.onerror = () => bad(new Error("No se encontró demo.js"));
      document.head.appendChild(s);
    });
  }

  // ---------- Carga y cálculo ----------
  async function cargar() {
    if (DEMO) await loadDemo();
    if (!DEMO && (!LEAGUE_ID || !/^\d+$/.test(LEAGUE_ID))) {
      throw new Error('Falta el League ID. Abre <code>datos.js</code> y pega el número de tu liga en <code>leagueId</code> (o prueba <a href="?demo=1">el modo demo</a>).');
    }
    const lid = DEMO ? "demo" : LEAGUE_ID;
    const [state, league, users, rosters] = await Promise.all([
      api("state/nfl"),
      api("league/" + lid),
      api("league/" + lid + "/users"),
      api("league/" + lid + "/rosters"),
    ]);
    if (!league) throw new Error("Sleeper no encontró la liga " + esc(lid) + ". Revisa el League ID en datos.js.");

    const s = league.settings || {};
    const playoffStart = s.playoff_week_start || 15;
    const ultimaRegular = playoffStart - 1;
    const ultimaSemanal = Math.min(REGLAS.ultimaSemanaSemanal, ultimaRegular);
    const playoffTeams = s.playoff_teams || REGLAS.playoffTeams;

    // Semana que se está jugando y última semana que Sleeper ya cerró (récords actualizados)
    let semanaActual;
    const lSeason = Number(league.season), sSeason = Number(state.season);
    const terminada = league.status === "complete" || lSeason < sSeason;
    if (terminada) semanaActual = 99;
    else if (lSeason > sSeason || state.season_type === "pre" || league.status === "pre_draft" || league.status === "drafting") semanaActual = 0;
    else semanaActual = Number(state.display_week || state.leg || state.week) || 0;
    const ultimaCerrada = terminada ? 99 : Number(s.last_scored_leg) || Math.max(0, semanaActual - 1);
    const regularTerminada = ultimaCerrada >= ultimaRegular;

    const semanasConDatos = Math.min(Math.max(semanaActual, Number(state.leg) || 0, 0), 18);
    const weeks = await Promise.all(
      Array.from({ length: semanasConDatos }, (_, i) => api("league/" + lid + "/matchups/" + (i + 1)).catch(() => []))
    );

    let winners = [], losers = [];
    if (semanaActual >= playoffStart) {
      [winners, losers] = await Promise.all([
        api("league/" + lid + "/winners_bracket").catch(() => []),
        api("league/" + lid + "/losers_bracket").catch(() => []),
      ]);
    }

    // Equipos
    const userById = Object.fromEntries((users || []).map((u) => [u.user_id, u]));
    const teams = {};
    for (const r of rosters || []) {
      const u = userById[r.owner_id] || {};
      const md = u.metadata || {};
      const st = r.settings || {};
      teams[r.roster_id] = {
        rid: r.roster_id,
        userId: r.owner_id,
        handle: u.display_name || "Sin dueño",
        nombre: md.team_name || u.display_name || "Equipo " + r.roster_id,
        avatar: md.avatar || (u.avatar ? "https://sleepercdn.com/avatars/thumbs/" + u.avatar : ""),
        w: st.wins || 0, l: st.losses || 0, t: st.ties || 0,
        pf: (st.fpts || 0) + (st.fpts_decimal || 0) / 100,
        pa: (st.fpts_against || 0) + (st.fpts_against_decimal || 0) / 100,
        pfCalc: 0,
      };
    }

    // Resultados por semana
    const semanas = weeks.map((ms, i) => {
      const w = i + 1;
      const list = (ms || []).filter((m) => teams[m.roster_id]).map((m) => ({ rid: m.roster_id, mid: m.matchup_id, p: Number(m.points) || 0 }));
      const cerrada = w <= ultimaCerrada;
      const conPuntos = list.some((x) => x.p > 0);
      const orden = [...list].sort((a, b) => b.p - a.p);
      const primero = conPuntos ? orden[0] : null;
      const segundo = conPuntos ? orden[1] : null;
      // Empate exacto en el 1er lugar: el One Pager no lo cubre, se reparte en partes iguales
      const empate = !!(primero && segundo && primero.p === segundo.p);
      const badBeat = !empate && !!(primero && segundo && primero.mid != null && primero.mid === segundo.mid);
      // Enfrentamientos
      const byMid = {};
      for (const x of list) if (x.mid != null) (byMid[x.mid] ||= []).push(x);
      return { w, list, orden, primero, segundo, badBeat, empate, cerrada, conPuntos, enVivo: !cerrada && w >= semanaActual, porConfirmar: !cerrada && w < semanaActual, matchups: Object.values(byMid) };
    });

    // Puntos totales (temporada regular) calculados de los matchups: incluye la semana en vivo
    for (const sm of semanas) if (sm.w <= ultimaRegular) for (const x of sm.list) teams[x.rid].pfCalc += x.p;

    return { state, league, teams, semanas, semanaActual, ultimaCerrada, regularTerminada, playoffStart, ultimaRegular, ultimaSemanal, playoffTeams, winners, losers };
  }

  // ---------- Pagos (datos.js) ----------
  const pagoInscripcion = (t) => {
    const ins = CFG.inscripciones || {};
    const key = Object.keys(ins).find((k) => k.toLowerCase() === String(t.handle).toLowerCase() || k === t.userId);
    return key ? ins[key] || {} : {};
  };
  const pagoSemanal = (w) => {
    const v = (CFG.semanales || {})[w];
    if (v && typeof v === "object") return { ganador: v.ganador || null, segundo: v.segundo || null };
    return { ganador: v || null, segundo: null };
  };

  function estadoPago(ganado, fechaPago) {
    if (!ganado) return '<span class="badge muted">EN JUEGO</span>';
    if (fechaPago) return `<span class="badge ok">PAGADO${fecha(fechaPago) ? " · " + esc(fecha(fechaPago)) : ""}</span>`;
    return '<span class="badge wait">POR PAGAR</span>';
  }

  // ---------- Render helpers ----------
  const teamHtml = (t, sub) => {
    if (!t) return '<span class="muted">—</span>';
    const av = t.avatar ? `<img src="${esc(t.avatar)}" alt="" loading="lazy">` : '<span class="av"></span>';
    return `<div class="team">${av}<div class="tx"><span class="nm">${esc(t.nombre)}</span><span class="hd">${esc(sub ?? "@" + t.handle)}</span></div></div>`;
  };

  function ranking(d) {
    const list = Object.values(d.teams);
    list.sort((a, b) => {
      const pa = (a.w + a.t / 2) / Math.max(1, a.w + a.l + a.t), pb = (b.w + b.t / 2) / Math.max(1, b.w + b.l + b.t);
      if (a.w + a.l + a.t === 0 && b.w + b.l + b.t === 0) return b.pfCalc - a.pfCalc;
      return pb - pa || b.w - a.w || b.pf - a.pf || b.pfCalc - a.pfCalc;
    });
    return list;
  }

  // ---------- Secciones ----------
  function renderHeader(d) {
    const { semanaActual: sa, playoffStart, league } = d;
    let sub, pill = $("status-pill");
    pill.className = "pill";
    // Sleeper sigue reportando la semana anterior hasta que arranca la siguiente
    const entreSemanas = sa > 0 && sa < 99 && sa <= d.ultimaCerrada;
    if (sa === 99) { sub = "Temporada terminada"; pill.textContent = "FINAL"; pill.classList.add("done"); }
    else if (sa === 0) { sub = "La temporada aún no arranca"; pill.textContent = "PRETEMPORADA"; }
    else if (entreSemanas) {
      sub = `Semana ${sa} cerrada · Próxima: Semana ${sa + 1}`;
      pill.textContent = `SEMANA ${sa} FINAL`;
      pill.classList.add("done");
    }
    else if (sa >= playoffStart) { sub = `Playoffs · Semana ${sa}`; pill.textContent = "● PLAYOFFS EN VIVO"; pill.classList.add("live"); }
    else { sub = `Temporada regular · Semana ${sa}`; pill.textContent = `● SEMANA ${sa} EN VIVO`; pill.classList.add("live"); }
    $("subtitle").textContent = `${league.name || "Drink League"} · ${sub}${DEMO ? " · MODO DEMO" : ""}`;
  }

  function renderKpis(d, calc) {
    const r = ranking(d)[0];
    $("kpis").innerHTML = `
      <div class="kpi hot"><div class="lbl">Bolsa total</div><div class="val">${money(BOLSA)}</div><div class="sub">12 × $3,500</div></div>
      <div class="kpi"><div class="lbl">Recaudado</div><div class="val">${money(calc.recaudado)}</div><div class="sub">${calc.pagaronTodo}/${Object.keys(d.teams).length} completos</div></div>
      <div class="kpi"><div class="lbl">Premios pagados</div><div class="val">${money(calc.pagado)}</div><div class="sub">${money(calc.porPagar)} por pagar</div></div>
      <div class="kpi"><div class="lbl">Lider</div><div class="val" style="font-size:12px">${esc(r ? r.nombre : "—")}</div><div class="sub">${r ? `${r.w}-${r.l}${r.t ? "-" + r.t : ""} · ${pts(r.pf || r.pfCalc)} pts` : ""}</div></div>`;
  }

  function renderSemana(d) {
    const sm = d.semanas.find((x) => x.enVivo && x.conPuntos) || [...d.semanas].reverse().find((x) => x.conPuntos);
    if (!sm) {
      $("semana-title").textContent = "Semana actual";
      $("semana-body").innerHTML = '<p class="note">Todavía no hay puntos. Nos vemos en la Semana 1. 🏈</p>';
      return;
    }
    const T = d.teams;
    const esSemanal = sm.w <= d.ultimaSemanal;
    $("semana-title").textContent = `Semana ${sm.w}${sm.enVivo ? " · en vivo" : sm.porConfirmar ? " · por confirmar" : " · final"}`;
    let leader = "";
    if (sm.primero && esSemanal) {
      const bb = sm.badBeat
        ? `<div class="bb">⚡ BAD BEAT: ${esc(T[sm.segundo.rid].nombre)} (2do, ${pts(sm.segundo.p)}) juega contra el 1ro → ${money(REGLAS.badBeat.ganador)} / ${money(REGLAS.badBeat.segundo)}</div>`
        : sm.empate
        ? `<div class="bb">🤝 EMPATE en el 1er lugar con ${esc(T[sm.segundo.rid].nombre)} (${pts(sm.segundo.p)}) → ${money(REGLAS.semanal / 2)} c/u</div>`
        : "";
      leader = `<div class="leader-card"><div class="lbl">${sm.cerrada ? "GANADOR DE LA SEMANA" : "VA GANANDO EL PREMIO SEMANAL"}</div>
        <div class="who">${esc(T[sm.primero.rid].nombre)}</div><div class="pts">${pts(sm.primero.p)}</div>${bb}</div>`;
    }
    const top = sm.orden.slice(0, 6).map((x) => `<li>${teamHtml(T[x.rid])}<span class="p">${pts(x.p)}</span></li>`).join("");
    const mus = sm.matchups.map((pair) => {
      const [a, b] = pair;
      if (!b) return "";
      const wa = a.p > b.p, wb = b.p > a.p;
      return `<div class="mu">
        <div class="side">${teamHtml(T[a.rid], "")}</div><span class="sc ${wa ? "w" : "l"}">${pts(a.p)}</span>
        <div class="side">${teamHtml(T[b.rid], "")}</div><span class="sc ${wb ? "w" : "l"}">${pts(b.p)}</span></div>`;
    }).join("");
    $("semana-body").innerHTML = `<div class="week-grid">
      <div>${leader}<p class="sub-h">TOP PUNTAJES</p><ol class="rank-list">${top}</ol></div>
      <div><p class="sub-h">ENFRENTAMIENTOS</p><div class="matchups">${mus || '<p class="note">Sin enfrentamientos.</p>'}</div></div>
    </div>`;
  }

  function renderSemanales(d) {
    const T = d.teams;
    const rows = [];
    for (let w = 1; w <= d.ultimaSemanal; w++) {
      const sm = d.semanas[w - 1];
      const pago = pagoSemanal(w);
      if (!sm || !sm.conPuntos) {
        rows.push(`<tr class="dim"><td class="seed">${w}</td><td colspan="3" class="muted">${w <= d.ultimaCerrada ? "Sin datos" : "Por jugarse"}</td><td></td></tr>`);
        continue;
      }
      const g = T[sm.primero.rid];
      const premio = sm.badBeat
        ? `${money(REGLAS.badBeat.ganador)}<br><span class="muted">+${money(REGLAS.badBeat.segundo)} al 2do</span>`
        : sm.empate
        ? `${money(REGLAS.semanal / 2)} c/u<br><span class="muted">con ${esc(T[sm.segundo.rid].nombre)}</span>`
        : money(REGLAS.semanal);
      let estado;
      if (sm.enVivo) estado = '<span class="badge live">● EN VIVO</span>';
      else if (sm.porConfirmar) estado = '<span class="badge wait">POR CONFIRMAR</span>';
      else if (sm.badBeat || sm.empate) estado = `${estadoPago(true, pago.ganador)}<br>${estadoPago(true, pago.segundo)}`;
      else estado = estadoPago(sm.cerrada, pago.ganador);
      rows.push(`<tr class="${sm.enVivo ? "live" : ""}">
        <td class="seed">${w}</td>
        <td>${teamHtml(g)}${sm.badBeat ? ' <span class="badge bb">BAD BEAT</span>' : sm.empate ? ' <span class="badge bb">EMPATE</span>' : ""}</td>
        <td class="num">${pts(sm.primero.p)}</td>
        <td class="num">${premio}</td>
        <td>${estado}</td></tr>`);
    }
    // Conteo de premios por manager
    const wins = {};
    for (const sm of d.semanas) if (sm.w <= d.ultimaSemanal && sm.cerrada && sm.primero) wins[sm.primero.rid] = (wins[sm.primero.rid] || 0) + 1;
    const top = Object.entries(wins).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([rid, n]) => `${esc(T[rid].nombre)} ×${n}`).join(" · ");
    $("semanales-body").innerHTML = `<div class="tbl-wrap"><table>
      <thead><tr><th>SEM</th><th>GANADOR</th><th class="num">PTS</th><th class="num">PREMIO</th><th>PAGO</th></tr></thead>
      <tbody>${rows.join("")}</tbody></table></div>
      ${top ? `<p class="note" style="margin-top:12px">Más semanas ganadas: <b class="y">${top}</b></p>` : ""}`;
  }

  function renderPlayoffs(d) {
    const T = d.teams;
    const list = ranking(d);
    const jugados = (t) => t.w + t.l + t.t;
    const restantes = (t) => Math.max(0, d.ultimaRegular - jugados(t));
    const n = d.playoffTeams;
    const corte = list[n - 1];
    const regularTerminada = d.regularTerminada;

    const rows = list.map((t, i) => {
      const maxW = t.w + restantes(t);
      const rivalesQuePuedenAlcanzar = list.filter((o) => o !== t && o.w + restantes(o) >= t.w).length;
      let estado;
      if (regularTerminada) estado = i < n ? '<span class="badge in">CLASIFICADO</span>' : '<span class="badge out">ELIMINADO</span>';
      else if (rivalesQuePuedenAlcanzar < n) estado = '<span class="badge in">CLASIFICADO</span>';
      else if (corte && maxW < corte.w) estado = '<span class="badge out">ELIMINADO</span>';
      else if (i < n) estado = '<span class="badge ok">DENTRO</span>';
      else estado = '<span class="badge wait">AFUERA</span>';
      const gb = i >= n && corte ? ((corte.w - t.w) + (t.l - corte.l)) / 2 : null;
      return `<tr class="${i === n - 1 ? "cut" : ""} ${i >= n ? "dim" : ""}">
        <td class="seed">${i + 1}</td>
        <td>${teamHtml(t)}</td>
        <td class="num">${t.w}-${t.l}${t.t ? "-" + t.t : ""}</td>
        <td class="num">${pts(t.pf || t.pfCalc)}</td>
        <td class="num hide-sm">${pts(t.pa)}</td>
        <td class="num hide-sm">${gb != null && gb > 0 ? gb.toFixed(1) : "—"}</td>
        <td>${estado}</td></tr>`;
    }).join("");

    const lugares = lugaresFinales(d);
    const ladder = Object.entries(REGLAS.playoffs).map(([p, amt]) => {
      const t = lugares[p] ? T[lugares[p]] : null;
      const proy = !t && !regularTerminada && list[p - 1] ? `<small>Hoy seed ${p}</small>${esc(list[p - 1].nombre)}` : "";
      return `<div class="rung ${p === "1" ? "first" : ""}"><div class="pl">${p === "1" ? "CAMPEON" : LUGAR[p]}</div><div class="pz">${money(amt)}</div>
        <div class="wn">${t ? "🏆 " + esc(t.nombre) : proy || '<span class="muted">Por definir</span>'}</div></div>`;
    }).join("");

    $("playoffs-body").innerHTML = `<div class="tbl-wrap"><table>
      <thead><tr><th>#</th><th>EQUIPO</th><th class="num">W-L</th><th class="num">PF</th><th class="num hide-sm">PA</th><th class="num hide-sm">JD</th><th>ESTADO</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <p class="note" style="margin-top:8px">La línea amarilla marca el corte de Playoffs. JD = juegos detrás del 6to lugar.</p>
      <div class="ladder">${ladder}</div>`;
    renderBracket(d);
  }

  // Lugares 1–6 a partir del bracket de ganadores de Sleeper (juegos con "p")
  function lugaresFinales(d) {
    const out = {};
    for (const m of d.winners || []) {
      if (!m.p || !m.w) continue;
      out[m.p] = m.w;
      out[m.p + 1] = m.l;
    }
    return out;
  }
  const babaCampeon = (d) => {
    const m = (d.losers || []).find((x) => x.p === 1 && x.w);
    return m ? m.w : null;
  };

  function renderBracket(d) {
    if (!d.winners || !d.winners.length) { $("bracket-body").innerHTML = ""; return; }
    const T = d.teams;
    const pointsFor = (rid, round) => {
      const w = d.playoffStart + round - 1;
      const sm = d.semanas[w - 1];
      const x = sm && sm.list.find((y) => y.rid === rid);
      return x ? pts(x.p) : "";
    };
    const rounds = {};
    for (const m of d.winners) (rounds[m.r] ||= []).push(m);
    const nombreRonda = (r, total) => (r === total ? "FINALES" : r === total - 1 ? "SEMIFINALES" : "RONDA " + r);
    const total = Math.max(...Object.keys(rounds).map(Number));
    const cols = Object.entries(rounds).map(([r, ms]) => `<div class="round"><h4>${nombreRonda(Number(r), total)}</h4>${ms
      .sort((a, b) => (a.p || 0) - (b.p || 0))
      .map((m) => {
        const row = (rid) => rid ? `<div class="row ${m.w ? (m.w === rid ? "w" : "l") : ""}"><span>${esc(T[rid]?.nombre || "?")}</span><span>${pointsFor(rid, Number(r))}</span></div>` : '<div class="row l"><span>Por definir</span></div>';
        return `<div class="bm">${m.p ? `<div class="tagp">POR EL LUGAR ${m.p}</div>` : ""}${row(m.t1)}${row(m.t2)}</div>`;
      }).join("")}</div>`).join("");
    $("bracket-body").innerHTML = `<p class="sub-h" style="margin-top:18px">BRACKET DE PLAYOFFS</p><div class="bracket">${cols}</div>`;
  }

  function adicionales(d) {
    const T = d.teams;
    // Récord semanal: mejor puntaje individual en temporada regular
    let record = null;
    for (const sm of d.semanas) {
      if (sm.w > d.ultimaRegular) continue;
      for (const x of sm.list) if (x.p > 0 && (!record || x.p > record.p)) record = { ...x, w: sm.w, enVivo: sm.enVivo };
    }
    const porPuntos = Object.values(T).sort((a, b) => b.pfCalc - a.pfCalc);
    const regularTerminada = d.regularTerminada;
    const baba = babaCampeon(d);
    return { record, porPuntos, regularTerminada, baba };
  }

  function renderAdicionales(d, a) {
    const T = d.teams;
    const P = CFG.adicionales || {};
    const recT = a.record ? T[a.record.rid] : null;
    const pT = a.porPuntos[0];
    const tieneP = pT && pT.pfCalc > 0;
    $("adicionales-body").classList.remove("skeleton");
    $("adicionales-body").innerHTML = `
      <div class="card"><div class="amt">${money(REGLAS.record)}</div><div class="ttl">RECORD SEMANAL</div>
        <div class="desc">Puntaje más alto en una semana de la temporada regular.</div>
        ${recT ? `<div class="who">${teamHtml(recT)}</div><div class="big">${pts(a.record.p)} pts</div><div class="muted">Semana ${a.record.w}${a.record.enVivo ? " (en vivo)" : ""}</div>` : '<p class="muted">Aún sin puntajes.</p>'}
        <p>${estadoPago(a.regularTerminada && recT, P.record)}</p></div>
      <div class="card"><div class="amt">${money(REGLAS.puntos)}</div><div class="ttl">MAS PUNTOS TOTALES</div>
        <div class="desc">Quien acumule más puntos en temporada regular.</div>
        ${tieneP ? `<div class="who">${teamHtml(pT)}</div><div class="big">${pts(pT.pfCalc)} pts</div>
          <ol start="2">${a.porPuntos.slice(1, 4).map((t) => `<li>${esc(t.nombre)} · ${pts(t.pfCalc)} <span class="muted">(-${pts(pT.pfCalc - t.pfCalc)})</span></li>`).join("")}</ol>` : '<p class="muted">Aún sin puntajes.</p>'}
        <p>${estadoPago(a.regularTerminada && tieneP, P.puntos)}</p></div>
      <div class="card"><div class="amt">${money(REGLAS.baba)}</div><div class="ttl">BABA BOWL</div>
        <div class="desc">Consolación para el ganador del bracket de perdedores.</div>
        ${a.baba ? `<div class="who">${teamHtml(T[a.baba])}</div><div class="big">🍺 Campeón Baba</div>`
          : `<p class="muted">${d.semanaActual >= d.playoffStart ? "Se está jugando el bracket de perdedores." : `Arranca en la Semana ${d.playoffStart} con los que no entren a Playoffs.`}</p>`}
        <p>${estadoPago(!!a.baba, P.baba)}</p></div>`;
  }

  function renderInscripciones(d) {
    const { ronda1: R1, ronda2: R2 } = REGLAS.inscripcion;
    const list = Object.values(d.teams).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    let recaudado = 0, completos = 0;
    const rows = list.map((t) => {
      const p = pagoInscripcion(t);
      const monto = (p.ronda1 ? R1 : 0) + (p.ronda2 ? R2 : 0);
      recaudado += monto;
      if (p.ronda1 && p.ronda2) completos++;
      const b = (v) => (v ? `<span class="badge ok">✓ ${esc(fecha(v)) || "PAGADO"}</span>` : '<span class="badge no">PENDIENTE</span>');
      return `<tr><td>${teamHtml(t)}</td><td>${b(p.ronda1)}</td><td>${b(p.ronda2)}</td><td class="num">${money(monto)}</td></tr>`;
    }).join("");
    const pct = Math.min(100, (recaudado / BOLSA) * 100);
    $("inscripciones-body").innerHTML = `
      <div class="progress-lbl"><span>Recaudado <b class="y">${money(recaudado)}</b></span><span>Meta ${money(BOLSA)}</span></div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>MANAGER</th><th>RONDA 1<span class="hide-sm"> · $2,000</span></th><th>RONDA 2<span class="hide-sm"> · $1,500</span></th><th class="num">TOTAL</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      ${CFG.moneypoolUrl ? `<a class="cta" href="${esc(CFG.moneypoolUrl)}" target="_blank" rel="noopener">PAGAR EN MONEYPOOL ▸</a>` : ""}`;
    return { recaudado, completos };
  }

  function renderPagos(d, a) {
    const T = d.teams;
    const P = CFG.adicionales || {};
    const PO = CFG.playoffs || {};
    const items = [];
    for (let w = 1; w <= d.ultimaSemanal; w++) {
      const sm = d.semanas[w - 1];
      if (!sm || !sm.cerrada || !sm.primero) continue;
      const pago = pagoSemanal(w);
      if (sm.badBeat) {
        items.push({ c: `Semana ${w} (Bad Beat)`, rid: sm.primero.rid, m: REGLAS.badBeat.ganador, f: pago.ganador });
        items.push({ c: `Semana ${w} (Bad Beat, 2do)`, rid: sm.segundo.rid, m: REGLAS.badBeat.segundo, f: pago.segundo });
      } else if (sm.empate) {
        items.push({ c: `Semana ${w} (empate)`, rid: sm.primero.rid, m: REGLAS.semanal / 2, f: pago.ganador });
        items.push({ c: `Semana ${w} (empate)`, rid: sm.segundo.rid, m: REGLAS.semanal / 2, f: pago.segundo });
      } else items.push({ c: `Semana ${w}`, rid: sm.primero.rid, m: REGLAS.semanal, f: pago.ganador });
    }
    if (a.regularTerminada && a.record) items.push({ c: "Récord semanal", rid: a.record.rid, m: REGLAS.record, f: P.record });
    if (a.regularTerminada && a.porPuntos[0]) items.push({ c: "Más puntos totales", rid: a.porPuntos[0].rid, m: REGLAS.puntos, f: P.puntos });
    if (a.baba) items.push({ c: "Baba Bowl", rid: a.baba, m: REGLAS.baba, f: P.baba });
    const lugares = lugaresFinales(d);
    for (const [p, amt] of Object.entries(REGLAS.playoffs)) if (lugares[p]) items.push({ c: `Playoffs · ${LUGAR[p]} lugar`, rid: lugares[p], m: amt, f: PO[p] });

    const pagado = items.filter((x) => x.f).reduce((s, x) => s + x.m, 0);
    const porPagar = items.filter((x) => !x.f).reduce((s, x) => s + x.m, 0);

    // Totales por manager
    const porManager = {};
    for (const x of items) {
      const o = (porManager[x.rid] ||= { ganado: 0, cobrado: 0 });
      o.ganado += x.m;
      if (x.f) o.cobrado += x.m;
    }
    const tabla = Object.entries(porManager).sort((a, b) => b[1].ganado - a[1].ganado)
      .map(([rid, o]) => `<tr><td>${teamHtml(T[rid])}</td><td class="num">${money(o.ganado)}</td><td class="num">${money(o.cobrado)}</td><td class="num ${o.ganado - o.cobrado ? "y" : "muted"}">${money(o.ganado - o.cobrado)}</td></tr>`).join("");

    $("pagos-body").innerHTML = items.length ? `
      <div class="tbl-wrap"><table>
        <thead><tr><th>CONCEPTO</th><th>GANADOR</th><th class="num">MONTO</th><th>ESTADO</th></tr></thead>
        <tbody>${items.map((x) => `<tr><td>${esc(x.c)}</td><td>${teamHtml(T[x.rid])}</td><td class="num">${money(x.m)}</td><td>${estadoPago(true, x.f)}</td></tr>`).join("")}</tbody>
      </table></div>
      <p class="sub-h" style="margin-top:20px">GANANCIAS POR MANAGER</p>
      <div class="tbl-wrap"><table>
        <thead><tr><th>MANAGER</th><th class="num">GANADO</th><th class="num">COBRADO</th><th class="num">LE DEBEN</th></tr></thead>
        <tbody>${tabla}</tbody></table></div>`
      : '<p class="note">Todavía no hay premios ganados. El primero sale al cerrar la Semana 1.</p>';
    return { pagado, porPagar };
  }

  // ---------- Main ----------
  let timer = null;
  async function run() {
    const btn = $("refresh");
    btn.disabled = true;
    try {
      const d = await cargar();
      $("error").hidden = true;
      renderHeader(d);
      renderSemana(d);
      renderSemanales(d);
      renderPlayoffs(d);
      const a = adicionales(d);
      renderAdicionales(d, a);
      const ins = renderInscripciones(d);
      const pg = renderPagos(d, a);
      renderKpis(d, { recaudado: ins.recaudado, pagaronTodo: ins.completos, pagado: pg.pagado, porPagar: pg.porPagar });
      $("updated").textContent = "Actualizado " + new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      clearTimeout(timer);
      if (d.semanaActual > 0 && d.semanaActual < 99) timer = setTimeout(run, 90_000);
    } catch (e) {
      console.error(e);
      $("error").innerHTML = "⚠️ " + (e && e.message ? e.message : "No se pudo cargar Sleeper.");
      $("error").hidden = false;
      $("subtitle").textContent = "No se pudieron cargar los datos";
      $("status-pill").textContent = "SIN CONEXIÓN";
    } finally {
      btn.disabled = false;
    }
  }
  $("refresh").addEventListener("click", run);
  run();
})();
