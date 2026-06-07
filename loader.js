const BASE = "/js/";
const APP_VERSION = "1.0.32"; // Subi a versão para garantir o cache novo

const scripts = [
  "utils.js",
  "storage.js",
  "parser.js",
  "search.js",
  "navigation.js",
  "player.js",
  "app.js",
  "ui/home.js",
  "ui/livetv.js",
  "ui/movies.js",
  "ui/series.js",
  "ui/searchpage.js",
  "ui/favorites.js",
  "ui/history.js",
  "ui/settings.js"
];

scripts.forEach(file => {
  const s = document.createElement("script");
  s.src = BASE + file + "?v=" + APP_VERSION;
  s.async = false; // <-- A MÁGICA ACONTECE AQUI. Força a ordem exata de execução!
  document.head.appendChild(s);
});