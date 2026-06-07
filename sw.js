const CACHE_NAME = 'iptv-web-v1';

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Limpa caches antigos caso você mude a versão no futuro
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. IGNORAR requisições problemáticas (Proxy, CDNs e Streams)
  // Deixe o navegador cuidar delas nativamente para não quebrar o CORS e o HLS
  if (
    url.hostname.includes('proxy.silvatech.dev.br') || 
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.mp4') ||
    event.request.headers.get('range') // Essencial: ignora pedaços de vídeo
  ) {
    return; // Cai fora e não faz nada, o navegador assume.
  }

  // 2. Estratégia Network First para os arquivos do site (HTML, CSS, JS)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a rede funcionou, clona a resposta e guarda no cache para uso offline
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Se a rede falhar, tenta buscar no cache
        return caches.match(event.request);
      })
  );
});