/* =========================================================
   8º PERÍODO — SERVICE WORKER
   ONLINE  → servidor / versão atual
   OFFLINE → última versão disponível em cache
   ========================================================= */

const CACHE_VERSION = "tb8-v1-2026-08-21";
const CACHE_NAME = `calendario-${CACHE_VERSION}`;


/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const files = [
        "./",
        "./index.html",
        "./manifest.webmanifest",
        "./favicon.svg"
      ];

      await Promise.allSettled(
        files.map(async (url) => {
          try {
            const response = await fetch(url, {
              cache: "no-store"
            });

            if (response.ok) {
              await cache.put(url, response.clone());
            }
          } catch (_) {}
        })
      );
    })
  );
});


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /*
   * Não interfere em Google Fonts ou outros
   * recursos externos.
   */
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirstNavigation(request)
    );

    return;
  }

  event.respondWith(
    networkFirstAsset(request)
  );
});


/* =========================================================
   NETWORK FIRST — HTML
   ========================================================= */

async function networkFirstNavigation(request) {
  try {
    /*
     * Havendo internet, tenta sempre o servidor.
     * Não utiliza o HTTP cache como fonte primária.
     */
    const response = await fetch(request, {
      cache: "no-store"
    });

    if (!response || !response.ok) {
      throw new Error("network");
    }

    const cache = await caches.open(CACHE_NAME);

    /*
     * Guarda a resposta atual para funcionamento offline.
     */
    await cache.put(
      request,
      response.clone()
    );

    /*
     * Mantém também uma cópia do index.html.
     */
    try {
      await cache.put(
        new Request("./index.html"),
        response.clone()
      );
    } catch (_) {}

    return response;

  } catch (_) {

    /*
     * Sem internet:
     * tenta a URL exata primeiro.
     */
    const cachedPage =
      await caches.match(request);

    if (cachedPage) {
      return cachedPage;
    }

    /*
     * Depois tenta a cópia genérica do aplicativo.
     */
    const cachedIndex =
      (await caches.match("./index.html")) ||
      (await caches.match("./"));

    if (cachedIndex) {
      return cachedIndex;
    }

    /*
     * Caso o usuário nunca tenha carregado
     * o aplicativo anteriormente.
     */
    return new Response(
      `
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">

          <meta
            name="viewport"
            content="width=device-width,initial-scale=1"
          >

          <title>Sem conexão</title>
        </head>

        <body>
          <main>
            <h1>Sem conexão</h1>

            <p>
              Conecte-se à internet e tente novamente.
            </p>
          </main>
        </body>
      </html>
      `,
      {
        status: 503,
        headers: {
          "Content-Type":
            "text/html; charset=utf-8"
        }
      }
    );
  }
}


/* =========================================================
   NETWORK FIRST — ASSETS
   ========================================================= */

async function networkFirstAsset(request) {
  try {
    /*
     * Online:
     * procura a versão atual no servidor.
     */
    const response = await fetch(request, {
      cache: "no-store"
    });

    if (
      response &&
      response.ok &&
      response.status === 200
    ) {
      const cache =
        await caches.open(CACHE_NAME);

      /*
       * Atualiza a cópia offline.
       */
      await cache.put(
        request,
        response.clone()
      );
    }

    return response;

  } catch (_) {

    /*
     * Offline:
     * utiliza a última cópia disponível.
     */
    const cached =
      await caches.match(request);

    if (cached) {
      return cached;
    }

    return new Response("", {
      status: 504,
      statusText: "Offline"
    });
  }
}


/* =========================================================
   MENSAGENS
   ========================================================= */

self.addEventListener("message", (event) => {

  /*
   * Permite ativação imediata de uma versão nova.
   */
  if (
    event.data?.type === "SKIP_WAITING"
  ) {
    self.skipWaiting();
  }


  /*
   * Limpa somente Cache Storage.
   *
   * NÃO remove:
   *
   * localStorage["tb8"]
   * localStorage["tb8-theme"]
   */
  if (
    event.data?.type === "CLEAR_APP_CACHE"
  ) {
    event.waitUntil(
      (async () => {
        const names =
          await caches.keys();

        await Promise.all(
          names.map(
            (name) => caches.delete(name)
          )
        );
      })()
    );
  }
});
