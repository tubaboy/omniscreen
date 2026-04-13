'use client';

import { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Volume2, VolumeX } from 'lucide-react';
import YouTube from 'react-youtube';
import api from '@/lib/api';
import WidgetRenderer, { WidgetConfig } from '@/components/WidgetRenderer';

import { savePlaylist, loadPlaylist, precacheUrls } from '@/hooks/useOfflinePlaylist';

interface PlaylistItem {
  id: string;
  assetId?: string;
  scheduleId?: string;
  name: string;
  type: 'IMAGE' | 'VIDEO' | 'WIDGET' | 'WEB' | 'YOUTUBE';
  url: string | null;
  duration: number;
  widgetConfig?: WidgetConfig;
  transition?: string;
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
  const [isMuted, setIsMuted] = useState(true);
  const [autoPlayError, setAutoPlayError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Increments each time a single-item IMAGE/WIDGET/WEB completes a cycle, triggering the timer effect to restart
  const [singleItemTick, setSingleItemTick] = useState(0);

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

  // YouTube Live detection state
  const [ytIsLive, setYtIsLive] = useState(false);
  const ytTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ytLiveStartRef = useRef<number>(0);
  const ytLiveTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize mute state from localStorage (user override takes priority)
  useEffect(() => {
    const savedMute = localStorage.getItem(`player_${screenId}_muted`);
    if (savedMute !== null) {
      setIsMuted(savedMute !== 'false');
    }
    // If no localStorage entry, server default will be applied on first poll
  }, [screenId]);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    localStorage.setItem(`player_${screenId}_muted`, String(nextMuted));
    setAutoPlayError(false);

    // Try to play if unmuting manually
    if (!nextMuted && videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
  };

  // Synchronize YouTube iframe mute state
  useEffect(() => {
    const iframe = document.getElementById('youtube-player') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      if (isMuted) {
        iframe.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
      } else {
        iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
        iframe.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[100]}', '*');
      }
    }
  }, [isMuted, currentIndex]); // Run on mute change or slide change

  // Unified playback log helper — all API calls go through here
  const logPlayback = useCallback((item: PlaylistItem, duration: number) => {
    if (!screenId || isOffline || !item) return;
    api.post('/logs/playback', {
      screenId,
      assetId: item.assetId || item.id,
      scheduleId: item.scheduleId,
      duration: Math.round(Math.max(0, duration)),
      status: 'SUCCESS'
    }, { headers: { 'X-Screen-Id': screenId } }).catch(err => console.error('Failed to log playback', err));
  }, [screenId, isOffline]);

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

  // Cleanup YouTube live timer whenever index changes or component unmounts
  const clearYtLiveTimer = useCallback(() => {
    if (ytTimerRef.current) { clearTimeout(ytTimerRef.current); ytTimerRef.current = null; }
    if (ytLiveTickRef.current) { clearInterval(ytLiveTickRef.current); ytLiveTickRef.current = null; }
    setYtIsLive(false);
  }, []);

  const transitionTo = useCallback((nextIndex: number) => {
    if (fadeState !== 'visible') return;

    // Log the current item playback before transitioning
    const currentItem = playlist[currentIndex];
    if (currentItem) {
      const durationPlay = currentItem.type === 'IMAGE' || currentItem.type === 'WIDGET' || currentItem.type === 'WEB'
        ? currentItem.duration
        : currentItem.type === 'YOUTUBE' && ytTimerRef.current
          ? (Date.now() - ytLiveStartRef.current) / 1000
          : (videoRef.current ? videoRef.current.currentTime : 0);
      logPlayback(currentItem, durationPlay);
    }

    // Special case: Single video looping seamless (avoid black flash and browser autoplay hurdles)
    if (playlist.length === 1 && currentItem?.type === 'VIDEO') {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(err => {
          console.warn('Seamless loop play failed, trying muted', err);
          setIsMuted(true);
          if (videoRef.current) videoRef.current.play().catch(console.error);
        });
      }
      return;
    }

    // Cleanup YT live timer before transitioning
    clearYtLiveTimer();

    if (timerRef.current) clearTimeout(timerRef.current);
    pendingIndexRef.current = nextIndex;
    setRefreshKey(prev => prev + 1);
    setFadeState('fading-out');
  }, [fadeState, playlist, currentIndex, logPlayback, clearYtLiveTimer]);

  const next = useCallback(() => {
    const nextIdx = playlist.length > 0 ? (currentIndex + 1) % playlist.length : 0;
    transitionTo(nextIdx);
  }, [playlist.length, currentIndex, transitionTo]);

  useEffect(() => {
    let currentInterval = 10000;
    let autoSnapshotIntervalMin = 30; // 預設 30 分鐘
    let lastSnapshotTime = Date.now(); // 記錄上次截圖時間
    let isCurrentlyOffline = false; // 用於 heartbeat 內部判斷，避免閉包時抓到舊的 state
    let pollTimeout: NodeJS.Timeout;
    let isCancelled = false;

    // Build system info once
    const getSystemInfo = () => ({
      userAgent: navigator.userAgent,
      screenWidth: screen.width,
      screenHeight: screen.height,
      platform: navigator.platform,
      language: navigator.language,
      devicePixelRatio: window.devicePixelRatio,
    });

    const takeAndUploadSnapshot = async () => {
      try {
        const htmlToImage = await import('html-to-image');
        const dataUrl = await htmlToImage.toJpeg(document.body, {
          quality: 0.6,
          fontEmbedCSS: '', // 忽略強制掃描外部字體/樣式表，避免拋出 cssRules 的 SecurityError
          // Force dimension calculation to avoid data:, (0x0) empty output due to absolute positioned player wrapping
          width: window.innerWidth,
          height: window.innerHeight,
          canvasWidth: Math.floor(window.innerWidth / 2),
          canvasHeight: Math.floor(window.innerHeight / 2),
          filter: (node) => {
            const tag = (node as HTMLElement).tagName?.toUpperCase();
            if (tag === 'IFRAME' || tag === 'VIDEO') return false; // iframe 與 video 不截圖以保證程式不死機
            return true;
          }
        });
        
        if (screenId) {
          await api.post(`/screens/${screenId}/snapshot`, { image: dataUrl }, {
            headers: { 'X-Screen-Id': screenId },
          });
          console.log('[Snapshot] Uploaded successfully');
        }
      } catch (err: any) {
        console.error('[Snapshot] Failed:', err);
      }
    };

    // Handle remote commands from server
    const handleCommands = async (commands: { id: string; type: string }[]) => {
      for (const cmd of commands) {
        switch (cmd.type) {
          case 'RELOAD':
            console.log('[Remote] Reload command received');
            window.location.reload();
            return; // reload stops everything
          case 'SNAPSHOT':
            console.log('[Remote] Snapshot command received');
            await takeAndUploadSnapshot();
            lastSnapshotTime = Date.now(); // 重置自動計時器
            break;
          case 'CLEAR_CACHE':
            console.log('[Remote] Clear cache command received');
            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (const reg of registrations) await reg.unregister();
              const cacheNames = await caches.keys();
              for (const name of cacheNames) await caches.delete(name);
              console.log('[Remote] Cache cleared, reloading...');
              window.location.reload();
              return;
            }
            break;
        }
      }
    };

    const pollData = async () => {
      if (isCancelled) return;
      try {
        const [plRes, setRes] = await Promise.allSettled([
          screenId ? api.get(`/playlists/${screenId}`, { headers: { 'X-Screen-Id': screenId } }) : Promise.resolve({ data: [] }),
          api.get('/settings'),
        ]);

        // --- DEBUG INFO INJECTION ---
        if (typeof window !== 'undefined') {
          (window as any).__debug_pl_status = plRes.status;
          (window as any).__debug_set_status = setRes.status;
          if (plRes.status === 'rejected') (window as any).__debug_error = `PL: ${(plRes as any).reason?.response?.status || 'NetError'} ${(plRes as any).reason?.message}`;
          if (setRes.status === 'rejected') (window as any).__debug_error = `SET: ${(setRes as any).reason?.response?.status || 'NetError'} ${(setRes as any).reason?.message}`;
        }
        // ----------------------------

        let networkSuccess = false;

        if (setRes.status === 'fulfilled') {
          const intervalSec = parseInt(setRes.value.data.player_poll_interval || '10');
          currentInterval = Math.max(5000, intervalSec * 1000);
          autoSnapshotIntervalMin = parseInt(setRes.value.data.auto_snapshot_interval || '30');
          setServerHud(setRes.value.data.player_hud !== 'false');
          // Apply server default mute if user hasn't manually overridden
          if (screenId && localStorage.getItem(`player_${screenId}_muted`) === null) {
            const serverMuted = setRes.value.data.player_default_muted !== 'false';
            setIsMuted(serverMuted);
          }
          networkSuccess = true;
          setIsOffline(false);
          isCurrentlyOffline = false;
        }

        if (plRes.status === 'fulfilled' && screenId) {
          const newPlaylist = plRes.value.data as PlaylistItem[];
          networkSuccess = true;
          setIsOffline(false);
          isCurrentlyOffline = false;

          // Safe Cache: 即使硬碟寫入失敗，也不應影響連線狀態
          try {
            if (newPlaylist.length > 0) {
              await savePlaylist(screenId, newPlaylist);
              precacheUrls(newPlaylist.filter(i => i.url).map((item) => item.url as string));
            }
          } catch (cacheErr) {
            console.warn('Silent cache failure:', cacheErr);
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
        }

        if (networkSuccess) {
          setLoading(false);
        } else {
          throw new Error('All network requests failed');
        }
      } catch (err) {
        console.warn('Poll failed, trying IndexedDB cache…', err);
        setIsOffline(true);
        isCurrentlyOffline = true;

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

    // Heartbeat: sends systemInfo and fetches pending commands
    const hbInterval = setInterval(async () => {
      if (!screenId) return;

      // Auto snapshot mechanism
      // 僅在「在線」狀態且達到設定間隔時間時，才執行定時截圖
      if (!isCurrentlyOffline && autoSnapshotIntervalMin > 0 && Date.now() - lastSnapshotTime >= autoSnapshotIntervalMin * 60 * 1000) {
        await takeAndUploadSnapshot();
        lastSnapshotTime = Date.now();
      }

      try {
        const res = await api.post(`/screens/${screenId}/heartbeat`,
          { systemInfo: getSystemInfo() },
          { headers: { 'X-Screen-Id': screenId } }
        );
        // Process any pending commands
        if (res.data?.commands?.length > 0) {
          await handleCommands(res.data.commands);
        }
      } catch {
        // heartbeat failure is non-critical
      }
    }, 20000);

    // Send initial heartbeat immediately
    if (screenId) {
      api.post(`/screens/${screenId}/heartbeat`,
        { systemInfo: getSystemInfo() },
        { headers: { 'X-Screen-Id': screenId } }
      ).then(res => {
        if (res.data?.commands?.length > 0) handleCommands(res.data.commands);
      }).catch(() => {});
    }

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

  // Image / Widget countdown ticker
  useEffect(() => {
    if (playlist.length === 0 || fadeState !== 'visible') return;
    const currentItem = playlist[currentIndex];
    if (!currentItem) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (currentItem.type === 'IMAGE' || currentItem.type === 'WIDGET' || currentItem.type === 'WEB') {
      const dur = currentItem.duration;
      imageStartRef.current = Date.now();
      setImageTimeLeft(dur);
      const tick = setInterval(() => {
        const elapsed = (Date.now() - imageStartRef.current) / 1000;
        const left = Math.max(0, dur - elapsed);
        setImageTimeLeft(Math.ceil(left));
        if (left <= 0) clearInterval(tick);
      }, 200);

      if (playlist.length <= 1) {
        // Single static item: log each completed cycle, then restart via singleItemTick
        timerRef.current = setTimeout(() => {
          clearInterval(tick);
          logPlayback(currentItem, dur);
          setSingleItemTick(c => c + 1);
        }, dur * 1000);
      } else {
        timerRef.current = setTimeout(() => {
          clearInterval(tick);
          transitionTo((currentIndex + 1) % playlist.length);
        }, dur * 1000);
      }

      return () => {
        clearTimeout(timerRef.current!);
        clearInterval(tick);
      };
    }
  }, [currentIndex, playlist, fadeState, singleItemTick, logPlayback, transitionTo]);

  // Cleanup YT live timer on index change
  useEffect(() => {
    return () => { clearYtLiveTimer(); };
  }, [currentIndex, clearYtLiveTimer]);

  // YouTube live detection handler — called from onReady and onStateChange
  const handleYtLiveDetection = useCallback((player: any) => {
    // Already detected and timer running, skip
    if (ytTimerRef.current) return;

    const currentItem = playlist[currentIndex];
    if (!currentItem || currentItem.type !== 'YOUTUBE') return;

    try {
      const ytDuration = player.getDuration();
      // getDuration() returns 0 for live streams, or a very large number for DVR-enabled live
      const isLive = ytDuration === 0 || ytDuration > 86400; // > 24hrs = treat as live
      console.log(`[YT] getDuration()=${ytDuration}, isLive=${isLive}`);

      if (isLive) {
        setYtIsLive(true);
        const dur = currentItem.duration || 120;
        ytLiveStartRef.current = Date.now();
        setImageTimeLeft(dur);

        // Start countdown tick
        ytLiveTickRef.current = setInterval(() => {
          const elapsed = (Date.now() - ytLiveStartRef.current) / 1000;
          const left = Math.max(0, dur - elapsed);
          setImageTimeLeft(Math.ceil(left));
          if (left <= 0 && ytLiveTickRef.current) clearInterval(ytLiveTickRef.current);
        }, 200);

        // Fallback timer to force transition
        if (playlist.length > 1) {
          ytTimerRef.current = setTimeout(() => {
            console.log('[YT Live] Duration reached, transitioning to next');
            transitionTo((currentIndex + 1) % playlist.length);
          }, dur * 1000);
        } else {
          // Single YT live item: log and restart cycle
          ytTimerRef.current = setTimeout(() => {
            console.log('[YT Live] Single item cycle complete, logging');
            logPlayback(currentItem, dur);
            clearYtLiveTimer();
            setSingleItemTick(c => c + 1);
          }, dur * 1000);
        }
      }
    } catch (err) {
      console.warn('[YT] getDuration() failed:', err);
    }
  }, [playlist, currentIndex, transitionTo, logPlayback, clearYtLiveTimer]);

  const getTransitionStyle = (effect: string = 'FADE', state: string) => {
    const baseTransition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    const styles: React.CSSProperties = {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: baseTransition,
    };

    if (effect === 'NONE') {
      styles.opacity = state === 'visible' ? 1 : 0;
      styles.transition = 'none'; // 瞬間切換
      return styles;
    }

    if (effect === 'SLIDE_LEFT') {
      styles.opacity = state === 'visible' ? 1 : 0;
      styles.transform = state === 'fading-in' ? 'translateX(100%)' : state === 'fading-out' ? 'translateX(-100%)' : 'translateX(0)';
      return styles;
    }

    if (effect === 'BLUR_FADE') {
      styles.opacity = state === 'visible' ? 1 : 0;
      styles.filter = state === 'visible' ? 'blur(0px)' : 'blur(10px)';
      return styles;
    }

    if (effect === 'ZOOM_FADE') {
      styles.opacity = state === 'visible' ? 1 : 0;
      styles.transform = state === 'fading-in' ? 'scale(1.1)' : state === 'fading-out' ? 'scale(0.9)' : 'scale(1)';
      return styles;
    }

    // Default: FADE
    styles.opacity = state === 'visible' ? 1 : 0;
    return styles;
  };

  if (loading) return <div className="text-white flex items-center justify-center h-full">Loading Playlist...</div>;
  if (playlist.length === 0) return <div className="text-white flex items-center justify-center h-full">No active schedule.</div>;

  const currentItem = playlist[currentIndex] ?? playlist[0];
  if (!currentItem) return <div className="text-white flex items-center justify-center h-full">Updating playlist…</div>;

  const opacity = fadeState === 'visible' ? 1 : 0;

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-black overflow-hidden">
      {/* Offline Indicator & Debug Panel */}
      {isOffline && (
        <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2">
           <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm border border-orange-400/30 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-orange-300 text-[10px] font-black uppercase tracking-widest">離線快取</span>
          </div>
          
          <div className="bg-black/80 p-4 rounded-2xl border border-white/10 text-[10px] text-white/50 font-mono text-right max-w-sm space-y-1 shadow-2xl">
            <p className="text-blue-400 font-bold border-b border-white/5 pb-1 mb-1">NETWORK DIAGNOSTICS</p>
            <p>CLIENT_HOST: {typeof window !== 'undefined' ? window.location.hostname : '...'}</p>
            <p>SCREEN_ID: {screenId || 'NULL'}</p>
            <p className={ (window as any).__debug_pl_status === 'fulfilled' ? 'text-green-400' : 'text-red-400' }>
              PLAYLIST: {(window as any).__debug_pl_status || 'WAITING'}
            </p>
            <p className={ (window as any).__debug_set_status === 'fulfilled' ? 'text-green-400' : 'text-red-400' }>
              SETTINGS: {(window as any).__debug_set_status || 'WAITING'}
            </p>
            { (window as any).__debug_error && (
              <p className="text-orange-500 bg-orange-500/10 p-1 px-2 rounded mt-2 text-[9px] break-all">
                ⚠️ {(window as any).__debug_error}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Media Layer */}
      <div
        key={`${currentIndex}-${refreshKey}`}
        style={getTransitionStyle(currentItem.transition, fadeState)}
      >
        {currentItem.type === 'WIDGET' ? (
          <WidgetRenderer widgetConfig={currentItem.widgetConfig!} />
        ) : currentItem.type === 'WEB' ? (
          <iframe src={currentItem.url!} className="w-full h-full border-0 bg-white" title={currentItem.name} />
        ) : currentItem.type === 'YOUTUBE' ? (
          <YouTube
            id="youtube-player"
            key={currentItem.id}
            videoId={currentItem.url!}
            opts={{
              width: '100%',
              height: '100%',
              playerVars: {
                autoplay: 1,
                mute: isMuted ? 1 : 0,
                controls: 0,
                disablekb: 1,
                rel: 0,
                modestbranding: 1,
                playsinline: 1,
                loop: playlist.length === 1 && !ytIsLive ? 1 : 0,
                playlist: playlist.length === 1 && !ytIsLive ? currentItem.url! : undefined,
              }
            }}
            className="w-full h-full border-0 pointer-events-none"
            onEnd={() => {
              // Clear live timer if it was set (shouldn't fire for live, but safety)
              clearYtLiveTimer();
              if (playlist.length > 1) {
                transitionTo((currentIndex + 1) % playlist.length);
              } else {
                logPlayback(currentItem, 0);
              }
            }}
            onError={() => {
              clearYtLiveTimer();
              if (playlist.length > 1) transitionTo((currentIndex + 1) % playlist.length);
            }}
            onReady={(e) => {
              if (isMuted) e.target.mute(); else e.target.unMute();
              // Attempt live detection on ready
              handleYtLiveDetection(e.target);
            }}
            onStateChange={(e) => {
              // State 1 = PLAYING — best time to re-check duration (some live streams report 0 only after buffering)
              if (e.data === 1) {
                handleYtLiveDetection(e.target);
              }
            }}
          />
        ) : currentItem.type === 'IMAGE' ? (
          <img src={currentItem.url!} className="w-full h-full object-contain" alt="display" />
        ) : (
          <video
            key={`${currentItem.id}-${refreshKey}`}
            ref={videoRef}
            src={currentItem.url!}
            className="w-full h-full object-contain"
            autoPlay
            muted={isMuted}
            playsInline
            onEnded={() => transitionTo((currentIndex + 1) % playlist.length)}
            onError={() => transitionTo((currentIndex + 1) % playlist.length)}
            onPlay={() => {
              // If unmuted but browser blocked sound, handle it
              if (!isMuted && videoRef.current) {
                videoRef.current.play().catch(err => {
                  console.warn('Autoplay with sound blocked, falling back to muted', err);
                  setIsMuted(true);
                  setAutoPlayError(true);
                });
              }
            }}
            onTimeUpdate={() => {
              const v = videoRef.current;
              if (v && v.duration) setVideoProgress(v.currentTime / v.duration);
            }}
          />
        )}
      </div>

      {/* Sound Toggle Button */}
      {currentItem.type === 'VIDEO' && currentItem.url && (
        <div className="absolute top-4 left-4 z-50 transition-all">
          <button
            onClick={toggleMute}
            className={`flex items-center gap-3 px-5 py-3 rounded-full backdrop-blur-md border transition-all shadow-2xl ${isMuted
              ? 'bg-red-500/20 text-red-100 border-red-500/30 animate-bounce'
              : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
              }`}
          >
            {isMuted ? (
              <>
                <div className="relative">
                  <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-20"></div>
                  <VolumeX size={20} className="relative z-10" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest">點擊開啟聲音</span>
              </>
            ) : (
              <Volume2 size={20} />
            )}
          </button>
        </div>
      )}

      {autoPlayError && isMuted && (
        <div className="absolute inset-x-0 top-20 flex justify-center z-50 pointer-events-none">
          <div className="bg-orange-500/20 backdrop-blur-md border border-orange-500/30 px-6 py-3 rounded-2xl animate-in slide-in-from-top-4 duration-500">
            <p className="text-orange-200 text-xs font-bold tracking-tight">瀏覽器已封鎖自動聲音，請點擊左上方按鈕開啟。</p>
          </div>
        </div>
      )}


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
              width: currentItem.type === 'IMAGE' || currentItem.type === 'WIDGET' || currentItem.type === 'WEB'
                ? `${((currentItem.duration - imageTimeLeft) / currentItem.duration) * 100}%`
                : currentItem.type === 'YOUTUBE' && ytIsLive
                  ? `${((currentItem.duration - imageTimeLeft) / currentItem.duration) * 100}%`
                  : `${videoProgress * 100}%`,
            }}
          />
        </div>

        {/* Info pill */}
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-3 bg-black/50 backdrop-blur-md border border-white/10 px-5 py-2.5 rounded-full">
            <span className="text-white/50 text-[10px] font-black uppercase tracking-widest">
              {currentItem.type === 'IMAGE' ? 'IMAGE' : currentItem.type === 'WIDGET' ? 'WIDGET' : currentItem.type === 'WEB' ? 'WEB_PAGE' : currentItem.type === 'YOUTUBE' ? 'YOUTUBE' : 'VIDEO'}
            </span>
            {/* YouTube LIVE badge */}
            {currentItem.type === 'YOUTUBE' && ytIsLive && (
              <>
                <span className="text-white/20">•</span>
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400">LIVE</span>
                </span>
              </>
            )}
            <span className="text-white/20">•</span>
            <span className="text-white/80 text-xs font-bold truncate max-w-[300px]">{currentItem.name}</span>
            <span className="text-white/20">•</span>
            <span className="text-white/50 text-[10px] font-black">
              {currentIndex + 1} / {playlist.length}
            </span>
            {(currentItem.type === 'IMAGE' || currentItem.type === 'WIDGET' || currentItem.type === 'WEB') && (
              <>
                <span className="text-white/20">•</span>
                <span className="text-white/50 text-[10px] font-black">{imageTimeLeft}s</span>
              </>
            )}
            {/* YouTube Live countdown */}
            {currentItem.type === 'YOUTUBE' && ytIsLive && (
              <>
                <span className="text-white/20">•</span>
                <span className="text-red-400/80 text-[10px] font-black">{imageTimeLeft}s</span>
              </>
            )}
            {(currentItem.type === 'VIDEO' || currentItem.type === 'YOUTUBE') && (
              <>
                <span className="text-white/20">•</span>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                  className="flex items-center justify-center p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
                  title={isMuted ? "取消靜音" : "靜音"}
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Preload next image */}
      {playlist[(currentIndex + 1) % playlist.length]?.type === 'IMAGE' && playlist[(currentIndex + 1) % playlist.length]?.url && (
        <link rel="preload" as="image" href={playlist[(currentIndex + 1) % playlist.length].url!} />
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
