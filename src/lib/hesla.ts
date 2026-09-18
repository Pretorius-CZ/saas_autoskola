/**
 * Pravidla pro hesla — na jednom místě.
 *
 * Nejmenší délku potřebuje znát přihlašování (Better Auth), formulář
 * pozvánky i hláška, kterou uživatel uvidí. Kdyby to bylo napsané
 * třikrát, jednou se to rozejde a člověk dostane "heslo je krátké"
 * u hesla, které podle nápovědy stačí.
 *
 * Tenhle soubor NENÍ "use server". Takový soubor smí vyvážet jen
 * asynchronní funkce, takže konstanty do něj nepatří — což je chyba,
 * do které jsem tady spadl už potřetí.
 */
export const NEJMENE_ZNAKU = 10;
