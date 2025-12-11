import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { request, setAccessToken, getAccessToken } from './client';

describe('API Client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Reset access token before each test
    setAccessToken(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('setAccessToken and getAccessToken', () => {
    it('should set and get access token', () => {
      const token = 'test-token-123';
      setAccessToken(token);
      expect(getAccessToken()).toBe(token);
    });

    it('should set access token to null', () => {
      setAccessToken('token');
      setAccessToken(null);
      expect(getAccessToken()).toBeNull();
    });

    it('should return null initially', () => {
      expect(getAccessToken()).toBeNull();
    });
  });

  describe('request', () => {
    it('should make GET request without auth token', async () => {
      const mockData = { id: '1', name: 'Test' };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData,
      });

      const result = await request<typeof mockData>('/test');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should include Authorization header when access token is set', async () => {
      const mockData = { success: true };
      const token = 'bearer-token-xyz';
      setAccessToken(token);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData,
      });

      await request('/protected');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/protected',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${token}`,
          }),
        })
      );
    });

    it('should make POST request with body', async () => {
      const requestBody = { name: 'New Item' };
      const responseData = { id: '2', ...requestBody };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => responseData,
      });

      const result = await request('/items', {
        method: 'POST',
        body: requestBody,
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
        })
      );
      expect(result).toEqual(responseData);
    });

    it('should make PATCH request', async () => {
      const mockData = { updated: true };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData,
      });

      await request('/items/1', { method: 'PATCH', body: { status: 'active' } });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/items/1',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });

    it('should make DELETE request', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      const result = await request('/items/1', { method: 'DELETE' });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/items/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result).toBeUndefined();
    });

    it('should handle 204 No Content response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      const result = await request('/no-content');

      expect(result).toBeUndefined();
    });

    it('should handle non-JSON response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
      });

      const result = await request('/text');

      expect(result).toBeUndefined();
    });

    it('should throw error when response is not ok', async () => {
      const errorMessage = 'Resource not found';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => errorMessage,
      });

      await expect(request('/not-found')).rejects.toThrow(errorMessage);
    });

    it('should throw error with status when no error text', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => '',
      });

      await expect(request('/error')).rejects.toThrow('Request failed with status 500');
    });

    it('should include credentials in request', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      await request('/test');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });

    it('should set Content-Type header to application/json', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      await request('/test');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should make PUT request', async () => {
      const mockData = { updated: true };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData,
      });

      await request('/items/1', { method: 'PUT', body: { name: 'Updated' } });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/items/1',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    it('should handle empty content-type header', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({}),
      });

      const result = await request('/test');

      expect(result).toBeUndefined();
    });
  });
});
