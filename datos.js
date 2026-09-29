/* =====================================================================
   DRINK LEAGUE 2026 — ARCHIVO QUE EDITA EL COMISIONADO
   ---------------------------------------------------------------------
   Todo lo que viene de Sleeper (puntos, récords, playoffs) se actualiza
   solo. Aquí solo marcas lo que Sleeper no sabe: quién pagó y a quién
   ya se le pagó un premio.

   Para marcar algo como pagado escribe la fecha entre comillas, por
   ejemplo "2026-09-05". Si no ha pagado, deja null.
   ===================================================================== */

window.DRINK_LEAGUE = {

  // Número largo que aparece en sleeper.com/leagues/XXXXXXXXXXXXXXXX
  leagueId: "1391127467401424896",

  // Enlace a la Moneypool (opcional, aparece como botón en el sitio)
  moneypoolUrl: "",

  /* ---------- INSCRIPCIONES ($2,000 + $1,500) ----------
     La llave es el usuario de Sleeper (el @ de cada manager, sin @).
     Los managers que no aparezcan aquí se muestran como "pendiente". */
  inscripciones: {
    "YurFader":        { ronda1: null, ronda2: null },
    "eceronMX":        { ronda1: "2026-09-15", ronda2: null },  // SeaDrunks
    "binizza":         { ronda1: "2026-09-15", ronda2: null },  // Wera 49ers
    "BetukaTuka":      { ronda1: "2026-09-21", ronda2: null },
    "eluisft":         { ronda1: null, ronda2: null },  // MachinGun
    "zaldoalejandra":  { ronda1: null, ronda2: null },  // Liquor Field
    "faithfulthebay":  { ronda1: "2026-09-16", ronda2: null },  // yadepositenme
    "ggama3g":         { ronda1: "2026-09-16", ronda2: null },
    "Pistoleros81":    { ronda1: "2026-09-15", ronda2: null },  // Pistolero
    "jcarlos2026":     { ronda1: null, ronda2: null },  // Los ex de la del Valle
    "AlexBrug74":      { ronda1: "2026-09-18", ronda2: null },  // Lone Star Rangers
    "AlfredRCV":       { ronda1: "2026-09-15", ronda2: null },
  },

  /* ---------- PREMIO SEMANAL ($1,000, semanas 1–14) ----------
     Número de semana → fecha en que se pagó al ganador.
     Si hubo Bad Beat ($800/$200) o empate en el 1er lugar ($500 c/u), usa
     { ganador: "fecha", segundo: "fecha" }. En un empate, "ganador" es el
     equipo que aparece primero en el sitio. */
  semanales: {
    // 1: "2026-09-16",
    // 2: { ganador: "2026-09-23", segundo: null },
  },

  /* ---------- ADICIONALES ---------- */
  adicionales: {
    record:  null,   // Récord semanal       $2,000
    puntos:  null,   // Más puntos totales   $2,000
    baba:    null,   // Baba Bowl            $1,000
  },

  /* ---------- PLAYOFFS (lugar → fecha de pago) ---------- */
  playoffs: {
    1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
  },
};
