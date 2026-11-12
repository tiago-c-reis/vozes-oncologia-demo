/* V9 - configuração PÚBLICA. Nunca introduzir chaves secretas aqui.
 * Modo prelaunch apresenta o visual final sem recolher dados, até validação para produção.
 * Para produção: cumprir o guia de ativação, publicar política validada, ativar API.
 */
window.VOZES_CONFIG = Object.freeze({
  mode: 'production', // Reverter para 'prelaunch' para desativar o envio no formulário
  apiUrl: 'https://qbxsryhnpwsssrxlijrz.supabase.co/functions/v1/submit-participation', // exemplo: https://SEU-PROJETO.supabase.co/functions/v1/submit-participation
  turnstileSiteKey: '0x4AAAAAAAF1IqPb1lYRz74GB', // chave PÚBLICA da Cloudflare
  privacyUrl: 'https://vozesoncologia.pt/privacidade.html',
  privacyVersion: 'PRIVACY_V1_20261111'
});
