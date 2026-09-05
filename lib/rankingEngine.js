// Motor de ranking por comparaciones, implementado como una máquina de
// estados explícita (bottom-up merge sort) en vez de recursión con
// promises. La ventaja: el estado completo es un objeto plano en
// cualquier momento, así que se puede persistir (localStorage) y
// reconstruir tal cual, y también se puede leer "el orden actual" sin
// terminar el proceso.

export function estimateComparisons(n) {
  if (n <= 1) return 0;
  return Math.max(1, Math.round(n * Math.log2(n) - n + 1));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Crea el estado inicial: cada juego es su propia "corrida" (run) de
// tamaño 1, en orden aleatorio.
export function createRankingState(games) {
  const runs = shuffle(games).map((g) => [g]);
  return {
    runs,
    newRuns: [],
    currentMerge: null,
    progressDone: 0,
    progressTotal: estimateComparisons(games.length),
  };
}

// Avanza el estado hasta que haga falta preguntarle algo a la persona, o
// hasta que el ranking esté completo.
// Devuelve { state, pair } si hace falta una comparación,
// o { state, done: true, result } si terminó.
export function advance(state) {
  let runs = state.runs.slice();
  let newRuns = state.newRuns.slice();
  let currentMerge = state.currentMerge;

  while (true) {
    if (currentMerge) {
      const { left, right, li, ri, merged } = currentMerge;
      if (li < left.length && ri < right.length) {
        return {
          state: { ...state, runs, newRuns, currentMerge },
          pair: { a: left[li], b: right[ri] },
        };
      }
      const finished = merged.concat(left.slice(li), right.slice(ri));
      newRuns.push(finished);
      currentMerge = null;
      continue;
    }

    if (runs.length >= 2) {
      const left = runs.shift();
      const right = runs.shift();
      currentMerge = { left, right, li: 0, ri: 0, merged: [] };
      continue;
    }

    if (runs.length === 1) {
      newRuns.push(runs.shift());
      continue;
    }

    // No quedan runs sueltas en este nivel.
    if (newRuns.length <= 1) {
      return {
        state: { ...state, runs: [], newRuns: [], currentMerge: null },
        done: true,
        result: newRuns[0] || [],
      };
    }

    // Pasamos al siguiente nivel del merge sort.
    runs = newRuns;
    newRuns = [];
  }
}

// Aplica la elección de la persona (winnerIsA: true si eligió el juego
// "a" del par actual) al merge en curso.
export function applyChoice(state, winnerIsA) {
  const { left, right, li, ri, merged } = state.currentMerge;
  const nextMerge = winnerIsA
    ? { left, right, li: li + 1, ri, merged: [...merged, left[li]] }
    : { left, right, li, ri: ri + 1, merged: [...merged, right[ri]] };

  return {
    ...state,
    currentMerge: nextMerge,
    progressDone: Math.min(state.progressDone + 1, state.progressTotal),
  };
}

// Orden actual, sin terminar el proceso: las corridas ya cerradas (que
// están 100% ordenadas entre sí) van primero, después lo que se llevaba
// mezclado del duelo en curso, y al final lo que todavía no se comparó.
// No es el resultado final
export function getCurrentOrder(state) {
  const parts = [];
  for (const run of state.newRuns) parts.push(...run);
  if (state.currentMerge) {
    const { left, right, li, ri, merged } = state.currentMerge;
    parts.push(...merged, ...left.slice(li), ...right.slice(ri));
  }
  for (const run of state.runs) parts.push(...run);
  return parts;
}
