/* CONFIGURAÇÃO PÚBLICA: não colocar aqui chaves secretas ou dados de saúde.
 * O acesso a dados exige JWT validado pelo Supabase Auth, MFA AAL2, allowlist, permissões e auditoria no servidor.
 * O frontend apenas disponibiliza a interface; ADMIN_PANEL_ENABLED continua a controlar o acesso no servidor.
 */
window.VOZES_ADMIN_CONFIG=Object.freeze({
  enabled:true,
  backendEnabled:true,
  environment:'PRODUCTION',
  supabaseUrl:'https://qbxsryhnpwsssrxlijrz.supabase.co',
  publishableKey:'sb_publishable_Yfs4YouSL34Whjfkikztcg_X7GeAUZE',
  adminFunction:'admin-v13-limited'
});
