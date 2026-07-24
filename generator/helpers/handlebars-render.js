/* Render minimalista de templates `.tpl` — sem dependência externa.
 *
 * Substitui `{{token}}` por valores de um mapa plano de variáveis. Um token
 * TODO em maiúsculas (`{{MODULE}}`) resolve o valor da chave minúscula e o
 * eleva para uppercase — útil para namespaces de env var (`HELLO_{{MODULE}}_X`).
 * Tokens desconhecidos são preservados intactos (não somem silenciosamente).
 *
 * É deliberadamente simples: sem helpers, sem loops. Se o seu pack precisar de
 * Handlebars completo (partials, `{{#each}}`), troque este helper por `node-plop`
 * + `handlebars` (é o que o pack `nep` usa) e leia os templates via Plop.
 */

const TOKEN_PATTERN = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

export function renderTemplate(content, vars) {
  return content.replace(TOKEN_PATTERN, (match, token) => {
    if (Object.hasOwn(vars, token)) return String(vars[token]);
    const lower = token.toLowerCase();
    if (token === token.toUpperCase() && Object.hasOwn(vars, lower)) {
      return String(vars[lower]).toUpperCase();
    }
    return match;
  });
}

/* Converte chaves kebab-case do manifest (`greeting-text`) para snake_case
   (`greeting_text`), que é a convenção usada nos placeholders de template. As
   chaves do manifest são o contrato; os templates usam snake_case. */
export function snakeCaseKeys(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key.replace(/-/g, '_'), value]),
  );
}

export function parseJson(raw, fallback) {
  if (raw === undefined || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
