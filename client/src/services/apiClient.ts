const trimSlash = (value: string): string => value.replace(/\/+$/, '');

export const apiBaseUrl = trimSlash(import.meta.env.VITE_API_BASE_URL ?? '');
export const isApiModeEnabled = apiBaseUrl.length > 0;

export const AUTH_TOKEN_KEY = 'vantelyx_auth_token';

export const getAuthToken = (): string | null => {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAuthToken = (token: string): void => {
  try {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    /* ignore storage failures (private mode) */
  }
};

export const clearAuthToken = (): void => {
  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
};

const authHeader = (): Record<string, string> => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Request timeout so a slow/unreachable API never hangs the UI — it falls back instead.
export const REQUEST_TIMEOUT_MS = 8000;

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError';

const withTimeout = (): { signal: AbortSignal | undefined; done: () => void } => {
  if (typeof AbortController === 'undefined') {
    return { signal: undefined, done: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
};

type RequestOptions<TFallback> = {
  body?: unknown;
  headers?: Record<string, string>;
  fallback?: TFallback;
};

async function request<TResponse, TFallback = TResponse>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options?: RequestOptions<TFallback>
): Promise<TResponse | TFallback> {
  if (!isApiModeEnabled) {
    return options?.fallback as TFallback;
  }

  const url = `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const { signal, done } = withTimeout();

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
        ...(options?.headers ?? {}),
      },
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    });

    if (!response.ok) {
      console.warn(`[apiClient] ${method} ${url} failed with ${response.status}. Falling back.`);
      return options?.fallback as TFallback;
    }

    if (response.status === 204) {
      return options?.fallback as TFallback;
    }

    return (await response.json()) as TResponse;
  } catch (error) {
    console.warn(`[apiClient] ${method} ${url} failed${isAbortError(error) ? ' (timeout)' : ''}. Falling back.`, error);
    return options?.fallback as TFallback;
  } finally {
    done();
  }
}

async function requestText<TFallback = string>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options?: RequestOptions<TFallback>
): Promise<string | TFallback> {
  if (!isApiModeEnabled) {
    return options?.fallback as TFallback;
  }

  const url = `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const { signal, done } = withTimeout();

  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...authHeader(),
        ...(options?.headers ?? {}),
      },
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    });

    if (!response.ok) {
      console.warn(`[apiClient] ${method} ${url} failed with ${response.status}. Falling back.`);
      return options?.fallback as TFallback;
    }

    return await response.text();
  } catch (error) {
    console.warn(`[apiClient] ${method} ${url} failed${isAbortError(error) ? ' (timeout)' : ''}. Falling back.`, error);
    return options?.fallback as TFallback;
  } finally {
    done();
  }
}

export const apiClient = {
  get: <TResponse, TFallback = TResponse>(path: string, fallback?: TFallback) =>
    request<TResponse, TFallback>('GET', path, { fallback }),
  post: <TResponse, TFallback = TResponse>(path: string, body?: unknown, fallback?: TFallback) =>
    request<TResponse, TFallback>('POST', path, { body, fallback }),
  put: <TResponse, TFallback = TResponse>(path: string, body?: unknown, fallback?: TFallback) =>
    request<TResponse, TFallback>('PUT', path, { body, fallback }),
  patch: <TResponse, TFallback = TResponse>(path: string, body?: unknown, fallback?: TFallback) =>
    request<TResponse, TFallback>('PATCH', path, { body, fallback }),
  delete: <TResponse, TFallback = TResponse>(path: string, fallback?: TFallback) =>
    request<TResponse, TFallback>('DELETE', path, { fallback }),
  getText: <TFallback = string>(path: string, fallback?: TFallback) =>
    requestText<TFallback>('GET', path, { fallback }),
};
