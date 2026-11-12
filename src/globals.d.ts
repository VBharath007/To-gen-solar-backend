import type { DesktopBridge } from '@shared/types/desktop-bridge.types';

declare global {
  interface Window {
    desktop: DesktopBridge;
  }
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module 'better-sqlite3' {
  const content: any;
  export default content;
  export type Database = any;
}

declare module 'clsx' {
  export const clsx: any;
  export default clsx;
}

declare module 'tailwind-merge' {
  export const twMerge: any;
  export default twMerge;
}
