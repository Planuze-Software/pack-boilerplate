/* Emissão de eventos NDJSON para o GeneratorEngine do Planuze.
 *
 * O generator é um subprocesso Node puro. Ele conversa com o app escrevendo
 * UM evento JSON por linha em stdout (NDJSON). O schema é `generatorEventSchema`
 * do pack-runtime (`packages/pack-runtime/src/engine/events.ts`):
 *
 *   { type: 'step.started',   stepId }
 *   { type: 'step.log',       stepId, level, message, messageKey?, messageParams? }
 *   { type: 'step.completed', stepId, durationMs }   // durationMs é OBRIGATÓRIO
 *   { type: 'step.failed',    stepId, error }
 *   { type: 'run.finished',   ok, projectId? }
 *
 * Atenção ao contrato: use `type:` (não `kind:`). `durationMs` ausente em
 * step.completed faz o engine REJEITAR o evento e abortar o run. `timestamp`
 * é anexado automaticamente a todo evento.
 */

const write = (event) =>
  process.stdout.write(`${JSON.stringify({ ...event, timestamp: Date.now() })}\n`);

export const now = () => Date.now();

export const stepStarted = (stepId) => write({ type: 'step.started', stepId });

export const stepCompleted = (stepId, startedAt) =>
  write({ type: 'step.completed', stepId, durationMs: Date.now() - startedAt });

export const stepFailed = (stepId, error) => write({ type: 'step.failed', stepId, error });

export const runFinished = (ok, projectId) =>
  write({ type: 'run.finished', ok, ...(projectId !== undefined && { projectId }) });

/* `messageKey` deve ser uma chave i18n do pack (locales/*.json) — o app resolve
   para o idioma do usuário. `message` (raw) é o fallback quando não há tradução. */
export const stepLog = (stepId, level, messageKey, messageParams) =>
  write({
    type: 'step.log',
    stepId,
    level,
    message: messageKey,
    messageKey,
    ...(messageParams !== undefined && { messageParams }),
  });
