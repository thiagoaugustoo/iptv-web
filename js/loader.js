const version = Date.now(); // ou build hash

const scripts = [
  "js/utils.js",
  "js/storage.js",
  "js/parser.js",
  "js/search.js",
  "js/navigation.js",
  "js/player.js",
  "js/ui/home.js",
  "js/ui/livetv.js",
  "js/ui/movies.js",
  "js/ui/series.js",
  "js/ui/searchpage.js",
  "js/ui/favorites.js",
  "js/ui/history.js",
  "js/ui/settings.js",
  "js/app.js",
  "https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js"
];

scripts.forEach(src => {
  const s = document.createElement("script");
  s.src = `${src}?v=${version}`;
  document.head.appendChild(s);
});