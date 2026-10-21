# Registro de validação — Nexo

Validação executada em 21 de outubro de 2026.

## Verificações de código e banco

- TypeScript em modo estrito.
- ESLint com regras de Next.js, React Hooks e TypeScript.
- Compilação de produção Next.js.
- Testes de lógica: profundidade da árvore, prevenção de ciclos na troca de pai, ocultação de descendentes, busca sem acentos, busca em materiais, sugestões explicadas, relações invertidas, exclusão e validação de protocolos de links.
- Testes SQL com PGlite (PostgreSQL em WebAssembly), executando a migração real do projeto, sem substituir o resultado das consultas por objetos pré-programados.
- SQL sob dois usuários distintos: isolamento de leitura/escrita, acesso anônimo negado, mudança de proprietário negada, persistência de materiais e posições, ciclos rejeitados com rollback, relações duplicadas rejeitadas, referências entre mapas rejeitadas e conflitos de revisão bloqueados.
- Teste de posicionamento inicial para evitar sobreposição de novos cartões.

O schema `auth` dos testes SQL contém apenas o mínimo necessário para fornecer `auth.uid()`. **Esses testes não validam o serviço Supabase Auth, seus e-mails ou configurações de produção.**

## Fluxos verificados no navegador

Foi usada uma fixture local descartável, fora do código da aplicação, com uma API de teste para autenticação e acesso ao PGlite. O salvamento e a leitura nessa API executaram as mesmas funções SQL da migração, com RLS. A fixture não integra o pacote de produção e não foi enviada ao GitHub.

Verificado pela interface:

- Tela de preparação sem credenciais e tela de entrada.
- Criação de mapa e de matérias/subtópicos, tanto pelo canvas quanto pelo painel.
- Edição de título, descrição, status, ícone, tag, anotação e link.
- Prévia Markdown com negrito e lista.
- Aprovação de sugestão por tag compartilhada entre dois ramos.
- Busca pelo corpo de uma anotação dentro de um grupo recolhido e abertura do seu contexto.
- Posição por formulário e por arraste, sem alterar o pai.
- Recarregamento após “Tudo salvo”, mantendo mapa, materiais, relações e posição.
- Lista, navegação, edição e biblioteca em viewport interno de 390 × 844 pixels.
- Tema claro e escuro.

Durante o teste foi corrigida uma realimentação na seleção do canvas ao criar subtópicos e foi limitado o enquadramento inicial. A versão enviada contém essas correções. Os dados de estudo usados nesses testes foram criados pelas ações da interface, exclusivamente no banco descartável.

## Verificações externas pendentes

Conforme a escolha de preparar um projeto Supabase separado, não foram criados recursos externos nem alterado o projeto existente de outro sistema. Ainda precisam ser executados após a configuração:

1. Cadastro e confirmação de e-mail no Supabase real.
2. Entrada, renovação de sessão, saída e recuperação de senha no serviço real.
3. Teste `pnpm test:database` com duas contas confirmadas no projeto de homologação.
4. Roteiro de aceitação completo do README na implantação Vercel.
5. Envio de e-mails e URLs de redirecionamento de produção.
6. Simulação de perda e retorno de rede no ambiente configurado e conflito real entre duas janelas.

O tratamento de falhas e o bloqueio de conflitos estão implementados; os cenários SQL de rollback e revisão foram exercitados localmente. Isso não equivale a uma validação de rede ou de autenticação de produção.
