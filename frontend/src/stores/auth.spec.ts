import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore, type User } from './auth';
import * as authApi from '@/api/auth';
import * as client from '@/api/client';

// Mock the API modules
vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  setAccessToken: vi.fn(),
}));

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('initializes with no user and not authenticated', () => {
      const store = useAuthStore();

      expect(store.user).toBeNull();
      expect(store.accessToken).toBeNull();
      expect(store.isAuthenticated).toBe(false);
      expect(store.isOwner).toBe(false);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  describe('Computed Properties', () => {
    it('isAuthenticated returns true when user exists', () => {
      const store = useAuthStore();

      store.user = {
        id: '1',
        email: 'test@example.com',
        organizationId: 'org1',
        role: 'MEMBER',
      };

      expect(store.isAuthenticated).toBe(true);
    });

    it('isOwner returns true when user role is OWNER', () => {
      const store = useAuthStore();

      store.user = {
        id: '1',
        email: 'owner@example.com',
        organizationId: 'org1',
        role: 'OWNER',
      };

      expect(store.isOwner).toBe(true);
    });

    it('isOwner returns false when user role is MEMBER', () => {
      const store = useAuthStore();

      store.user = {
        id: '1',
        email: 'member@example.com',
        organizationId: 'org1',
        role: 'MEMBER',
      };

      expect(store.isOwner).toBe(false);
    });
  });

  describe('login', () => {
    it('successfully logs in and stores credentials', async () => {
      const store = useAuthStore();
      const mockResponse = {
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          organizationId: 'org1',
          role: 'MEMBER',
        },
        accessToken: 'token123',
      };

      vi.mocked(authApi.login).mockResolvedValue(mockResponse);

      const result = await store.login('test@example.com', 'password123');

      expect(result).toBe(true);
      expect(store.user).toEqual(mockResponse.user);
      expect(store.accessToken).toBe('token123');
      expect(store.error).toBeNull();
      expect(client.setAccessToken).toHaveBeenCalledWith('token123');
      expect(localStorage.getItem('user')).toBe(JSON.stringify(mockResponse.user));
      expect(localStorage.getItem('accessToken')).toBe('token123');
    });

    it('handles login error', async () => {
      const store = useAuthStore();
      const errorMessage = 'Invalid credentials';

      vi.mocked(authApi.login).mockRejectedValue(new Error(errorMessage));

      const result = await store.login('test@example.com', 'wrong');

      expect(result).toBe(false);
      expect(store.user).toBeNull();
      expect(store.accessToken).toBeNull();
      expect(store.error).toBe(errorMessage);
    });

    it('sets loading state during login', async () => {
      const store = useAuthStore();

      vi.mocked(authApi.login).mockImplementation(() => {
        expect(store.loading).toBe(true);
        return Promise.resolve({
          user: {
            id: '1',
            email: 'test@example.com',
            organizationId: 'org1',
            role: 'MEMBER',
          },
          accessToken: 'token',
        });
      });

      await store.login('test@example.com', 'password');

      expect(store.loading).toBe(false);
    });

    it('handles non-Error login failures', async () => {
      const store = useAuthStore();

      vi.mocked(authApi.login).mockRejectedValue('String error');

      const result = await store.login('test@example.com', 'password');

      expect(result).toBe(false);
      expect(store.error).toBe('Login failed');
    });
  });

  describe('logout', () => {
    it('clears user data and calls API logout', async () => {
      const store = useAuthStore();

      // Set up authenticated state
      store.user = {
        id: '1',
        email: 'test@example.com',
        organizationId: 'org1',
        role: 'MEMBER',
      };
      store.accessToken = 'token123';
      localStorage.setItem('user', JSON.stringify(store.user));
      localStorage.setItem('accessToken', 'token123');

      vi.mocked(authApi.logout).mockResolvedValue();

      await store.logout();

      expect(store.user).toBeNull();
      expect(store.accessToken).toBeNull();
      expect(client.setAccessToken).toHaveBeenCalledWith(null);
      expect(localStorage.getItem('user')).toBeNull();
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(authApi.logout).toHaveBeenCalled();
    });

    it('clears user data even if API logout fails', async () => {
      const store = useAuthStore();

      store.user = {
        id: '1',
        email: 'test@example.com',
        organizationId: 'org1',
        role: 'MEMBER',
      };
      store.accessToken = 'token123';

      vi.mocked(authApi.logout).mockRejectedValue(new Error('Network error'));

      await store.logout();

      expect(store.user).toBeNull();
      expect(store.accessToken).toBeNull();
    });
  });

  describe('refresh', () => {
    it('successfully refreshes token', async () => {
      const store = useAuthStore();
      const mockResponse = {
        user: {
          id: '1',
          email: 'test@example.com',
          organizationId: 'org1',
          role: 'MEMBER',
        },
        accessToken: 'newToken456',
      };

      vi.mocked(authApi.refreshToken).mockResolvedValue(mockResponse);

      const result = await store.refresh();

      expect(result).toBe(true);
      expect(store.user).toEqual(mockResponse.user);
      expect(store.accessToken).toBe('newToken456');
      expect(client.setAccessToken).toHaveBeenCalledWith('newToken456');
      expect(localStorage.getItem('accessToken')).toBe('newToken456');
    });

    it('logs out on refresh failure', async () => {
      const store = useAuthStore();

      // Set up initial authenticated state
      store.user = {
        id: '1',
        email: 'test@example.com',
        organizationId: 'org1',
        role: 'MEMBER',
      };
      store.accessToken = 'oldToken';

      vi.mocked(authApi.refreshToken).mockRejectedValue(new Error('Token expired'));
      vi.mocked(authApi.logout).mockResolvedValue();

      const result = await store.refresh();

      expect(result).toBe(false);
      expect(store.user).toBeNull();
      expect(store.accessToken).toBeNull();
    });
  });

  describe('loadFromStorage', () => {
    it('loads user and token from localStorage', () => {
      const mockUser: User = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'org1',
        role: 'OWNER',
      };
      const mockToken = 'storedToken123';

      localStorage.setItem('user', JSON.stringify(mockUser));
      localStorage.setItem('accessToken', mockToken);

      const store = useAuthStore();
      store.loadFromStorage();

      expect(store.user).toEqual(mockUser);
      expect(store.accessToken).toBe(mockToken);
      expect(client.setAccessToken).toHaveBeenCalledWith(mockToken);
    });

    it('does nothing when localStorage is empty', () => {
      const store = useAuthStore();
      store.loadFromStorage();

      expect(store.user).toBeNull();
      expect(store.accessToken).toBeNull();
    });

    it('clears invalid data from localStorage', () => {
      localStorage.setItem('user', 'invalid-json');
      localStorage.setItem('accessToken', 'token');

      const store = useAuthStore();
      store.loadFromStorage();

      expect(store.user).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(localStorage.getItem('accessToken')).toBeNull();
    });

    it('does nothing when only user is stored', () => {
      const mockUser: User = {
        id: '1',
        email: 'test@example.com',
        organizationId: 'org1',
        role: 'MEMBER',
      };

      localStorage.setItem('user', JSON.stringify(mockUser));

      const store = useAuthStore();
      store.loadFromStorage();

      expect(store.user).toBeNull();
      expect(store.accessToken).toBeNull();
    });

    it('does nothing when only token is stored', () => {
      localStorage.setItem('accessToken', 'token');

      const store = useAuthStore();
      store.loadFromStorage();

      expect(store.user).toBeNull();
      expect(store.accessToken).toBeNull();
    });
  });
});
