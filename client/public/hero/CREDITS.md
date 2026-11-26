# Hero photos [PH]

Stock placeholders for the landing hero (DESIGN.md §10.1), one per demo theme, until each
restaurant sends its own photo. All are from Pexels and used under the
[Pexels licence](https://www.pexels.com/license/): free to use, no attribution required
(we credit anyway, bottom-right of the hero), no people in frame.

| theme | file(s) | photo | photographer | Pexels page |
|---|---|---|---|---|
| trattoria (default) | `trattoria-800.webp`, `trattoria-1600.webp` | spaghetti al pomodoro, wood table | Cristian Mihaila | https://www.pexels.com/photo/spaghetti-on-plate-11653569/ |
| minimal | `minimal-800.webp`, `minimal-1600.webp` | empty dining room, pendant lights | Wender Junior Souza Vieira | https://www.pexels.com/photo/empty-restaurant-interior-6429597/ |
| luxe | `luxe-800.webp`, `luxe-1600.webp` | plated dish on black stoneware | Rachel Claire | https://www.pexels.com/photo/gourmet-on-a-black-earthenware-5865244/ |
| cafe | `cafe-800.webp`, `cafe-1600.webp` | dessert + coffee by a sunny window | Amine Kübranur Çakıroğlu | https://www.pexels.com/photo/cozy-cafe-scene-with-dessert-and-coffee-by-window-38975923/ |
| rustic | `rustic-800.webp`, `rustic-1280.webp` | beamed dining room with a fireplace | Maria Orlova | https://www.pexels.com/photo/banquet-tables-in-restaurant-with-shiny-fireplace-4915622/ |

Files were cropped to 8:5 and compressed by the ui/ux designer. Credits and URLs also live in
`client/src/lib/theme.ts` (`THEMES[...].hero`), which renders the on-photo credit.

## Removing the theme demo (DESIGN.md §10.4), once a theme is picked

1. Delete `client/src/components/ThemeSwitcher.tsx` and its lazy import + mount in `client/src/App.tsx`.
2. In `client/index.html`, delete the inline theme `<script>` and hard-set `data-theme="<picked>"` on `<html>`.
3. In `client/src/lib/theme.ts`, delete `isThemeDemoEnabled`, `setTheme`, the storage keys and the
   other four entries in `THEMES` / `FONT_LOADERS`; make `applyRestaurantTint` stop checking the demo.
4. In `client/src/styles/themes.css`, keep only the picked theme's block (and its button/card rules).
5. Delete the other four `client/src/styles/themes/<id>.fonts.css` files and `npm uninstall` their
   `@fontsource/*` packages.
6. Delete the other four themes' images here and their rows above.
7. Drop `VITE_THEME_DEMO` from `client/.env.example` / any `.env`.
