// Edge Function : rapid-worker (déployée sous ce slug)
// 3 modes :
//   - défaut   : lit la photo d'un BON DE LIVRAISON de farine bio → lignes reçues
//   - recette  : lit du TEXTE de recette(s) de boulangerie → recettes structurées
//   - planning : lit la photo d'une FEUILLE DE PLANNING hebdo → valeurs par produit × jour
// Clé Anthropic lue depuis le secret ANTHROPIC_API_KEY — jamais exposée au front.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = "claude-sonnet-4-6";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Clé API manquante côté serveur (secret ANTHROPIC_API_KEY)" }, 500);
    const body = await req.json();
    if (body.mode === "recette") return await parseRecette(body, apiKey);
    if (body.mode === "planning") return await parsePlanning(body, apiKey);
    return await parseBon(body, apiKey);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

async function callClaude(apiKey: string, content: any[], tool: any) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 3000, tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content }],
    }),
  });
  const data = await r.json();
  if (!r.ok) return { error: data?.error?.message || "Erreur API Claude" };
  const t = (data.content || []).find((c: any) => c.type === "tool_use");
  return t ? { input: t.input } : { error: "Lecture impossible (pas de résultat structuré)" };
}

async function parseBon(body: any, apiKey: string) {
  const { image, mimeType, matieres } = body;
  if (!image) return json({ error: "Aucune image reçue" }, 400);
  const catalogue = (matieres || [])
    .map((m: any) => `- id="${m.id}" · nom="${m.nom}"${m.code ? ` · code fournisseur="${m.code}"` : ""}`)
    .join("\n");
  const prompt = `Tu lis un BON DE LIVRAISON de farine bio pour une boulangerie.
Extrait CHAQUE ligne de produit reçu. Pour chaque ligne, donne :
- ingredient_id : choisis l'id qui correspond le mieux dans le catalogue ci-dessous (nom et/ou code fournisseur). Si AUCUN ne correspond, mets null.
- nom_detecte : le libellé exact lu sur le bon
- quantite_kg : la quantité reçue convertie en KILOS (un sac compte pour son poids ; ex "10 sacs de 25 kg" = 250). Nombre uniquement.
- numero_lot : le n° de lot si présent, sinon null
- numero_bon : le n° du bon (souvent en haut), sinon null
- date_livraison : la date AAAA-MM-JJ, sinon null
- confidence : "haute", "moyenne" ou "basse"
Donne aussi fournisseur (nom) et date_livraison globale. N'invente JAMAIS : en cas de doute, null + confidence "basse".
Ignore les lignes qui ne sont pas de la matière première (transport, palettes, totaux…).
CATALOGUE des farines connues :
${catalogue || "(vide — ingredient_id à null partout)"}`;
  const tool = {
    name: "enregistrer_bon",
    description: "Renvoie les lignes extraites du bon de livraison",
    input_schema: {
      type: "object",
      properties: {
        fournisseur: { type: ["string", "null"] },
        date_livraison: { type: ["string", "null"] },
        lignes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ingredient_id: { type: ["string", "null"] }, nom_detecte: { type: ["string", "null"] },
              quantite_kg: { type: ["number", "null"] }, numero_lot: { type: ["string", "null"] },
              numero_bon: { type: ["string", "null"] }, date_livraison: { type: ["string", "null"] },
              confidence: { type: "string" },
            }, required: ["nom_detecte", "quantite_kg"],
          },
        },
      }, required: ["lignes"],
    },
  };
  const res = await callClaude(apiKey, [
    { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: image } },
    { type: "text", text: prompt },
  ], tool);
  return res.error ? json({ error: res.error }, 502) : json(res.input, 200);
}

