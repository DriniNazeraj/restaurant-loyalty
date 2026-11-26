// Landing-only fonts (DESIGN.md §8b): Bricolage 700 + Inter 400/600, latin subset only.
// latin covers Albanian (ë U+00EB, ç U+00E7) and the rest of U+0000-00FF; dropping latin-ext
// saves ~82 KB on first load (SEO audit rl1 §3). Rarer glyphs fall back to the system font.
import "@fontsource/bricolage-grotesque/latin-700.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
