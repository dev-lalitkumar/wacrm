/**
 * Facebook Login scopes for Lead Ads integration.
 * Must match permissions approved in Meta App Review.
 * After changing this list, users must disconnect and reconnect Facebook.
 */
export const META_OAUTH_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_manage_ads',
  'leads_retrieval',
  'ads_read',
  'ads_management',
  'business_management',
] as const

export const META_OAUTH_SCOPE_STRING = META_OAUTH_SCOPES.join(',')
