# Steam Wishlist Ranker

Web app que toma tu wishlist pública de Steam y te va haciendo elegir, de a
dos juegos, cuál preferís, hasta armar un ranking completo. Usa un algoritmo
tipo _merge sort_, así que para una wishlist de ~50 juegos vas a responder
del orden de 250-300 comparaciones.

## Requisitos

- Node.js 18 o superior
- Que tu wishlist de Steam sea **pública** (Perfil → Editar perfil →
  Configuración de privacidad → Wishlist: Público)

## Correrlo local

```bash
npm install
npm run dev
```

Abrí http://localhost:3000

En el input pegá cualquiera de estas variantes:

- `https://steamcommunity.com/id/tu-nombre-de-usuario/`
- `https://steamcommunity.com/profiles/76561198000000000/`
- `tu-nombre-de-usuario` (a secas)
- `76561198000000000` (tu steamID64, a secas)

## Notas / límites conocidos

- Si el perfil no existe o la wishlist es privada, la API devuelve un error
  claro que se muestra en pantalla.
- La estimación de "cantidad de duelos" en el contador de arriba es
  aproximada (el merge sort real a veces necesita algunas comparaciones
  menos según cómo caigan los empates de orden).
