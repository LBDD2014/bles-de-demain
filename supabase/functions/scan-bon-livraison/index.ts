// Edge Function : scan-bon-livraison
// Lit la photo d'un bon de livraison de FARINE BIO et en extrait chaque ligne reçue.
// La clé Anthropic est lue depuis le secret ANTHROPIC_API_KEY — jamais exposée au front.
// Déploiement : dashboard Supabase → Edge Functions → Create a new function → coller ce code → Deploy.

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

    const { image, mimeType, matieres } = await req.json();
    if (!image) return json({ error: "Aucune image reçue" }, 400);

    const catalogue = (matieres || [])
      .map((m: any) => `- id="${m.id}" · nom="${m.nom}"${m.code ? ` · code fournisseur="${m.code}"` : ""}`)
      .join("\n");

    const prompt = `Tu lis un BON DE LIVRAISON de farine bio pour une boulangerie.
Extrait CHAQUE ligne de produit reçu. Pour chaque ligne, donne :
- ingredient_id : choisis l'id qui correspond le mieux dans le catalogue ci-dessous (matche sur le nom et/ou le code fournisseur). Si AUCUN ne correspond, mets null.
- nom_detecte : le libellé exact lu sur le bon
- quantite_kg : la quantité reçue convertie en KILOS (un sac compte pour son poids ; ex "10 sacs de 25 kg" = 250). Nombre uniquement.
- numero_lot : le n° de lot si présent, sinon null
- numero_bon : le n° du bon de livraison (souvent en haut du document), sinon null
- date_livraison : la date au format AAAA-MM-JJ, sinon null
- confidence : "haute", "moyenne" ou "basse" selon ta certitude de lecture

Donne aussi le fournisseur global (nom) et la date globale du bon.
N'invente JAMAIS une valeur : en cas de doute, mets null et confidence "basse".
Ignore les lignes qui ne sont pas de la matière première (transport, palettes, totaux…).

CATALOGUE des farines connues :
${catalogue || "(catalogue vide — mets ingredient_id à null partout)"}`;

    const body = {
      model: MODEL,
      max_tokens: 2000,
      tools: [{
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
                  ingredient_id: { type: ["string", "null"] },
                  nom_detecte: { type: ["string", "null"] },
                  quantite_kg: { type: ["number", "null"] },
                  numero_lot: { type: ["string", "null"] },
                  numero_bon: { type: ["string", "null"] },
                  date_livraison: { type: ["string", "null"] },
                  confidence: { type: "string" },
                },
                required: ["nom_detecte", "quantite_kg"],
              },
            },
          },
          required: ["lignes"],
        },
      }],
      tool_choice: { type: "tool", name: "enregistrer_bon" },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: image } },
          { type: "text", text: prompt },
        ],
      }],
    };

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message || "Erreur API Claude" }, 502);

    const tool = (data.content || []).find((c: any) => c.type === "tool_use");
    if (!tool) return json({ error: "Lecture impossible (pas de résultat structuré)" }, 502);
    return json(tool.input, 200);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
