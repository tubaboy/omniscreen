import { openDB } from 'idb';
import type { WidgetConfig } from '@/components/WidgetRenderer';

const DB_NAME = 'OmniscreenDB';
const DB_VERSION = 1;
const STORE_NAME = 'playlists';

export interface CachedPlaylist {
    screenId: string;
    playlist: Array<{
        id: string;
        name: string;
        type: 'IMAGE' | 'VIDEO' | 'WIDGET' | 'WEB' | 'YOUTUBE';
        url: string | null;
        duration: number;
        widgetConfig?: WidgetConfig;
    }>;
    cachedAt: number; // timestamp ms
}

function getDb() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'screenId' });
            }
        },
    });
}

export async function savePlaylist(screenId: string, playlist: CachedPlaylist['playlist']) {
    const db = await getDb();
    await db.put(STORE_NAME, { screenId, playlist, cachedAt: Date.now() });
}

export async function loadPlaylist(screenId: string): Promise<CachedPlaylist | undefined> {
    const db = await getDb();
    return db.get(STORE_NAME, screenId);
}

/** Ask Service Worker to pre-cache an array of media URLs */
export function precacheUrls(urls: string[]) {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker.controller) return;
    navigator.serviceWorker.controller.postMessage({
        type: 'PRECACHE_URLS',
        urls,
    });
}
