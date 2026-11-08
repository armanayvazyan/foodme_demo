// Gives Dexie a real IndexedDB implementation under Node so cart logic
// (src/hooks/useCart.ts) can be unit-tested without a browser.
import "fake-indexeddb/auto";
