# Vozes da Oncologia — V9: frontend pré-configurado

Configuração preparada em 5 de novembro de 2026. A URL pública do Supabase e a Site Key pública do Turnstile estão em config.js.

**A recolha de dados permanece desativada:** mode: 'demo' no frontend e SUBMISSIONS_ENABLED=false no Supabase.

Esta configuração NÃO ativa o Turnstile para participações reais, nem grava testemunhos. A exportação PDF local da V8 mantém-se.

NUNCA colocar no GitHub chaves secretas (service_role, TURNSTILE_SECRET_KEY, CONTACT_AES_KEY_B64, RATE_HASH_SECRET). A chave secreta Turnstile mostrada anteriormente numa captura deve ser rodada antes de usar em produção.

Ainda faltam teste de gravação numa instância de testes controlada, validações de segurança, política de privacidade aprovada e AIPD antes de ativar a recolha pública.

Para publicar: enviar os ficheiros dentro da pasta vozes-oncologia-demo-main para a raiz do repositório GitHub Pages.
