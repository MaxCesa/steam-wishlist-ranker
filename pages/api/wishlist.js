// Obtiene la wishlist pública de un perfil de Steam.

function extractVanityOrId(raw) {
  const str = raw
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  let m = str.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (m) return { type: "id64", value: m[1] };

  if (/^\d{17}$/.test(str)) return { type: "id64", value: str };

  m = str.match(/steamcommunity\.com\/id\/([^\/?#]+)/i);
  if (m) return { type: "vanity", value: m[1] };

  if (str.length > 0) return { type: "vanity", value: str };

  throw new Error("No entendí ese perfil de Steam.");
}

async function resolveSteamId64(input) {
  const parsed = extractVanityOrId(input);
  if (parsed.type === "id64") return parsed.value;

  // Perfil con vanity URL (steamcommunity.com/id/xxx): lo resolvemos vía
  // el XML público del perfil, que no requiere API key.
  const res = await fetch(
    `https://steamcommunity.com/id/${encodeURIComponent(parsed.value)}/?xml=1`,
    {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WishlistRanker/1.0)" },
    },
  );

  if (!res.ok) {
    throw new Error("No pude contactar a Steam para resolver ese perfil.");
  }

  const xml = await res.text();
  const idMatch = xml.match(/<steamID64>(\d+)<\/steamID64>/);
  if (!idMatch) {
    throw new Error(
      "No encontré ese perfil de Steam. Revisá el nombre de usuario o la URL.",
    );
  }
  return idMatch[1];
}

async function fetchWishlistItems(steamid64) {
  const res = await fetch(
    `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${steamid64}`,
    {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WishlistRanker/1.0)" },
    },
  );

  if (!res.ok) {
    throw new Error(
      "Steam no respondió correctamente. Probá de nuevo en un rato.",
    );
  }

  const data = await res.json();
  const items =
    data && data.response && Array.isArray(data.response.items)
      ? data.response.items
      : null;

  if (!items) {
    throw new Error(
      "No encontré una wishlist pública para ese perfil. Revisá que exista y que la wishlist esté en público (Perfil → Editar perfil → Privacidad → Wishlist).",
    );
  }

  return items;
}

function defaultImage(appid) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

async function fetchAppInfo(appid) {
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic&l=english`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; WishlistRanker/1.0)",
        },
      },
    );
    if (res.ok) {
      const json = await res.json();
      const entry = json[appid];
      if (entry && entry.success && entry.data) {
        return {
          name: entry.data.name || `App ${appid}`,
          image: entry.data.header_image || defaultImage(appid),
        };
      }
    }
  } catch {
    // seguimos al fallback
  }
  return { name: `App ${appid}`, image: defaultImage(appid) };
}

// Evita disparar cientos de pedidos en paralelo (Steam rate-limitea).
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const current = next++;
      results[current] = await fn(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export default async function handler(req, res) {
  const input = req.query.input;
  if (!input || typeof input !== "string") {
    return res.status(400).json({ error: "Falta el perfil de Steam." });
  }

  try {
    const steamid64 = await resolveSteamId64(input);
    const items = await fetchWishlistItems(steamid64);

    if (items.length === 0) {
      return res.status(404).json({
        error:
          "Esa wishlist está vacía. Agregá algún juego y volvé a intentar.",
      });
    }

    const infos = await mapWithConcurrency(items, 6, (item) =>
      fetchAppInfo(item.appid),
    );

    const games = items.map((item, i) => ({
      appid: item.appid,
      name: infos[i].name,
      image: infos[i].image,
      originalPriority:
        typeof item.priority === "number" ? item.priority : null,
    }));

    return res.status(200).json({ games });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Error inesperado." });
  }
}
