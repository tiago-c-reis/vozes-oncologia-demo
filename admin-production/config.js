/* CONFIGURAÇÃO PÚBLICA: não colocar aqui chaves secretas ou dados de saúde.
 * O acesso Auth/TOTP serve apenas para registo MFA nesta fase.
 * O painel de dados fica bloqueado (backendEnabled=false) até auditoria do endpoint administrativo.
 */
window.VOZES_ADMIN_CONFIG=Object.freeze({
  enabled:true,
  backendEnabled:false,
  environment:'PRODUCTION',
  supabaseUrl:'https://qbxsryhnpwsssrxlijrz.supabase.co',
  publishableKey:'sb_publishable_Yfs4YouSL34Whjfkikztcg_X7GeAUZE',
  adminFunction:'admin-v13-limited'
});
