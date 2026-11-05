/* V9 — configuração PÚBLICA. Nunca introduzir chaves secretas aqui.
 * Modo demo é a opção segura por defeito, mesmo depois da publicação no GitHub.
 * Para produção: cumprir o guia de ativação, publicar política validada, ativar API.
 */
window.VOZES_CONFIG = Object.freeze({
  mode: 'demo', // 'demo' | 'production' — NÃO alterar antes da aprovação RGPD
  apiUrl: 'https://qbxsrynhpwsssrxljlrz.supabase.co/functions/v1/submit-participation', // exemplo: https://SEU-PROJETO.supabase.co/functions/v1/submit-participation
  turnstileSiteKey: '0x4AAAAAAAF1IqPb1iYRz74GB', // chave PÚBLICA da Cloudflare
  privacyUrl: '', // URL https da política validada
  privacyVersion: 'PENDING_APPROVAL' // substituir por identificador aprovado
});
