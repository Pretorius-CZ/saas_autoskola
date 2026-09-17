/**
 * Stav formuláře žáka. Používá ho přijetí i úprava, proto je tady
 * a ne u jedné z těch dvou obrazovek.
 */
export type StavFormulare = {
  chyba?: string;
  /** Které pole zvýraznit a kam skočit. */
  pole?: string;
  /** Co uživatel napsal — aby při chybě nemusel nic psát znovu. */
  hodnoty?: Record<string, string>;
  hotovo?: boolean;
};

export type HodnotyZaka = Record<string, string>;
