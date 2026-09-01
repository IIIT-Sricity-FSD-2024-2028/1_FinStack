import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

function createStorage(): Storage {
    let data = new Map<string, string>();

    return {
        get length() {
            return data.size;
        },
        clear() {
            data.clear();
        },
        getItem(key: string) {
            return data.get(key) ?? null;
        },
        key(index: number) {
            return Array.from(data.keys())[index] ?? null;
        },
        removeItem(key: string) {
            data.delete(key);
        },
        setItem(key: string, value: string) {
            data.set(key, String(value));
        },
    };
}

if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: createStorage(),
    });
}

if (typeof globalThis.sessionStorage === 'undefined') {
    Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: createStorage(),
    });
}

afterEach(() => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
});