# RGPD — checklist de validação (PROPOSTA, não publicar diretamente)

**Âmbito:** FAQ, política de privacidade e versão `PRIVACY_V2_20261119`.
**Estado:** minuta. Nenhum procedimento legal ou eliminação foi aprovado ou executado por este documento.

## Decisões necessárias antes de incorporar em `main`

- [ ] Aprovar com especialista RGPD o responsável pelo tratamento, fundamento jurídico para dados de saúde, direitos de terceiros/menores e a necessidade de AIPD.
- [ ] Aprovar os prazos **propostos**, não verificados como prática atual: testemunhos 24 meses desde `received_at`; email opcional de recontacto 12 meses.
- [ ] Designar responsável por revisão **mensal** de prazos, antecipando a eliminação dos registos que expiram antes da revisão seguinte. Testar primeiro em staging com dados sintéticos.
- [ ] Definir revisão humana antes de qualquer publicação de excertos: eliminar/generalizar identificadores diretos e indiretos, suprimir referências especialmente sensíveis (incluindo terceiros e menores) e não publicar se subsistir risco de reidentificação.
- [ ] Confirmar quem tem acesso privilegiado ao projeto Supabase, quais os destinatários/subcontratantes, contratos e transferências; delimitar utilização externa a resultados agregados e excertos aprovados.
- [ ] Inventariar backups, PITR e cópias externas; formalizar o tratamento de registos retirados após eventual restauro, sem prometer eliminação instantânea das cópias.
- [ ] Designar responsável pelo canal `ouvir@vozesoncologia.pt` e criar registo interno **mínimo** de pedidos RGPD (data, ID, estado, verificação efetuada, decisão, execução e resposta), sem conteúdo do testemunho.
- [ ] Em retirada de consentimento: o identificador de receção facilita a pesquisa mas **não é prova exclusiva de titularidade**. O PDF não deve ser exigido; pedir apenas elementos proporcionais quando houver dúvidas razoáveis. Não abrir, partilhar ou manter anexos sensíveis desnecessários.
- [ ] Confirmar e comunicar o resultado em regra em 1 mês, admitindo prorrogação apenas nas condições do art. 12.º do RGPD. Avaliar exceções aplicáveis ao apagamento.
- [ ] Documentar o tratamento retrospetivo dos registos existentes, sem os exportar para ferramentas externas.

## Validação técnica antes da publicação

1. Verificar que `script.js` tem sintaxe válida, que as novas perguntas aparecem em `#/faq` e que os links para a política e email funcionam.
2. Rever juridicamente todo o conteúdo e comunicar aos participantes as alterações materiais quando aplicável.
3. Verificar em staging que frontend `config.js` e a variável secreta `ACTIVE_PRIVACY_VERSION` da Edge Function de submissão coincidem; uma diferença gera erro de versão de privacidade e bloqueia submissões.
4. Testar uma submissão **sintética** em staging, com consentimento e recibo, sem dados reais.
5. Só depois considerar promoção conjunta de frontend, política, configuração da função e documentação operacional para Production, mediante aprovação explícita.
6. Rollback: recuperar a versão anterior de `script.js`, `privacidade.html` e `config.js` em conjunto com a correspondente versão ativa na função. Não restaurar registos apagados validamente.

**Nota:** alteração de textos não prova, por si, conformidade RGPD. Este documento define tarefas pendentes, não práticas já verificadas.
