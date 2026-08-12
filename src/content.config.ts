import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Diese Collections werden über das CMS unter /admin gepflegt (siehe public/admin/config.yml).
// Jede Collection entspricht dort einem "collection"-Eintrag mit passendem "folder".

const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/news" }),
  schema: z.object({
    title: z.string(),
    datum: z.date(),
    teaser: z.string(),
    bild: z.string().optional(),
    veroeffentlicht: z.boolean().default(true),
  }),
});

const termine = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/termine" }),
  schema: z.object({
    titel: z.string(),
    datum: z.date(),
    uhrzeit: z.string().optional(),
    ort: z.string(),
    kategorie: z.enum(["training", "liga", "turnier", "vereinsleben"]),
    beschreibung: z.string().optional(),
  }),
});

const ergebnisse = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/ergebnisse" }),
  schema: z.object({
    spieltag: z.string(),
    datum: z.date(),
    heim: z.string(),
    gast: z.string(),
    ergebnis: z.string(),
    liga: z.string(),
  }),
});

const sponsoren = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/sponsoren" }),
  schema: z.object({
    name: z.string(),
    logo: z.string(),
    url: z.string().url().optional(),
    stufe: z.enum(["premium", "standard"]).default("standard"),
  }),
});

const mannschaften = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/mannschaften" }),
  schema: z.object({
    name: z.string(),
    liga: z.string(),
    kapitaen: z.string().optional(),
    trainingszeit: z.string().optional(),
    reihenfolge: z.number().default(0),
  }),
});

export const collections = { news, termine, ergebnisse, sponsoren, mannschaften };
