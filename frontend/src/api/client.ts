const API_V1_BASE = import.meta.env.VITE_API_URL || '/api/v1'
const API_V2_BASE = '/api/v2'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface ApiFetchOptions extends RequestInit {
  /** Use v2 API base instead of v1 */
  v2?: boolean
}

export async function apiFetch<T>(
  endpoint: string,
  options?: ApiFetchOptions
): Promise<T> {
  const { v2, ...fetchOptions } = options ?? {}
  const base = v2 ? API_V2_BASE : API_V1_BASE
  const url = `${base}${endpoint}`

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new ApiError(response.status, errorText || `HTTP ${response.status}`)
  }

  return response.json()
}
