# Vozes da Oncologia — V9 | Receção segura (não ativa por defeito)

**Estado:** código implementado; sem serviço cloud ligado, sem migração aplicada e sem recolha de dados reais. Publicar apenas o ZIP no GitHub Pages não ativa recolha. O modo `demo` continua a funcionar e gera PDF local.

## 1. O que inclui a V9

- Mantém a V8 (site, formulário adaptativo, fotografias e PDF com campos completos).
- Prepara uma API de receção em Supabase Edge Functions, com a submissão real **bloqueada por defeito**.
- Validação do Turnstile **no servidor**; o token expira em 5 minutos e só pode ser validado uma vez.
- Validação forte do conteúdo no servidor e em SQL, limite de 240 kB por pedido e quotas por janela de 15 minutos.
- PostgreSQL com tabelas separadas de participações, contactos encriptados (AES-256-GCM), consentimentos e contadores de quota.
- Row Level Security (RLS) ativada e acessos `anon` / `authenticated` revogados. Nenhuma credencial privilegiada entra no browser.
- Gravação transacional numa RPC, identificador UUID aleatório, `requestId` idempotente para evitar duplicados ao repetir pedidos.
- O PDF permanece local. Em produção, a confirmação de receção só surge após a resposta da base de dados. Caso o PDF falhe, a receção continua confirmada.
- Participações de menores desativadas nesta versão de produção. O participante confirma expressamente ter pelo menos 18 anos.
- Não há envio de emails, painel administrativo dedicado, apagamento automatizado, nem processos de conservação definitiva definidos — serão fases seguintes.

## 2. Antes da ativação — requisitos que não são opcionais

1. **Responsável pelo tratamento** identificado e documentado (não presumir HPP por defeito).
2. AIPD/DPIA para tratamento de dados de saúde em larga escala, finalidades, bases jurídicas art. 6.º e condição art. 9.º RGPD, direitos, retenção, informação de privacidade, contratos dos fornecedores, transferências internacionais e eventual EPD/DPO verificados por profissional competente.
3. Política de privacidade **validada e publicada numa URL HTTPS**, descrevendo as finalidades efetivas e identificando a entidade responsável. Não substituir esta etapa apenas por uma checkbox.
4. Serviços de email e domínio, se forem comunicados ao público, devem estar realmente operacionais.
5. Aplicar e rever migração, configurar backups **com testes de restauro**, auditoria de acessos, alertas e controlo de incidentes.
6. Rever em ambiente de testes (Supabase e Turnstile separados da produção), testes de penetração e testes de carga. Verificar se o volume de pico cabe no plano escolhido.
7. Só depois, passar a `mode:'production'` e `SUBMISSIONS_ENABLED=true`, num deploy controlado.

## 3. Preparar a base de dados Supabase (ambiente de TESTES)

