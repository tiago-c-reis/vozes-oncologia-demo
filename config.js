/* V9 — configuração PÚBLICA. Nunca introduzir chaves secretas aqui.
 * Modo prelaunch apresenta o visual final sem recolher dados, até validação para produção.
 * Para produção: cumprir o guia de ativação, publicar política validada, ativar API.
 */
window.VOZES_CONFIG = Object.freeze({
  mode: 'prelaunch', // 'prelaunch' | 'demo' | 'production' — manter a recolha bloqueada até aprovação
  apiUrl: 'https://qbxsryhnpwsssrxlijrz.supabase.co/functions/v1/submit-participation', // exemplo: https://SEU-PROJETO.supabase.co/functions/v1/submit-participation
  turnstileSiteKey: '0x4AAAAAAAF1IqPb1iYRz74GB', // chave PÚBLICA da Cloudflare
  privacyUrl: '', // URL https da política validada
  privacyVersion: 'PENDING_APPROVAL' // substituir por identificador aprovado
});
