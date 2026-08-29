/* Hello service — gerado automaticamente pelo Planuze (@acme/pack-hello-service).
 * Módulo alvo: {{module}}
 *
 * Env vars esperadas:
 *   HELLO_{{MODULE}}_SIGNATURE   — assinatura opcional anexada a cada saudação.
 *
 * Erros esperados retornam `Result<T, GreetError>` (neverthrow); o caminho
 * feliz NUNCA lança.
 *
 * Uso:
 *   const r = greet({ name: 'Ana' });
 *   if (r.isErr()) return reply.status(400).send({ error: r.error.kind });
 *   console.log(r.value.message);
 */
import { z } from 'zod';
import { err, ok, type Result } from 'neverthrow';

const GREETING = '{{greeting_text}}';
const SIGNATURE = process.env['HELLO_{{MODULE}}_SIGNATURE'] ?? '';

export const greetInputSchema = z.object({
  name: z.string().min(1).max(120),
});

export type GreetInput = z.input<typeof greetInputSchema>;

export type GreetError = { kind: 'invalid_input'; issues: string[] };

export function greet(input: GreetInput): Result<{ message: string }, GreetError> {
  const parsed = greetInputSchema.safeParse(input);
  if (!parsed.success) {
    return err({
      kind: 'invalid_input',
      issues: parsed.error.issues.map((issue) => issue.message),
    });
  }
  const base = `${GREETING}, ${parsed.data.name}!`;
  const message = SIGNATURE.length > 0 ? `${base}\n${SIGNATURE}` : base;
  return ok({ message });
}
