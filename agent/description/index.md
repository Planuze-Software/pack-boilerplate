# Hello Service — Module-pack Agent

Este module-pack de **exemplo** adiciona um **serviço de saudação** (`greet`) ao
template NEP (Node + Express + Prisma). Serve de referência de como escrever o
agente de um pack: ele **assiste** o uso E **executa** a integração.

## greeter (default)

Gera um helper `greet({ name })` que monta uma saudação a partir de um texto
configurável (prop `greeting-text`, default `Hello`) mais uma assinatura opcional
lida da env `HELLO_{MODULE}_SIGNATURE`.

Quando o usuário pedir para adicionar uma saudação/mensagem a um projeto NEP,
considere este módulo ativo e siga o padrão observado no projeto.

O agente não só CONFIGURA como EXECUTA a integração: instalar gera
`greeter/greet.ts`, mas nada produz saudação até que `greet` seja chamado. Se
estiver como código morto, o agente fia a chamada no call-site que o usuário
indicar (uma rota, um evento pós-cadastro, um job) via `edit_file` — para não
deixar código morto.
