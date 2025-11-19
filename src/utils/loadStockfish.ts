import type { StockfishFactory } from '../stockfish-wasm';

let loaderPromise: Promise<StockfishFactory> | null = null;

function injectStockfishScript(scriptUrl: string) {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('Stockfish недоступен на сервере.'));
  }

  const existing = document.querySelector<HTMLScriptElement>('script[data-stockfish]');
  if (existing) {
    return existing.dataset.loaded === 'true'
      ? Promise.resolve()
      : new Promise<void>((resolve, reject) => {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('Не удалось загрузить stockfish.js')), {
            once: true,
          });
        });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.dataset.stockfish = 'true';
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    });
    script.addEventListener('error', () => reject(new Error('Не удалось загрузить stockfish.js')));
    document.head.append(script);
  });
}

export function loadStockfishFactory(): Promise<StockfishFactory> {
  if (loaderPromise) {
    return loaderPromise;
  }

  loaderPromise = (async () => {
    const scriptUrl = `${import.meta.env.BASE_URL}stockfish/stockfish.js`;
    await injectStockfishScript(scriptUrl);

    if (!window.Stockfish) {
      throw new Error('Глобальный Stockfish не найден после загрузки скрипта.');
    }

    return window.Stockfish;
  })();

  return loaderPromise;
}

