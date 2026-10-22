# Nexo — seu universo de estudos

Hub pessoal de estudos em português do Brasil. Next.js App Router, React, TypeScript, React Flow, Supabase Auth/PostgreSQL e implantação na Vercel.

## Publicação

- Site: [nexo-estudos-six.vercel.app](https://nexo-estudos-six.vercel.app).
- Vercel conectada a este repositório, com Next.js configurado.
- Supabase configurado em um projeto separado para a aplicação.
- Banco instalado em 22 de outubro de 2026, com RLS e as funções de salvamento e leitura. Site URL e retorno de autenticação configurados para o endereço de produção.
- SMTP personalizado do Brevo habilitado no Supabase para confirmação e recuperação de acesso. A entrega de mensagens ainda precisa ser verificada com uma conta real.

A publicação usa apenas a URL e a chave publicável do Supabase. Chaves administrativas não integram o site ou este repositório. Consulte [VALIDACAO.md](VALIDACAO.md) para os testes realizados e os fluxos de e-mail ainda pendentes de verificação.

## O que está implementado

- Cadastro, entrada, saída e recuperação de senha por e-mail com Supabase Auth.
- Vários mapas independentes por usuário.
- Matérias e subtópicos com profundidade livre, árvore lateral, caminho e alteração explícita de pai.
- Canvas com arraste, zoom, movimentação, enquadramento, minimapa e expansão/recolhimento de ramos.
- Tópicos com título, descrição, cor, ícone, tags e status de estudo.
- Várias anotações por tópico, com edição Markdown e prévia de negrito, itálico, listas, títulos e links.
- Vários links por tópico, editáveis e removíveis, e biblioteca unificada de materiais.
- Relações conceituais manuais independentes da hierarquia. Contínuo = hierarquia; tracejado = relação.
- Sugestões por tags e palavras compartilhadas nos títulos, com motivo e aprovação individual. Nenhum serviço de IA é necessário.
- Busca em títulos, descrições, anotações, tags e títulos de links; filtros por matéria, tag e status.
- Resultados que abrem o contexto do tópico, expandem seus ancestrais e o localizam no mapa.
- Visualização em lista, navegação adaptada ao celular e edição de posição por formulário.
- Temas claro e escuro, estados vazios, carregamento, erros, confirmação de exclusão e exportação JSON do rascunho.
- Salvamento automático transacional, revisão otimista para conflitos entre janelas e botão de nova tentativa.
- Posições salvas ao terminar o arraste; conteúdo salvo após 750 ms sem alterações.
- RLS em todas as tabelas, validação de ciclos no banco e restrições para impedir relações duplicadas e referências entre mapas.

**Sem configuração, a aplicação mostra uma tela de preparação. Não existe modo demonstrativo, conta pronta, dados fictícios ou substituição do Supabase por armazenamento local na aplicação.**

## Executar localmente

Requisitos: Node.js 22 ou superior e pnpm 10.28.2. Caso ainda não tenha pnpm, instale com `npm install --global pnpm@10.28.2`.

```powershell
git clone https://github.com/gusstavovp/nexo-estudos.git
cd nexo-estudos
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
```

Preencha **somente** estas duas configurações no `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Use a URL do projeto e sua **publishable key**, disponíveis no painel do Supabase. Não use secret key, senha do banco ou chave `service_role` no navegador. O exemplo não contém valores secretos.

```powershell
pnpm dev
```

Abra [http://127.0.0.1:3000](http://127.0.0.1:3000). Reinicie o servidor sempre que alterar as variáveis de ambiente. Se a porta estiver ocupada, use o endereço impresso pelo Next.js.

Para testar o pacote de produção:

```powershell
pnpm build
pnpm start
```

## Configurar o Supabase

1. Para outra instalação, crie um **novo projeto separado** para o Nexo, na organização e região que preferir. O projeto de produção indicado acima já está configurado; não reaplique a migração nele.
2. No **SQL Editor**, execute integralmente [`supabase/migrations/202610210001_nexo.sql`](supabase/migrations/202610210001_nexo.sql). A migração foi feita para um banco novo; execute uma vez. Ela cria tabelas, índices, políticas e funções dentro de uma transação.
3. Confirme que o **Data API** está habilitado e expõe o schema `public`. A migração já concede os privilégios necessários a `authenticated`; o papel `anon` não recebe acesso aos dados.
4. Em **Authentication → Sign In / Providers**, habilite **Email** e o cadastro de novos usuários. A aplicação usa e-mail e senha; não exige provedores sociais.
5. Mantenha a confirmação de e-mail habilitada. Em **URL Configuration**, use a URL pública de produção como **Site URL** quando publicar. Durante o desenvolvimento, adicione `http://127.0.0.1:3000` e, se usar, `http://localhost:3000` à lista de **Redirect URLs**. Inclua a porta real se ela mudar.
6. Adicione também a URL de produção e as URLs exatas das prévias que for testar aos redirecionamentos permitidos.
7. Configure o remetente/SMTP para envio de confirmação e recuperação em produção. O serviço de e-mail padrão do Supabase tem restrições; confira a configuração do seu projeto.
8. Copie a URL e a publishable key para `.env.local`, reinicie a aplicação e crie sua conta pela interface. Confirme seu e-mail e entre.

É possível aplicar a mesma migração com a CLI do Supabase em um projeto vinculado, em vez de usar o SQL Editor. Não execute ambos sobre o mesmo banco sem registrar o histórico de migrações.

### Modelo e segurança

| Recurso                                  | Armazenamento                                                  |
| ---------------------------------------- | -------------------------------------------------------------- |
| Usuários e sessões                       | `auth.users` / Supabase Auth                                   |
| Mapas, proprietário, revisão, viewport   | `public.study_maps`                                            |
| Hierarquia, posições, status e aparência | `public.topics`                                                |
| Tags                                     | `topics.tags`, array de texto                                  |
| Múltiplas anotações e links              | `topics.notes` e `topics.links`, arrays JSONB com IDs próprios |
| Relações conceituais                     | `public.topic_relations`                                       |

O cliente usa o JWT do usuário. Todas as consultas passam pelas políticas RLS. As funções `save_study_map` e `load_study_map` são **security invoker**, sem elevar privilégios. O usuário não pode reassociar um mapa a outro proprietário.

A chave estrangeira composta exige que o pai e as pontas de uma relação pertençam ao mesmo mapa. Um gatilho diferido verifica ciclos, e as duas pontas das relações são ordenadas para impedir duplicatas invertidas. Índices cobrem proprietários e referências. Excluir um tópico remove seus descendentes, seus materiais e suas relações; a interface informa esse impacto antes da confirmação.

Todo o conteúdo de um mapa é salvo numa única transação. Se o banco rejeitar qualquer parte, a transação inteira é revertida. A leitura também usa um único snapshot. A revisão evita sobrescrever uma versão mais nova de outra janela. Edições são mantidas na memória em caso de erro, com opção de tentar novamente e exportar o rascunho. **Aguarde “Tudo salvo” antes de fechar ou recarregar.**

O tema é a única preferência do produto armazenada localmente, com chave versionada. A sessão é mantida pelo SDK oficial do Supabase. Conteúdo de estudo é sempre persistido no banco.

## Publicar na Vercel

1. Para outra instalação, importe o repositório `gusstavovp/nexo-estudos` em um **novo projeto** da sua conta Vercel. A publicação indicada acima já está vinculada ao GitHub.
2. Mantenha o preset **Next.js**, diretório raiz do repositório e Node.js **22.x ou superior**. O `vercel.json` já declara o framework.
3. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` nos ambientes desejados **antes** da compilação. Use um projeto Supabase de homologação para prévias quando possível.
4. Publique e adicione a URL resultante ao **Site URL / Redirect URLs** do Supabase, conforme a seção anterior.
5. Teste cadastro, confirmação de e-mail, entrada, recuperação de senha, criação e recarregamento de um mapa na URL publicada.

Alterar variáveis públicas exige uma nova implantação, pois Next.js as inclui no pacote do navegador durante o build. Não cadastre variáveis `TEST_USER_*` na implantação do produto.

Para implantação pela CLI, já autenticado na conta e no projeto correto:

```powershell
pnpm dlx vercel link
pnpm dlx vercel env pull .env.local
pnpm dlx vercel
```

O último comando cria uma prévia. Configure e valide o Supabase antes de publicar em produção pela plataforma. Não é necessário Sites, servidor próprio ou chave administrativa.

## Verificações

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm test` executa testes de lógica e testes de PostgreSQL com **PGlite**, aplicando a mesma migração. Eles exercitam as políticas sob papéis distintos, restrições, persistência, leitura atômica, conflitos e reversão de transações. O schema de Auth dos testes é mínimo e não substitui uma validação do serviço Supabase Auth.

### Integração opcional com o Supabase real

Crie **duas contas de teste com e-mail confirmado** no projeto de homologação. Preencha as quatro variáveis `TEST_USER_*` do `.env.local`, além das duas configurações públicas, e execute:

```powershell
pnpm test:database
```

O teste entra com as duas contas, cria um mapa descartável, salva/lê o conteúdo, verifica isolamento, rejeição de ciclo e conflito de revisão e tenta remover o mapa ao finalizar. Use exclusivamente contas e ambiente de teste. Nenhuma credencial privilegiada é necessária.

### Roteiro de aceitação na interface

1. Cadastre duas contas separadas e confirme os e-mails.
2. Na primeira, crie um mapa, uma matéria e subtópicos em três níveis.
3. Arraste um cartão; confirme que o pai não mudou. Recarregue após “Tudo salvo” e confira sua posição.
4. Adicione duas anotações, duas tags e dois links; edite e remova um material. Confira a formatação na prévia.
5. Crie outra matéria e relacione assuntos de ramos diferentes, pelo painel e pelos pontos do canvas. Remova a relação pelo painel.
6. Use uma tag comum nos dois ramos, abra “Descobrir conexões”, confira o motivo e aprove uma sugestão.
7. Recolha um grupo e busque uma anotação de um descendente; selecione o resultado e confira o caminho e a localização no mapa.
8. Teste filtros e as visualizações Lista e Meus materiais. No celular, use o menu, a lista e os formulários de edição e posição.
9. Em outra janela, edite o mesmo mapa e verifique a mensagem de conflito. Exporte o rascunho antes de recarregar.
10. Sem conexão, edite e confira que não aparece “Tudo salvo”; reconecte e tente novamente.
11. Entre na segunda conta: mapas e tópicos da primeira devem estar ausentes.
12. Exclua uma matéria com descendentes, confira o aviso de impacto e confirme apenas em um mapa descartável.

## Estrutura

```text
src/app/                 página, layout, estilos e estados globais
src/components/          autenticação, navegação, canvas e editor
src/lib/                 tipos, regras do grafo, cliente e persistência
supabase/migrations/     esquema, RLS, funções e restrições SQL
tests/                   lógica e integração PostgreSQL
scripts/                 integração opcional contra Supabase real
```

## Limitações desta primeira versão

- O envio de e-mails de confirmação e recuperação depende da configuração do provedor de e-mail do Supabase e deve ser validado com contas reais do responsável.
- O limite é de **1.000 tópicos por mapa**, 30 tags e até 100 links e 100 anotações por tópico. O salvamento envia o snapshot inteiro; mapas grandes pedem paginação e operações incrementais numa próxima versão.
- Não há colaboração em tempo real ou fusão automática. Conflitos entre janelas são bloqueados; exporte o rascunho e reabra a versão mais recente. A exportação JSON é para recuperação manual; ainda não existe importador na interface.
- O rascunho não salvo vive na memória. Há aviso ao fechar enquanto há alterações, mas não há funcionamento offline nem sincronização em segundo plano após encerrar a página.
- Relações são não direcionadas. Duplicar um tópico copia seu conteúdo, sem duplicar descendentes ou relações.
- Anotações usam Markdown com prévia, sem editor visual WYSIWYG. Links aceitam HTTP/HTTPS; HTML de anotações não é executado.
- Não há upload de arquivos, edição/exclusão de mapas pela interface, compartilhamento ou tarefas/calendário nesta versão.
- Fontes usam Google Fonts com alternativas locais em caso de indisponibilidade.

Consulte [VALIDACAO.md](VALIDACAO.md) para o registro do que foi efetivamente executado e das verificações externas pendentes.

## Referências oficiais

- [Next.js: instalação](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase: e-mail e senha](https://supabase.com/docs/guides/auth/passwords)
- [Supabase: segurança do Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase: chaves públicas e privilegiadas](https://supabase.com/docs/guides/getting-started/api-keys)
- [React Flow: configuração acessível e tradução](https://reactflow.dev/api-reference/types/aria-label-config)
- [Next.js na Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
