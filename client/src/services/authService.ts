import {
  apiBaseUrl,
  clearAuthToken,
  isApiModeEnabled,
  setAuthToken,
} from './apiClient';
import { getCurrentUser, getUsers, switchCurrentUser } from './securityService';
import type { User } from '../types/security';

const SESSION_FLAG_KEY = 'vantelyx_session_active';

const readFlag = (): boolean => {
  try {
    return window.localStorage.getItem(SESSION_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
};

export const isAuthenticated = (): boolean => readFlag();

export const getSessionUser = (): User => getCurrentUser();

export const listLoginUsers = (): User[] => getUsers().filter((user) => user.active);

/**
 * Signs in a demo user. Always sets the local RBAC current user. When API mode is enabled
 * (VITE_API_BASE_URL set), it also requests a real JWT from /api/auth/dev-login so write
 * endpoints are authorized when the backend has Auth:Enabled=true.
 * TODO(Auth): replace dev-login with an OIDC/SAML redirect flow against the university IdP.
 */
export const login = async (userId: string): Promise<{ user: User; tokenIssued: boolean }> => {
  const user = switchCurrentUser(userId);
  let tokenIssued = false;

  if (isApiModeEnabled) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (response.ok) {
        const payload = await response.json();
        const token = payload?.data?.token ?? payload?.token;
        if (token) {
          setAuthToken(token);
          tokenIssued = true;
        }
      } else {
        console.warn(`[authService] dev-login failed with ${response.status}; continuing in local mode.`);
      }
    } catch (error) {
      console.warn('[authService] dev-login request failed; continuing in local mode.', error);
    }
  }

  try {
    window.localStorage.setItem(SESSION_FLAG_KEY, 'true');
  } catch {
    /* ignore storage failures */
  }
  return { user, tokenIssued };
};

export const logout = (): void => {
  clearAuthToken();
  try {
    window.localStorage.removeItem(SESSION_FLAG_KEY);
  } catch {
    /* ignore */
  }
};
