import { useCallback, useRef, useState } from "react";

function estimateComparisons(n) {
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

export default function Home() {
  const [phase, setPhase] = useState("input"); // input | loading | duel | results
  const [error, setError] = useState("");
  const [profileInput, setProfileInput] = useState("");

  const [currentPair, setCurrentPair] = useState(null); // {a, b}
  const [chosenIdx, setChosenIdx] = useState(null); // 0 | 1 | null
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [finalGames, setFinalGames] = useState(null);

  const compareResolverRef = useRef(null);
  const totalGamesRef = useRef(0);

  const compare = useCallback((a, b) => {
    return new Promise((resolve) => {
      setCurrentPair({ a, b });
      compareResolverRef.current = resolve;
    });
  }, []);

  const merge = useCallback(
    async (left, right) => {
      const result = [];
      let i = 0;
      let j = 0;
      while (i < left.length && j < right.length) {
        const cmp = await compare(left[i], right[j]);
        if (cmp <= 0) {
          result.push(left[i]);
          i++;
        } else {
          result.push(right[j]);
          j++;
        }
      }
      return result.concat(left.slice(i)).concat(right.slice(j));
    },
    [compare]
  );

  const mergeSort = useCallback(
    async (arr) => {
      if (arr.length <= 1) return arr;
      const mid = Math.floor(arr.length / 2);
      const left = await mergeSort(arr.slice(0, mid));
      const right = await mergeSort(arr.slice(mid));
      return merge(left, right);
    },
    [merge]
  );

  const chooseWinner = (idx) => {
    if (!compareResolverRef.current) return;
    setChosenIdx(idx);
    setProgress((p) => ({ ...p, done: Math.min(p.done + 1, p.total) }));
    setTimeout(() => {
      const resolve = compareResolverRef.current;
      compareResolverRef.current = null;
      setChosenIdx(null);
      setCurrentPair(null);
      resolve(idx === 0 ? -1 : 1);
    }, 180);
  };

  const startRanking = async (games) => {
    totalGamesRef.current = games.length;
    setProgress({ done: 0, total: estimateComparisons(games.length) });
    setPhase("duel");
    const sorted = await mergeSort(shuffle(games));
    setFinalGames(sorted);
    setPhase("results");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profileInput.trim()) return;
    setError("");
    setPhase("loading");
    try {
      const res = await fetch(`/api/wishlist?input=${encodeURIComponent(profileInput.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al obtener la wishlist.");
      }
      if (data.games.length === 1) {
        setFinalGames(data.games);
        setPhase("results");
        return;
      }
      await startRanking(data.games);
    } catch (err) {
      setError(err.message);
      setPhase("input");
    }
  };

  const reset = () => {
    setPhase("input");
    setFinalGames(null);
    setCurrentPair(null);
    setChosenIdx(null);
    setError("");
  };

  return (
    <div className="container">
      {phase === "input" && (
        <div className="intro">
          <h1>VERSUS</h1>
          <p className="sub">
            Pegá tu perfil de Steam. Vas a ir eligiendo, de a dos, qué juego de tu
            wishlist preferís, hasta armar el orden real de prioridades.
            La wishlist tiene que ser pública.
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

      {phase === "duel" && currentPair && (
        <>
          <div className="scoreboard">
            <span className="count">
              {progress.done.toString().padStart(3, "0")} / {progress.total.toString().padStart(3, "0")}
            </span>
            <div className="bar">
              <div
                className="bar-fill"
                style={{
                  width: `${progress.total ? Math.min(100, (progress.done / progress.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="duel">
            {[currentPair.a, currentPair.b].map((game, idx) => {
              let cls = "duel-card";
              if (chosenIdx === idx) cls += " chosen";
              if (chosenIdx !== null && chosenIdx !== idx) cls += " rejected";
              return (
                <button
                  key={game.appid}
                  className={cls}
                  onClick={() => chooseWinner(idx)}
                  disabled={chosenIdx !== null}
                  aria-label={`Elegir ${game.name}`}
                >
                  <img src={game.image} alt="" loading="eager" />
                  <div className="name">{game.name}</div>
                  <div className="key-hint">{idx === 0 ? "←" : "→"}</div>
                </button>
              );
            })}
            <div className="vs-divider">
              <span>VS</span>
            </div>
          </div>
        </>
      )}

      {phase === "results" && finalGames && (
        <div className="results">
          <h2>Tu ranking</h2>
          <p className="sub">{finalGames.length} juegos, de mayor a menor prioridad.</p>
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
