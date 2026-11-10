# Administração Production - Vozes da Oncologia (V31)

## Estado inicial
Esta interface está configurada para autenticação Supabase Auth e registo TOTP em Production, mas **não permite consultar testemunhos**, porque o backend administrativo não está ainda configurado. O campo `backendEnabled` está explicitamente a `false`.

- URL: https://vozesoncologia.pt/admin-production/
- Projeto: `qbxsryhnpwsssrxlijrz`
- Chave configurada: pública (`sb_publishable_`); sem `service_role` no browser
- OAuth, acesso a testemunhos, exportação e consultas: indisponíveis nesta fase.
- Após login por password e validação TOTP, mostra apenas a mensagem de conclusão do registo.
- O frontend não confere privilégios administrativos; o backend futuro terá de verificar JWT, AAL2, allowlist individual, rate limit e logs de auditoria em cada pedido.
- Esta URL não é segredo. `robots.txt` e `noindex` não são barreiras de segurança.

## Próximos bloqueios
1. Confirmar conta individual, palavra-passe e fator TOTP verificado em Supabase Production.
2. Restringir registos públicos por email e definir administradores autorizados.
3. Preparar e auditar Edge Function administrativa específica em Production, sem alterar a API de submissão, e configurar o controlo de funções permitidas e autorização por utilizador.
4. Testar respostas a pedidos sem JWT, sem AAL2, de utilizador não autorizado, autenticação revogada e rate limiting.
5. Só então ligar o backend ao painel (alterando `backendEnabled:true`), com testes funcionais, RLS e proteção de dados concluídos.
6. Manter `SUBMISSIONS_ENABLED=false` até aprovação final do processamento de dados de saúde.

## Segurança
Nunca introduzir no GitHub, chat, browser ou config.js: chaves secretas, `sb_secret_`, `service_role`, passwords, tokens JWT, código TOTP nem QR de enrolamento.
