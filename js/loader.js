const version = Date.now(); // ou build hash

const scripts = [
  "utils.js",
  "storage.js",
  "parser.js",
  "search.js",
  "navigation.js",
  "player.js",
  "ui/home.js",
  "ui/livetv.js",
  "ui/movies.js",
  "ui/series.js",
  "ui/searchpage.js",
  "ui/favorites.js",
  "ui/history.js",
  "ui/settings.js",
  "app.js"
];

scripts.forEach(src => {
  const s = document.createElement("script");
  s.src = `${src}?v=${version}`;
  document.head.appendChild(s);
});