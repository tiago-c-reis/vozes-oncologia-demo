# Vozes da Oncologia — painel administrativo V12 (Staging)

## Alteração
Nova interface de listagem baseada em `list_cursor` e `next_cursor`, com navegação **Anterior / Seguinte**, filtros combinados e indicador de página. O backend é a Edge Function existente `admin-v10` com a ação `list_cursor`, já testada no ambiente Staging.

## Segurança e isolamento
- A pasta `admin-v10/` não é alterada.
- Esta versão usa a mesma autenticação Supabase Auth, verificação TOTP/MFA, allowlist administrativa e auditoria da V10.
- Não inclui chaves secretas nem tokens no código. Os tokens são mantidos em memória e não em localStorage.
- A lista não exporta testemunhos ou contactos. O botão de exportação mantém o limiar de supressão de categorias pequenas.
- A paginação não pressupõe um total exato de resultados: mostra apenas o número de registos da página atual.
- Quando os filtros ou os dados são atualizados, o cursor é reiniciado.
- A comparação `(received_at, id)` é exclusiva e segue ordenação descendente; a API fornece o cursor da página seguinte.

## Validação a executar ANTES de promover
1. Abrir o painel V12 em Staging e iniciar sessão com MFA.
2. Confirmar resumo, tabela vazia, filtros e botões de paginação desativados na ausência de dados.
3. Com lote exclusivamente sintético: confirmar 20+20+5 páginas, anterior/seguinte, filtros e nenhuma duplicação.
4. Verificar registos de auditoria de `list` e de `detail`; confirmar ausência de narrativas em CSV.
5. Repetir no browser os testes de sessão expirada, logout e acesso não autorizado.
6. Não publicar produção até concluir avaliação de proteção de dados, controlo de acessos, recuperação, rate limiting e testes de carga representativos.

## Implementação
Pasta isolada `admin-v12/` (quatro ficheiros: `index.html`, `admin.js`, `admin.css`, `config.js`).
A nova interface só fica servida via GitHub Pages após integração na branch de publicação.
Não altera as APIs, as tabelas, os índices nem a V10.

## Limitações conhecidas
A paginação por cursor percorre páginas sequencialmente, não permite salto direto para uma página arbitrária. Novas inserções durante a navegação podem alterar a composição de páginas; a ordenação única reduz duplicações numa sequência sem alterações, mas não assegura uma fotografia transacional global. A contagem total é mostrada no sumário, não na listagem filtrada.
