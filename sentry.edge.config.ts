// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://ee08fbe5d3a1ecf6967b3d396836cfb1@o4512096821444608.ingest.de.sentry.io/4512096829767760",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // ZAMERNE VYPNUTO. Sentry ve vychozim stavu posila k chybe i udaje o uzivateli
  // a obsah odeslanych formularu. U nas by to znamenalo posilat rodna cisla,
  // cisla dokladu totoznosti a adresy zaku na cizi servery. Nikdy to nezapinej;
  // ke zjisteni, co se pokazilo, staci chybova hlaska a misto v kodu.
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
});
