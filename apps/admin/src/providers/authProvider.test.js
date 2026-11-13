import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/auth-api.js', () => ({
    loginRequest: vi.fn(async () => ({ token: 't', username: 'u', role: 'ADMIN' })),
}));

const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};

const { default: authProvider } = await import('./authProvider.js');

beforeEach(() => store.clear());

describe('authProvider', () => {
    it('stores the session on login', async () => {
        await authProvider.login({ username: 'u', password: 'p' });
        expect(store.get('token')).toBe('t');
        expect(store.get('role')).toBe('ADMIN');
    });
    it('rejects checkAuth without a token', async () => {
        await expect(authProvider.checkAuth()).rejects.toBeUndefined();
    });
    it('clears the session on 401 and 403 only', async () => {
        store.set('token', 't');
        await expect(authProvider.checkError({ status: 401 })).rejects.toBeUndefined();
        expect(store.has('token')).toBe(false);
        store.set('token', 't');
        await expect(authProvider.checkError({ status: 500 })).resolves.toBeUndefined();
        expect(store.has('token')).toBe(true);
    });
    it('returns the role as permissions', async () => {
        store.set('role', 'ADMIN');
        await expect(authProvider.getPermissions()).resolves.toBe('ADMIN');
    });
});
