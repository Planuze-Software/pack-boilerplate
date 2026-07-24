# greeter (módulo {{module}})

Serviço de saudação gerado por `@acme/pack-hello-service`.

## Env vars

```
HELLO_{{MODULE}}_SIGNATURE=   # opcional — assinatura anexada a cada saudação
```

## Uso

```ts
import { greet } from './greet.js';

const r = greet({ name: 'Ana' });
// r.value.message === "{{greeting_text}}, Ana!"
```

> `greet()` é código morto até você chamá-lo em algum call-site (rota, evento,
> job). O agente "Hello Service" deste pack detecta isso e fia a chamada.
