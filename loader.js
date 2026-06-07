const BASE = "/js/";
const APP_VERSION = "1.0.2"; // Atualizado para limpar o cache

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

let loadedCount = 0;

scripts.forEach(file => {
  const s = document.createElement("script");
  s.src = BASE + file + "?v=" + APP_VERSION;
  s.async = false; // Mantém a ordem de execução!
  
  // Quando o script terminar de carregar, soma no contador
  s.onload = () => {
    loadedCount++;
    // Se for o último script da lista a carregar, inicia o App
    if (loadedCount === scripts.length) {
      if (typeof App !== 'undefined') {
        App.init().catch(e => console.error('App init error:', e));
      } else {
        console.error('App não foi encontrado. Verifique se o app.js carregou corretamente.');
      }
    }
  };
  
  // Em caso de erro ao carregar algum arquivo, avisa no console
  s.onerror = () => {
    console.error(`Erro ao carregar o arquivo: ${file}`);
  };

  document.head.appendChild(s);
});