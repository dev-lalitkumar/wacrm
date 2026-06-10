import type {
  GraphPageResult,
  GraphLeadFormResult,
  GraphLeadData,
} from './types'

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

export interface GraphApiError {
  message: string
  code?: number
}

interface GraphPagedResponse<T> {
  data?: T[]
  paging?: { next?: string }
  error?: GraphApiError
}

export interface GetLeadFormsResult {
  forms: GraphLeadFormResult[]
  tokenUsed: 'page' | 'user'
  warning?: string
  graphError?: string
}

async function parseGraphResponse<T>(
  res: Response,
): Promise<T & { error?: GraphApiError }> {
  return (await res.json()) as T & { error?: GraphApiError }
}

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
  const json = await parseGraphResponse<T>(res)
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Graph API error ${res.status} on ${path}`)
  }
  return json
}

/** Follow Graph API cursor pagination until all pages are collected. */
export async function graphPaginatedRequest<T>(
  initialPath: string,
): Promise<{ data: T[]; error?: GraphApiError }> {
  const all: T[] = []
  let url: string | null = `${GRAPH_BASE}${initialPath}`

  while (url) {
    const res: Response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    })
    const json: GraphPagedResponse<T> & { error?: GraphApiError } =
      await parseGraphResponse<GraphPagedResponse<T>>(res)
    if (!res.ok || json.error) {
      return { data: all, error: json.error ?? { message: `Graph API error ${res.status}` } }
    }
    if (json.data?.length) {
      all.push(...json.data)
    }
    url = json.paging?.next ?? null
  }

  return { data: all }
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

/** List lead gen forms attached to a Page (paginated). */
export async function getLeadForms(
  pageId: string,
  accessToken: string,
): Promise<GraphLeadFormResult[]> {
  const { data, error } = await graphPaginatedRequest<GraphLeadFormResult>(
    `/${pageId}/leadgen_forms?fields=id,name,questions&limit=100&access_token=${encodeURIComponent(accessToken)}`,
  )
  if (error) {
    throw new Error(error.message)
  }
  return data
}

/**
 * Fetch lead forms for a page, retrying with the user token when the page
 * token returns zero forms (common when Leads Access Manager restricts page tokens).
 */
export async function getLeadFormsWithFallback(
  pageId: string,
  pageToken: string,
  userToken?: string | null,
): Promise<GetLeadFormsResult> {
  try {
    const pageForms = await getLeadForms(pageId, pageToken)
    if (pageForms.length > 0) {
      return { forms: pageForms, tokenUsed: 'page' }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!userToken) {
      return { forms: [], tokenUsed: 'page', graphError: message }
    }
    try {
      const userForms = await getLeadForms(pageId, userToken)
      return {
        forms: userForms,
        tokenUsed: 'user',
        warning: userForms.length > 0
          ? 'Forms fetched using your user token because the page token could not access lead forms.'
          : undefined,
        graphError: message,
      }
    } catch (userErr) {
      const userMessage = userErr instanceof Error ? userErr.message : String(userErr)
      return {
        forms: [],
        tokenUsed: 'page',
        graphError: `${message} (user token fallback also failed: ${userMessage})`,
      }
    }
  }

  if (!userToken) {
    return { forms: [], tokenUsed: 'page' }
  }

  try {
    const userForms = await getLeadForms(pageId, userToken)
    if (userForms.length > 0) {
      return {
        forms: userForms,
        tokenUsed: 'user',
        warning:
          'Forms fetched using your user token. If you expected more forms, check Leads Access Manager permissions for this Page.',
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      forms: [],
      tokenUsed: 'user',
      graphError: message,
      warning:
        'No forms found. Ensure this Page has Instant Forms in Ads Manager and that your Facebook user has leads access on the Page.',
    }
  }

  return {
    forms: [],
    tokenUsed: 'page',
    warning:
      'No lead forms returned from Meta. Ensure this Page has active Instant Forms and that your user has leads access in Business Settings → Leads Access Manager.',
  }
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
