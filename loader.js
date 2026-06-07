// loader.js
const BASE = "/js/";
const APP_VERSION = "1.0.29"; // Mude isso apenas quando fizer alterações reais no código

const scripts = [
  "utils.js", "storage.js", "parser.js", "search.js",
  "navigation.js", "player.js", "app.js",
  "ui/home.js", "ui/livetv.js", "ui/movies.js",
  "ui/series.js", "ui/searchpage.js", "ui/favorites.js",
  "ui/history.js", "ui/settings.js"
];

scripts.forEach(file => {
  const s = document.createElement("script");
  s.src = BASE + file + "?v=" + APP_VERSION; 
  document.head.appendChild(s);
});