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

## Publicação e verificação externa — 22 de outubro de 2026

- A migração do repositório foi executada uma vez em um novo projeto Supabase, após confirmar que o schema `public` não continha tabelas.
- Confirmadas as três tabelas, RLS habilitada, privilégios para `authenticated` e ausência de leitura por `anon`.
- Teste SQL no PostgreSQL real: criação de mapa sob o papel `authenticated`, salvamento e leitura de tópico e coordenadas, bloqueio de revisão antiga e isolamento de leitura/escrita para outro usuário. Os usuários de teste não tinham credenciais de login; toda a transação foi revertida. Isso verifica banco e RLS, sem equivaler a um teste de Supabase Auth.
- API pública de autenticação respondeu HTTP 200: e-mail habilitado, cadastro permitido e confirmação de e-mail obrigatória.
- Consultas REST anônimas a `study_maps`, `topics` e `topic_relations` responderam HTTP 401.
- Security Advisor reexecutado após a instalação: zero erros, zero avisos e zero sugestões.
- Vercel: Next.js, Node.js 24.x, repositório GitHub conectado e duas variáveis públicas configuradas.
- A implantação compilou com sucesso, atingiu `READY` e foi promovida para [nexo-estudos-six.vercel.app](https://nexo-estudos-six.vercel.app).
- Página pública respondeu HTTP 200 e exibiu a tela de entrada no navegador. Cabeçalho `X-Frame-Options: DENY` presente.
- Site URL e Redirect URL do Supabase configurados para `https://nexo-estudos-six.vercel.app`.
- SMTP personalizado do Brevo habilitado, com o nome de remetente Nexo Estudos. Após o responsável inserir e salvar a credencial, o painel confirmou a senha armazenada e oculta. Credenciais e dados da conta não integram este repositório. Esse estado confirma a configuração salva, sem atestar entrega de e-mail.
- `.vercelignore` exclui arquivos temporários, credenciais locais e dependências da publicação. A lista de envio foi conferida antes da implantação.
- Consulta de logs da implantação na janela dos últimos cinco minutos após os acessos de verificação: nenhum registro de nível `error`.

## Verificações externas pendentes

Ainda precisam ser executados com contas reais de teste e acesso aos respectivos e-mails:

1. Cadastro e confirmação de e-mail no Supabase real.
2. Entrada, renovação de sessão, saída e recuperação de senha no serviço real.
3. Teste `pnpm test:database` com duas contas confirmadas no projeto de homologação.
4. Roteiro de aceitação completo do README na implantação Vercel.
5. Entrega dos e-mails de confirmação e recuperação, incluindo abertura dos links de produção.
6. Simulação de perda e retorno de rede no ambiente configurado e conflito real entre duas janelas.

O tratamento de falhas e o bloqueio de conflitos estão implementados; os cenários SQL de rollback e revisão foram exercitados localmente. Isso não equivale a uma validação de rede ou de autenticação de produção.
