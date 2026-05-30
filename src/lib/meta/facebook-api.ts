import type {
  GraphPageResult,
  GraphLeadFormResult,
  GraphLeadData,
} from './types'

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

async function graphRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const json = (await res.json()) as T & { error?: { message: string; code: number } }
  if (!res.ok || (json as { error?: { message: string } }).error) {
    const err = (json as { error?: { message: string } }).error
    throw new Error(err?.message ?? `Graph API error ${res.status} on ${path}`)
  }
  return json
}

/** Exchange an auth code for a short-lived user access token. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; token_type: string }> {
  const appId = process.env.META_APP_ID!
  const appSecret = process.env.META_APP_SECRET!
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  })
  return graphRequest<{ access_token: string; token_type: string }>(
    `/oauth/access_token?${params}`,
  )
}

/** Extend a short-lived user token to a long-lived one (~60 days). */
export async function getLongLivedUserToken(
  shortToken: string,
): Promise<{ access_token: string; token_type: string; expires_in: number }> {
  const appId = process.env.META_APP_ID!
  const appSecret = process.env.META_APP_SECRET!
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  })
  return graphRequest<{ access_token: string; token_type: string; expires_in: number }>(
    `/oauth/access_token?${params}`,
  )
}

/** Fetch the connected Facebook user's basic profile including picture. */
export async function getFacebookUserInfo(
  token: string,
): Promise<{ id: string; name: string; email?: string; picture?: { data: { url: string } } }> {
  return graphRequest<{ id: string; name: string; email?: string; picture?: { data: { url: string } } }>(
    `/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(token)}`,
  )
}

/** List all Facebook Pages the user has admin or editor access to. */
export async function getPages(token: string): Promise<GraphPageResult[]> {
  const data = await graphRequest<{ data: GraphPageResult[] }>(
    `/me/accounts?fields=id,name,access_token,category,picture&access_token=${encodeURIComponent(token)}`,
  )
  return data.data ?? []
}

/** Subscribe a page to leadgen webhook events. */
export async function subscribePageToLeadgen(
  pageId: string,
  pageToken: string,
): Promise<void> {
  await graphRequest(
    `/${pageId}/subscribed_apps?subscribed_fields=leadgen&access_token=${encodeURIComponent(pageToken)}`,
    { method: 'POST' },
  )
}

/** Remove a page's leadgen webhook subscription. */
export async function unsubscribePageFromLeadgen(
  pageId: string,
  pageToken: string,
): Promise<void> {
  await graphRequest(
    `/${pageId}/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`,
    { method: 'DELETE' },
  )
}

/** List lead gen forms attached to a Page. */
export async function getLeadForms(
  pageId: string,
  pageToken: string,
): Promise<GraphLeadFormResult[]> {
  const data = await graphRequest<{ data: GraphLeadFormResult[] }>(
    `/${pageId}/leadgen_forms?fields=id,name,questions&access_token=${encodeURIComponent(pageToken)}`,
  )
  return data.data ?? []
}

/** Fetch the full field data for a specific lead submission. */
export async function fetchLeadData(
  leadgenId: string,
  pageToken: string,
): Promise<GraphLeadData> {
  return graphRequest<GraphLeadData>(
    `/${leadgenId}?fields=field_data,created_time,form_id&access_token=${encodeURIComponent(pageToken)}`,
  )
}