1. Criar projeto Supabase numa **região da União Europeia**. Verificar também a localização dos logs, backups e subprocessadores.
2. **Residência dos dados:** o PostgreSQL deve ficar na UE. As Edge Functions podem executar em várias regiões; antes de ativar dados de saúde, validar/forçar a execução em região da UE ou substituir a API por serviço regional europeu, incluindo logs, backups, fornecedores e potenciais transferências internacionais.
3. Instalar Supabase CLI e autenticar localmente. Nunca enviar acessos ou chaves secretas por mensagens ou commits.
4. Na raiz do projeto (onde existe `supabase/`) fazer associação ao projeto de testes e executar a migração:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF_TESTE
supabase db push
```

Como alternativa, rever e executar o ficheiro `supabase/migrations/20261105_000001_v9_intake.sql` na consola SQL do projeto **de teste**. Verificar as tabelas `public.vozes_*`, grants e RLS.

**Nota:** o esquema está no `public` porque a RPC usa a API REST do Supabase, mas as tabelas **não** têm políticas de leitura/escrita públicas. Consultas administrativas devem permanecer em contas com privilégios e autenticação multifator. Não usar `service_role` no browser.

## 4. Cloudflare Turnstile

1. Criar widget **Managed** em Cloudflare Turnstile e configurar os *hostnames* permitidos (ex.: `tiago-c-reis.github.io` e `www.vozesoncologia.pt`, quando estiver sob controlo do projeto).
2. Copiar a **site key** pública para `config.js` (apenas após aprovação de ativação).
3. Guardar a **secret key** apenas no ambiente da Edge Function (`TURNSTILE_SECRET_KEY`). A Edge Function confirma o token com `/siteverify`, incluindo hostname.
4. Configurar widgets separados para teste e produção e proteção adicional no tráfego (limites / WAF). O controlo de quotas baseado em IP é complementar, não uma defesa exclusiva.

## 5. Segredos de backend (NUNCA no GitHub)

Configurar através do painel Supabase → Edge Functions → Secrets ou CLI com variáveis do teu ambiente. **Não usar `config.js` ou HTML para estes valores.**

| Segredo do servidor | Exemplo / uso |
|---|---|
| `SUBMISSIONS_ENABLED` | `false` no início; `true` apenas no lançamento autorizado |
| `ACTIVE_PRIVACY_VERSION` | Versão exata da política aprovada, ex.: `2026-11-approved-v1` |
| `ALLOWED_ORIGINS` | `https://tiago-c-reis.github.io,https://www.vozesoncologia.pt` |
| `TURNSTILE_SECRET_KEY` | Chave secreta Cloudflare |
| `TURNSTILE_ALLOWED_HOSTNAMES` | `tiago-c-reis.github.io,www.vozesoncologia.pt` |
| `CONTACT_AES_KEY_B64` | Chave aleatória de 32 bytes, Base64; **guardar cópia recuperável em cofre de segredos** |
| `RATE_HASH_SECRET` | Segredo aleatório separado, com ≥32 caracteres |
| `RATE_LIMIT_15M` | `120` (configuração indicativa; adaptar a público e redes partilhadas) |
| `SUPABASE_URL` | Disponibilizado automaticamente na plataforma Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` | Disponibilizado pela plataforma ou configurado como segredo; **nunca no browser** |

Exemplos locais para gerar segredos aleatórios sem os mostrar em chats:

```bash
# Numa máquina de administração privada com Python instalado
python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"  # CONTACT_AES_KEY_B64
python -c "import secrets; print(secrets.token_urlsafe(48))"  # RATE_HASH_SECRET
```

**Atenção:** perder `CONTACT_AES_KEY_B64` significa perder a capacidade de decifrar os emails guardados. Usar um gestor de segredos, política de rotação e testes de recuperação. O email **não** é necessário para o registo de testemunhos.

## 6. Deploy da Edge Function — projeto de TESTES

```bash
supabase functions deploy submit-participation --project-ref SEU_PROJECT_REF_TESTE
```

`supabase/config.toml` tem `verify_jwt=false` porque as pessoas participam sem conta. Isto **não significa que a API seja aberta sem proteções**: exige origem autorizada, validação obrigatória do Turnstile, validação de conteúdo, quotas e o servidor só permite escrita após ativação explícita.

O endpoint é:

```text
https://SEU_PROJECT_REF_TESTE.supabase.co/functions/v1/submit-participation
```

Se não tiveres uma equipa para operar a plataforma e responder a incidentes, a abertura ao público deve aguardar essa capacidade.

## 7. Configurar frontend, depois da autorização

Editar `config.js` (que contém **apenas informação pública**):

```js
window.VOZES_CONFIG = Object.freeze({
  mode: 'production',
  apiUrl: 'https://SEU_PROJECT_REF_PRODUCAO.supabase.co/functions/v1/submit-participation',
  turnstileSiteKey: 'SITE_KEY_PUBLICA',
  privacyUrl: 'https://www.vozesoncologia.pt/privacidade',
  privacyVersion: '2026-11-approved-v1'
});
```

A mesma versão da política tem de constar em `ACTIVE_PRIVACY_VERSION` da Edge Function. Um pedido com versão desatualizada é rejeitado. A publicação da política é da responsabilidade do titular do projeto, após a aprovação necessária.

Não ativar `mode: 'production'` na versão atual do GitHub até cumprir os requisitos anteriores.

## 8. Como testar sem recolher dados reais

- Deixar `mode:'demo'` e `SUBMISSIONS_ENABLED=false`.
- Verificar que o frontend não faz pedidos de submissão, o PDF continua a ser gerado localmente e os dados não são guardados em servidor.
- Testar API com **dados inteiramente fictícios** num projeto Supabase de teste e uma site key Turnstile de teste. Não colocar diagnósticos ou testemunhos reais.
- Confirmar respostas `403` (origem), `503` (recolha desligada), `400` (dados inválidos), `429` (quota), `200` (recebida) e repetição idempotente sem duplicação.
- Testar transação SQL, permissões anon/authenticated negadas, emails encriptados, restauro e testes de carga.

## 9. O que NÃO foi feito nesta V9

- Não criámos um projeto Supabase real, nem migrámos uma base de dados em produção.
- Não ativámos o Turnstile numa conta real, nem configurámos DNS/HTTPS/email.
- Não foi realizada AIPD, parecer ético, autorização institucional ou auditoria externa.
- Não há autenticação administrativa, interface de pesquisa, gestão operacional de titulares, exportações controladas ou automatização de retenção: previsto para V10/V11.
- Não há garantias de escalabilidade para 500 000 sem testes reais de carga com a configuração contratada.
- A interface permanece em **modo demonstrativo**, mesmo depois de publicada no GitHub Pages, até alteração explícita e autorizada de configuração.
