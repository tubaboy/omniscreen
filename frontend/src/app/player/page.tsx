'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { savePlaylist, loadPlaylist, precacheUrls } from '@/hooks/useOfflinePlaylist';

interface PlaylistItem {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO';
  url: string;
  duration: number;
}

function PlayerContent() {
  const searchParams = useSearchParams();
  const screenId = searchParams.get('id');
  const urlHud = searchParams.get('hud');

  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fadeState, setFadeState] = useState<'visible' | 'fading-out' | 'fading-in'>('visible');
  const [isOffline, setIsOffline] = useState(false);
  // HUD state
  const [serverHud, setServerHud] = useState(true);
  const showHud = urlHud === '0' || urlHud === 'false' ? false : (urlHud === '1' || urlHud === 'true' ? true : serverHud);
  const [hudVisible, setHudVisible] = useState(false);
  const [imageTimeLeft, setImageTimeLeft] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hudTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingIndexRef = useRef<number>(0);
  const imageStartRef = useRef<number>(0);

  // Register Service Worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    }
  }, []);

  // Trigger HUD briefly on item change, then fade
  const triggerHud = () => {
    if (!showHud) return;
    setHudVisible(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => setHudVisible(false), 4000);
  };

  const transitionTo = (nextIndex: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingIndexRef.current = nextIndex;
    setFadeState('fading-out');
  };

  const next = () => {
    setCurrentIndex(prev => {
      const nextIdx = playlist.length > 0 ? (prev + 1) % playlist.length : 0;
      transitionTo(nextIdx);
      return prev;
    });
  };

  useEffect(() => {
    let currentInterval = 10000;
    let pollTimeout: NodeJS.Timeout;
    let isCancelled = false;

    const pollData = async () => {
      if (isCancelled) return;
      try {
        const [plRes, setRes] = await Promise.allSettled([
          screenId ? api.get(`/playlists/${screenId}`) : Promise.resolve({ data: [] }),
          api.get('/settings'),
        ]);

        let networkSuccess = false;

        if (setRes.status === 'fulfilled') {
          const intervalSec = parseInt(setRes.value.data.player_poll_interval || '10');
          currentInterval = Math.max(5000, intervalSec * 1000);
          setServerHud(setRes.value.data.player_hud !== 'false');
          networkSuccess = true;
        }

        if (plRes.status === 'fulfilled' && screenId) {
          const newPlaylist = plRes.value.data as PlaylistItem[];
          networkSuccess = true;

          // Save to IndexedDB for offline fallback
          if (newPlaylist.length > 0) {
            await savePlaylist(screenId, newPlaylist);
            // Pre-cache all media URLs via Service Worker
            precacheUrls(newPlaylist.map((item) => item.url));
          }

          setPlaylist(prev => {
            if (
              prev.length === newPlaylist.length &&
              prev.every((item, i) => item.id === newPlaylist[i].id && item.duration === newPlaylist[i].duration)
            ) {
              return prev;
            }
            setCurrentIndex(0);
            return newPlaylist;
          });
          setLoading(false);
          setIsOffline(false);
        }

        if (!networkSuccess) {
          throw new Error('All network requests failed');
        }
      } catch (err) {
        console.warn('Poll failed, trying IndexedDB cache…', err);
        setIsOffline(true);

        // Fallback to IndexedDB cache
        if (screenId) {
          const cached = await loadPlaylist(screenId);
          if (cached && cached.playlist.length > 0) {
            setPlaylist(prev => {
              if (prev.length > 0) return prev; // already playing, don't reset
              return cached.playlist;
            });
            setLoading(false);
          }
        }
      }

      if (!isCancelled) {
        pollTimeout = setTimeout(pollData, currentInterval);
      }
    };

    pollData();

    const hbInterval = setInterval(() => {
      if (screenId) api.post(`/screens/${screenId}/heartbeat`).catch(() => { });
    }, 20000);

    return () => {
      isCancelled = true;
      clearTimeout(pollTimeout);
      clearInterval(hbInterval);
    };
  }, [screenId]);

  useEffect(() => {
    if (fadeState === 'fading-out') {
      const t = setTimeout(() => {
        setCurrentIndex(pendingIndexRef.current);
        setFadeState('fading-in');
      }, 300);
      return () => clearTimeout(t);
    }
    if (fadeState === 'fading-in') {
      const t = setTimeout(() => {
        setFadeState('visible');
        triggerHud();
      }, 300);
      return () => clearTimeout(t);
    }
  }, [fadeState]);

  // Image countdown ticker
  useEffect(() => {
    if (playlist.length === 0 || fadeState !== 'visible') return;
    const currentItem = playlist[currentIndex];
    if (!currentItem) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (currentItem.type === 'IMAGE') {
      const dur = currentItem.duration;
      imageStartRef.current = Date.now();
      setImageTimeLeft(dur);
      const tick = setInterval(() => {
        const elapsed = (Date.now() - imageStartRef.current) / 1000;
        const left = Math.max(0, dur - elapsed);
        setImageTimeLeft(Math.ceil(left));
        if (left <= 0) clearInterval(tick);
      }, 200);
      timerRef.current = setTimeout(() => {
        clearInterval(tick);
        transitionTo((currentIndex + 1) % playlist.length);
      }, dur * 1000);
      return () => {
        clearTimeout(timerRef.current!);
        clearInterval(tick);
      };
    }
  }, [currentIndex, playlist, fadeState]);

  if (loading) return <div className="text-white flex items-center justify-center h-full">Loading Playlist...</div>;
  if (playlist.length === 0) return <div className="text-white flex items-center justify-center h-full">No active schedule.</div>;

  const currentItem = playlist[currentIndex] ?? playlist[0];
  if (!currentItem) return <div className="text-white flex items-center justify-center h-full">Updating playlist…</div>;

  const opacity = fadeState === 'visible' ? 1 : 0;

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-black overflow-hidden">
      {/* Offline Indicator */}
      {isOffline && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-black/60 backdrop-blur-sm border border-orange-400/30 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-orange-300 text-[10px] font-black uppercase tracking-widest">離線快取</span>
        </div>
      )}

      {/* Media Layer */}
      <div
        style={{ opacity, transition: 'opacity 0.3s ease-in-out', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {currentItem.type === 'IMAGE' ? (
          <img src={currentItem.url} className="w-full h-full object-contain" alt="display" />
        ) : (
          <video
            key={currentItem.id}
            ref={videoRef}
            src={currentItem.url}
            className="w-full h-full object-contain"
            autoPlay
            muted
            onEnded={() => transitionTo((currentIndex + 1) % playlist.length)}
            onError={() => transitionTo((currentIndex + 1) % playlist.length)}
            onTimeUpdate={() => {
              const v = videoRef.current;
              if (v && v.duration) setVideoProgress(v.currentTime / v.duration);
            }}
          />
        )}
      </div>

      {/* HUD Overlay */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          opacity: hudVisible ? 1 : 0,
          transition: 'opacity 0.6s ease-in-out',
        }}
      >
        {/* Progress bar */}
        <div className="h-1 bg-white/10 w-full">
          <div
            className="h-1 bg-white/70 transition-all duration-200"
            style={{
              width: currentItem.type === 'IMAGE'
                ? `${((currentItem.duration - imageTimeLeft) / currentItem.duration) * 100}%`
                : `${videoProgress * 100}%`,
            }}
          />
        </div>

        {/* Info pill */}
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-3 bg-black/50 backdrop-blur-md border border-white/10 px-5 py-2.5 rounded-full">
            <span className="text-white/50 text-[10px] font-black uppercase tracking-widest">
              {currentItem.type === 'IMAGE' ? 'IMAGE' : 'VIDEO'}
            </span>
            <span className="text-white/20">•</span>
            <span className="text-white/80 text-xs font-bold truncate max-w-[300px]">{currentItem.name}</span>
            <span className="text-white/20">•</span>
            <span className="text-white/50 text-[10px] font-black">
              {currentIndex + 1} / {playlist.length}
            </span>
            {currentItem.type === 'IMAGE' && (
              <>
                <span className="text-white/20">•</span>
                <span className="text-white/50 text-[10px] font-black">{imageTimeLeft}s</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Preload next image */}
      {playlist[(currentIndex + 1) % playlist.length]?.type === 'IMAGE' && (
        <link rel="preload" as="image" href={playlist[(currentIndex + 1) % playlist.length].url} />
      )}
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={<div className="text-white flex items-center justify-center h-full">Loading...</div>}>
      <PlayerContent />
    </Suspense>
  );
}