async function parseRecette(body: any, apiKey: string) {
  const { text, ingredients, produits } = body;
  if (!text) return json({ error: "Aucun texte reçu" }, 400);
  const ingCat = (ingredients || []).map((m: any) => `- id="${m.id}" · nom="${m.nom}"`).join("\n");
  const prodCat = (produits || []).map((m: any) => `- id="${m.id}" · nom="${m.nom}"`).join("\n");
  const prompt = `Tu lis une ou plusieurs RECETTES de boulangerie écrites en texte libre. Extrait chaque recette de façon structurée.
Pour CHAQUE recette :
- produit_id : choisis l'id du produit correspondant dans le CATALOGUE PRODUITS ci-dessous. Si aucun ne correspond, null.
- produit_nom : le nom du produit/pain tel que lu
- rendement_base : la quantité de référence en KG DE FARINE (si "pour 10 kg de farine" → 10 ; sinon = total de farine de la recette)
- unite_base : en général "kg de farine"
- hydratation_pct : le % d'hydratation si mentionné, sinon null
- procede : le texte du procédé (pétrissage, pointage, division, apprêt, cuisson…), sinon null
- lignes : pour CHAQUE ingrédient → { ingredient_id (du CATALOGUE INGRÉDIENTS si correspond, sinon null), ingredient_nom (lu), quantite (en KG : convertis g→kg ; pour l'eau/liquides 1 L ≈ 1 kg) }
Convertis TOUTES les quantités en kg. N'invente jamais une valeur.

CATALOGUE PRODUITS :
${prodCat || "(vide)"}

CATALOGUE INGRÉDIENTS :
${ingCat || "(vide)"}`;
  const tool = {
    name: "enregistrer_recettes",
    description: "Renvoie les recettes extraites du texte",
    input_schema: {
      type: "object",
      properties: {
        recettes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              produit_id: { type: ["string", "null"] }, produit_nom: { type: ["string", "null"] },
              rendement_base: { type: ["number", "null"] }, unite_base: { type: ["string", "null"] },
              hydratation_pct: { type: ["number", "null"] }, procede: { type: ["string", "null"] },
              lignes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    ingredient_id: { type: ["string", "null"] }, ingredient_nom: { type: ["string", "null"] },
                    quantite: { type: ["number", "null"] },
                  }, required: ["ingredient_nom", "quantite"],
                },
              },
            }, required: ["produit_nom", "lignes"],
          },
        },
      }, required: ["recettes"],
    },
  };
  const res = await callClaude(apiKey, [{ type: "text", text: prompt + "\n\nTEXTE À LIRE :\n" + text }], tool);
  return res.error ? json({ error: res.error }, 502) : json(res.input, 200);
}

async function parsePlanning(body: any, apiKey: string) {
  const { image, mimeType, lignes } = body;
  if (!image) return json({ error: "Aucune image reçue" }, 400);
  const catalogue = (lignes || [])
    .map((l: any) => `- id="${l.id}" · nom="${l.nom}"${l.unite ? ` · unité=${l.unite}` : ""}`)
    .join("\n");
  const prompt = `Tu lis une FEUILLE DE PLANNING HEBDOMADAIRE de production d'une boulangerie.
C'est une GRILLE : chaque LIGNE = un produit/pain ; chaque COLONNE = un jour de la semaine (souvent de Mardi à Dimanche, parfois Lundi inclus).

Pour CHAQUE ligne de produit, donne :
- ligne_id : choisis l'id qui correspond le mieux dans le CATALOGUE ci-dessous (par le nom). Si AUCUN ne correspond, mets null.
- nom_detecte : le libellé EXACT lu à gauche de la ligne.
- valeurs : un tableau d'objets { jour, valeur } pour CHAQUE jour qui a un contenu.
    * jour ∈ "lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"
    * valeur = le CONTENU EXACT de la case, recopié TEL QUEL en texte (ex : "75+75+50", "3+8", "1+2fredeville", "15 pièces", "12,5").

RÈGLES IMPORTANTES :
- RECOPIE le texte des cases. NE CALCULE PAS, NE CONVERTIS PAS, n'additionne pas.
- Une case VIDE ou BARRÉE (rature, gribouillage) → ne la mets pas dans valeurs (ignore-la).
- IGNORE les lignes de titre/section ("PAINS", "Pains bio"…) et les lignes de TOTAL ("total bacs de mélanges"…).
- N'invente jamais une ligne ou une valeur.

CATALOGUE des produits du planning (pour le matching) :
${catalogue || "(vide — ligne_id à null partout)"}`;
  const tool = {
    name: "enregistrer_planning",
    description: "Renvoie les lignes du planning hebdo avec les valeurs par jour",
    input_schema: {
      type: "object",
      properties: {
        semaine: { type: ["string", "null"] },
        lignes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ligne_id: { type: ["string", "null"] },
              nom_detecte: { type: ["string", "null"] },
              valeurs: {
                type: "array",
                items: {
                  type: "object",
                  properties: { jour: { type: "string" }, valeur: { type: "string" } },
                  required: ["jour", "valeur"],
                },
              },
            }, required: ["nom_detecte", "valeurs"],
          },
        },
      }, required: ["lignes"],
    },
  };
  const res = await callClaude(apiKey, [
    { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: image } },
    { type: "text", text: prompt },
  ], tool);
  return res.error ? json({ error: res.error }, 502) : json(res.input, 200);
}

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
