const BASE = "/js/";

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
  s.src = BASE + file + "?v=" + Date.now();
  document.head.appendChild(s);
});