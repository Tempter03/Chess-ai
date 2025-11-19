declare module 'stockfish.wasm' {
  export type StockfishInstance = {
    postMessage(message: string): void;
    addMessageListener(listener: (line: string) => void): void;
    removeMessageListener(listener: (line: string) => void): void;
    terminate(): void;
  };

  export type StockfishModuleOptions = {
    locateFile?: (path: string) => string;
    wasmBinary?: ArrayBuffer;
    [key: string]: unknown;
  };

  export default function Stockfish(options?: StockfishModuleOptions): Promise<StockfishInstance>;
}


