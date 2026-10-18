// Types du paquet wawoff2 (décodeur WOFF2 de Google compilé en WebAssembly), qui n'en publie pas.
declare module 'wawoff2' {
  /** WOFF2 → TTF ou OTF d'origine. */
  export function decompress(woff2: Uint8Array): Promise<Uint8Array>;
  /** TTF ou OTF → WOFF2. */
  export function compress(sfnt: Uint8Array): Promise<Uint8Array>;
}
