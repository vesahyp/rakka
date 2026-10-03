/// <reference types="vite/client" />
declare const __BUILD__: string;

interface ImportMetaEnv {
  readonly VITE_RECORDS_API?: string;
  readonly VITE_BOARD_URL?: string;
  readonly VITE_STATS_URL?: string;
  readonly VITE_PIXEL_URL?: string;
}
