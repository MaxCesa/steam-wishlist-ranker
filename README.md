# Steam Wishlist Ranker

Web app que toma tu wishlist pública de Steam y te va haciendo elegir, de a
dos juegos, cuál preferís, hasta armar un ranking completo. Usa un algoritmo
tipo _merge sort_, así que para una wishlist de ~50 juegos vas a responder
del orden de 250-300 comparaciones en vez de las ~1200 que serían "todos
contra todos".

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

## Cómo funciona

- `pages/api/wishlist.js`: corre en el servidor, arma la URL correcta según
  el tipo de perfil, y descarga el JSON de la wishlist directo de Steam
  (esto evita el bloqueo de CORS que hay si lo pedís desde el navegador).
- `pages/index.js`: maneja las tres pantallas (input, duelo, resultados) y
  el algoritmo de ranking por comparaciones.

## Deploy (para la parte pública más adelante)

Este proyecto es un Next.js estándar, así que se despliega gratis en
[Vercel](https://vercel.com) sin tocar nada: conectás el repo de GitHub y
listo. Si más adelante lo abrís a otros usuarios, lo único que vas a
necesitar es que cada uno ingrese su propio perfil (ya está pensado así,
no hay estado compartido ni base de datos).

## Notas / límites conocidos

- Si el perfil no existe o la wishlist es privada, la API devuelve un error
  claro que se muestra en pantalla.
- El ranking se pierde si recargás la página a mitad de los duelos (no hay
  persistencia todavía). Si te interesa guardarlo, se puede agregar
  `localStorage` fácilmente.
- La estimación de "cantidad de duelos" en el contador de arriba es
  aproximada (el merge sort real a veces necesita algunas comparaciones
  menos según cómo caigan los empates de orden).
