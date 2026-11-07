/* Only PUBLIC Supabase project URL and PUBLISHABLE/ANON key belong here.
 * No service_role, sb_secret_, AES key, admin token, or participant data.
 * This build enables only STAGING login; backend still requires verified MFA and allowlisted admin.
 */
window.VOZES_ADMIN_CONFIG=Object.freeze({
  enabled:false,
  environment:'STAGING',
  supabaseUrl:'https://zfqgwknknlsqzgmfjyxd.supabase.co',
  publishableKey:'sb_publishable_lLX4nrV34cTAPZsnGvd2tw_TP4qzE6b',
  adminFunction:'admin-v10'
});
