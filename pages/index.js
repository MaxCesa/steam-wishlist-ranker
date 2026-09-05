import { useEffect, useState } from "react";
import {
  applyChoice,
  advance,
  createRankingState,
  getCurrentOrder,
} from "../lib/rankingEngine";

const STORAGE_KEY = "steam-wishlist-ranker:session";

function saveSession(session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // localStorage puede fallar (modo privado, cuota, etc.) - no es crítico.
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nada que hacer
  }
}

export default function Home() {
  // input | loading | resume | duel | results
  const [phase, setPhase] = useState("input");
  const [error, setError] = useState("");
  const [profileInput, setProfileInput] = useState("");

  const [rankState, setRankState] = useState(null);
  const [currentPair, setCurrentPair] = useState(null);
  const [chosenIdx, setChosenIdx] = useState(null);
  const [finalGames, setFinalGames] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const [savedSession, setSavedSession] = useState(null);

  // Al cargar la página, si hay una sesión guardada (en progreso o
  // terminada), ofrecemos continuarla en vez de arrancar de cero.
  useEffect(() => {
    const saved = loadSession();
    if (saved && (saved.phase === "duel" || saved.phase === "results")) {
      setSavedSession(saved);
      setPhase("resume");
    }
  }, []);

  // Persistimos automáticamente mientras hay un ranking en progreso o
  // terminado. No pisamos nada mientras estamos en input/loading/resume.
  useEffect(() => {
    if (phase !== "duel" && phase !== "results") return;
    saveSession({
      profileInput,
      phase,
      rankState: phase === "duel" ? rankState : null,
      currentPair: phase === "duel" ? currentPair : null,
      finalGames: phase === "results" ? finalGames : null,
      savedAt: Date.now(),
    });
  }, [phase, rankState, currentPair, finalGames, profileInput]);

  const resumeSaved = () => {
    if (!savedSession) return;
    setProfileInput(savedSession.profileInput || "");
    if (savedSession.phase === "duel") {
      let state = savedSession.rankState;
      let pair = savedSession.currentPair;
      if (!pair && state) {
        const step = advance(state);
        state = step.state;
        pair = step.pair || null;
        if (step.done) {
          setFinalGames(step.result);
          setPhase("results");
          setSavedSession(null);
          return;
        }
      }
      setRankState(state);
      setCurrentPair(pair);
      setPhase("duel");
    } else {
      setFinalGames(savedSession.finalGames);
      setPhase("results");
    }
    setSavedSession(null);
  };

  const discardSaved = () => {
    clearSession();
    setSavedSession(null);
    setPhase("input");
  };

  const startRanking = (games) => {
    const initial = createRankingState(games);
    const step = advance(initial);
    if (step.done) {
      setFinalGames(step.result);
      setPhase("results");
      return;
    }
    setRankState(step.state);
    setCurrentPair(step.pair);
    setPhase("duel");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profileInput.trim()) return;
    setError("");
    setPhase("loading");
    try {
      const res = await fetch(
        `/api/wishlist?input=${encodeURIComponent(profileInput.trim())}`,
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al obtener la wishlist.");
      }
      if (data.games.length === 1) {
        setFinalGames(data.games);
        setPhase("results");
        return;
      }
      startRanking(data.games);
    } catch (err) {
      setError(err.message);
      setPhase("input");
    }
  };

  const chooseWinner = (idx) => {
    if (!currentPair || !rankState) return;
    setChosenIdx(idx);
    setTimeout(() => {
      const applied = applyChoice(rankState, idx === 0);
      const step = advance(applied);
      setChosenIdx(null);
      setCurrentPair(null);
      setRankState(step.state);
      if (step.done) {
        setFinalGames(step.result);
        setPhase("results");
      } else {
        setCurrentPair(step.pair);
      }
    }, 180);
  };

  const reset = () => {
    clearSession();
    setPhase("input");
    setRankState(null);
    setCurrentPair(null);
    setFinalGames(null);
    setChosenIdx(null);
    setShowOrderModal(false);
    setError("");
  };

  // Atajos de teclado: flecha izq / "1" elige la carta A,
  // flecha der / "2" elige la carta B.
  useEffect(() => {
    if (phase !== "duel" || !currentPair || chosenIdx !== null) return;
    const onKeyDown = (e) => {
      if (e.key === "ArrowLeft" || e.key === "1") chooseWinner(0);
      else if (e.key === "ArrowRight" || e.key === "2") chooseWinner(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, currentPair, chosenIdx, rankState]);

  const progress = rankState
    ? { done: rankState.progressDone, total: rankState.progressTotal }
    : { done: 0, total: 0 };

  return (
    <div className="container">
      {phase === "input" && (
        <div className="intro">
          <h1>VERSUS</h1>
          <p className="sub">
            Pegá tu perfil de Steam. Vas a ir eligiendo, de a dos, qué juego de
            tu wishlist preferís, hasta armar el orden real de prioridades. La
            wishlist tiene que ser pública.
          </p>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="steamcommunity.com/id/tu-usuario"
              value={profileInput}
              onChange={(e) => setProfileInput(e.target.value)}
              autoFocus
            />
            <button className="btn-primary" type="submit">
              Empezar
            </button>
          </form>
          {error && <div className="error-box">{error}</div>}
        </div>
      )}

      {phase === "loading" && (
        <div className="intro">
          <p className="sub">Buscando tu wishlist en Steam…</p>
        </div>
      )}

      {phase === "resume" && savedSession && (
        <div className="intro">
          <h1>VERSUS</h1>
          {savedSession.phase === "duel" ? (
            <p className="sub">
              Tenés un ranking sin terminar de{" "}
              <strong>{savedSession.profileInput}</strong> (
              {savedSession.rankState?.progressDone ?? 0} /{" "}
              {savedSession.rankState?.progressTotal ?? 0} duelos). ¿Lo
              continuamos?
            </p>
          ) : (
            <p className="sub">
              Tenés un ranking terminado de{" "}
              <strong>{savedSession.profileInput}</strong> guardado. ¿Lo querés
              ver o empezar uno nuevo?
            </p>
          )}
          <div className="results-actions" style={{ justifyContent: "center" }}>
            <button className="btn-primary" onClick={resumeSaved}>
              {savedSession.phase === "duel" ? "Continuar" : "Ver ranking"}
            </button>
            <button className="btn-secondary" onClick={discardSaved}>
              Empezar de nuevo
            </button>
          </div>
        </div>
      )}

      {phase === "duel" && currentPair && (
        <>
          <div className="scoreboard">
            <span className="count">
              {progress.done.toString().padStart(3, "0")} /{" "}
              {progress.total.toString().padStart(3, "0")}
            </span>
            <div className="bar">
              <div
                className="bar-fill"
                style={{
                  width: `${progress.total ? Math.min(100, (progress.done / progress.total) * 100) : 0}%`,
                }}
              />
            </div>
            <button
              className="link-btn"
              onClick={() => setShowOrderModal(true)}
            >
              Ver orden actual
            </button>
          </div>

          <div
            className="duel"
            key={`${currentPair.a.appid}-${currentPair.b.appid}`}
          >
            {[currentPair.a, currentPair.b].map((game, idx) => {
              let cls = `duel-card ${idx === 0 ? "side-left" : "side-right"}`;
              if (chosenIdx === idx) cls += " chosen";
              if (chosenIdx !== null && chosenIdx !== idx) cls += " rejected";
              return (
                <div className="duel-side" key={game.appid}>
                  <button
                    className={cls}
                    onClick={() => chooseWinner(idx)}
                    disabled={chosenIdx !== null}
                    aria-label={`Elegir ${game.name}`}
                  >
                    <div className="media">
                      <img src={game.image} alt="" loading="eager" />
                      <div className="scrim" />
                    </div>
                    <div className="name">{game.name}</div>
                    <div className="key-hint">{idx === 0 ? "←" : "→"}</div>
                  </button>
                  <a
                    className="steam-link"
                    href={`https://store.steampowered.com/app/${game.appid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver en Steam ↗
                  </a>
                </div>
              );
            })}
            <div className="vs-badge">
              <span>VS</span>
            </div>
          </div>
        </>
      )}

      {phase === "duel" && showOrderModal && rankState && (
        <OrderModal
          title="Orden estimado hasta ahora"
          subtitle="Todavía no terminaste todos los duelos, así que este orden puede cambiar."
          games={getCurrentOrder(rankState)}
          onClose={() => setShowOrderModal(false)}
        />
      )}

      {phase === "results" && finalGames && (
        <div className="results">
          <h2>Tu ranking</h2>
          <p className="sub">
            {finalGames.length} juegos, de mayor a menor prioridad.
          </p>
          {finalGames.map((game, i) => (
            <div className="rank-row" key={game.appid}>
              <div className="rank-num">{i + 1}</div>
              <img src={game.image} alt="" />
              <div className="rank-name">{game.name}</div>
            </div>
          ))}
          <div className="results-actions">
            <button className="btn-secondary" onClick={reset}>
              Volver a empezar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderModal({ title, subtitle, games, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            <p className="sub">{subtitle}</p>
          </div>
          <button className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="modal-body">
          {games.map((game, i) => (
            <div className="rank-row" key={game.appid}>
              <div className="rank-num">{i + 1}</div>
              <img src={game.image} alt="" />
              <div className="rank-name">{game.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
