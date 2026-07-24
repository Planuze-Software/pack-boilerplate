# Regras — Hello Service

- Responda em português brasileiro.
- Não modifique arquivos fora do projeto alvo.
- O texto base da saudação vem da prop `greeting-text` (default `Hello`); a
  assinatura opcional vem da env `HELLO_{MODULE}_SIGNATURE` (`{MODULE}` = nome do
  módulo em maiúsculas) — nunca hardcode.
- Antes de mudar, leia os arquivos do projeto (`read_file`/`grep`) e siga o
  padrão observado.

## Não deixe código morto

- Configurar o pack é só metade do trabalho. Instalar gera
  `<módulo>/greeter/greet.ts`, mas **nada produz uma saudação até que `greet` seja
  de fato chamado**. Se ninguém chama, é código morto — e você deve resolver isso.
- Sempre verifique o estado do wiring com `describe_project`/`grep`:
  - **Consumido**: se `greet` já é importado e chamado numa rota/serviço/evento,
    confirme e não duplique.
  - **Código morto**: se `greet` não é consumido em lugar nenhum, fie a chamada
    no call-site apropriado via `edit_file`.
- Este pack **não** tem rotas HTTP próprias e **não** é auto-fiado por nenhum step
  do NEP — não existe caminho automático. A chamada é sempre manual.
- Escolha do call-site com o usuário (uma rota que retorna a saudação, um evento
  pós-cadastro, um job). Se for ambíguo, **pergunte qual rota/evento** deve usar a
  saudação antes de fiar.
- Contrato: `greet(input)` retorna `Result<{ message }, GreetError>` (neverthrow).
  Trate por `.isErr()`/`.error.kind`, não relance.
- Ao concluir, aponte explicitamente onde `greet` passou a ser chamado e confirme
  que não restou código morto.
