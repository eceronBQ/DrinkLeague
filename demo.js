/* Datos falsos para previsualizar el sitio: abre index.html?demo=1
   Opcional: &semana=N para simular otra semana (1–17, o 99 = temporada terminada). */
(() => {
  const params = new URLSearchParams(location.search);
  const SEMANA = Number(params.get("semana")) || 5;
  const DONE = SEMANA >= 99;
  const PLAYOFF_START = 15;

  let seed = 2026;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const nombres = ["Los Borrachos", "Cheve Fría FC", "Mezcal Warriors", "Michelada Mafia", "Tequila Titans", "Caguama Kings",
    "Pulque Power", "Baba Bowl Favs", "Clamato Crew", "Chela Chiefs", "Tecate Light Brigade", "Cruda Eterna"];
  const users = nombres.map((n, i) => ({ user_id: "u" + (i + 1), display_name: "manager" + (i + 1), avatar: null, metadata: { team_name: n } }));
  const N = 12;

  // Calendario round-robin (método del círculo)
  const schedule = [];
  const ids = Array.from({ length: N }, (_, i) => i + 1);
  for (let w = 0; w < 14; w++) {
    const r = [ids[0], ...ids.slice(1).map((_, i) => ids[1 + ((i + w) % (N - 1))])];
    const pairs = [];
    for (let i = 0; i < N / 2; i++) pairs.push([r[i], r[N - 1 - i]]);
    schedule.push(pairs);
  }

  const skill = ids.map(() => 95 + rnd() * 30);
  const lastWeek = DONE ? 17 : SEMANA;
  const weeks = {};
  const rec = Object.fromEntries(ids.map((id) => [id, { w: 0, l: 0, pf: 0, pa: 0 }]));
  for (let w = 1; w <= Math.min(lastWeek, 17); w++) {
    const live = !DONE && w === SEMANA;
    const frac = live ? 0.55 : 1;
    const pointsOf = (rid) => +((skill[rid - 1] + (rnd() - 0.5) * 60) * frac).toFixed(2);
    const pairs = w <= 14 ? schedule[w - 1] : [];
    const ms = [];
    pairs.forEach(([a, b], k) => {
      let pa = pointsOf(a), pb = pointsOf(b);
      if (w === 2 && k === 0) { pa = 171.44; pb = 166.1; } // fuerza un Bad Beat en la Semana 2
      ms.push({ roster_id: a, matchup_id: k + 1, points: pa }, { roster_id: b, matchup_id: k + 1, points: pb });
      if (!live && w <= 14) {
        const A = rec[a], B = rec[b];
        A.pf += pa; A.pa += pb; B.pf += pb; B.pa += pa;
        if (pa > pb) { A.w++; B.l++; } else { B.w++; A.l++; }
      }
    });
    if (w > 14) ids.forEach((id, k) => ms.push({ roster_id: id, matchup_id: null, points: pointsOf(id) }));
    weeks[w] = ms;
  }

  const rosters = ids.map((id) => ({
    roster_id: id, owner_id: "u" + id,
    settings: { wins: rec[id].w, losses: rec[id].l, ties: 0, fpts: Math.floor(rec[id].pf), fpts_decimal: Math.round((rec[id].pf % 1) * 100),
      fpts_against: Math.floor(rec[id].pa), fpts_against_decimal: Math.round((rec[id].pa % 1) * 100) },
  }));

  // Brackets de 6 equipos (seeds 1 y 2 descansan en la ronda 1)
  const sorted = [...ids].sort((a, b) => rec[b].w - rec[a].w || rec[b].pf - rec[a].pf);
  const pts = (w, rid) => (weeks[w] || []).find((m) => m.roster_id === rid)?.points || 0;
  function bracket(s) {
    const played = (w) => DONE || SEMANA > w;
    const game = (m, r, t1, t2, p) => {
      const w = PLAYOFF_START + r - 1;
      const g = { m, r, t1, t2, w: null, l: null };
      if (p) g.p = p;
      if (t1 && t2 && played(w)) { const a = pts(w, t1), b = pts(w, t2); g.w = a >= b ? t1 : t2; g.l = a >= b ? t2 : t1; }
      return g;
    };
    const g1 = game(1, 1, s[2], s[5]), g2 = game(2, 1, s[3], s[4]);
    const g3 = game(3, 2, s[0], g2.w), g4 = game(4, 2, s[1], g1.w), g5 = game(5, 2, g1.l, g2.l, 5);
    const g6 = game(6, 3, g3.w, g4.w, 1), g7 = game(7, 3, g3.l, g4.l, 3);
    return [g1, g2, g3, g4, g5, g6, g7];
  }
  const winners = bracket(sorted.slice(0, 6));
  const losers = bracket(sorted.slice(6));

  const state = { week: DONE ? 18 : SEMANA, leg: DONE ? 18 : SEMANA, display_week: DONE ? 18 : SEMANA, season: "2026", season_type: "regular" };
  const league = { league_id: "demo", name: "Drink League", season: "2026", status: DONE ? "complete" : "in_season",
    settings: { playoff_week_start: PLAYOFF_START, playoff_teams: 6, last_scored_leg: DONE ? 17 : SEMANA - 1 } };

  window.DEMO_API = async (path) => {
    if (path === "state/nfl") return state;
    if (path === "league/demo") return league;
    if (path.endsWith("/users")) return users;
    if (path.endsWith("/rosters")) return rosters;
    if (path.endsWith("/winners_bracket")) return winners;
    if (path.endsWith("/losers_bracket")) return losers;
    const m = path.match(/matchups\/(\d+)$/);
    if (m) return weeks[m[1]] || [];
    return null;
  };

  // Pagos de ejemplo para ver cómo se ve
  const cfg = window.DRINK_LEAGUE || (window.DRINK_LEAGUE = {});
  cfg.inscripciones = Object.fromEntries(users.map((u, i) => [u.display_name, { ronda1: i < 11 ? "2026-09-0" + (1 + (i % 6)) : null, ronda2: i < 3 ? "2026-09-20" : null }]));
  cfg.semanales = { 1: "2026-09-16", 2: { ganador: "2026-09-23", segundo: null } };
})();
