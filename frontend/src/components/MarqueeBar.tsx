'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────────
export interface MarqueeItemConfig {
  title?: string;
  titleBgColor?: string;
  textColor?: string;
  contentType?: 'manual' | 'news' | 'weather';
  content?: string;
  newsUrl?: string;
  scrolling?: boolean;
  marqueeSpeed?: number; // seconds each news item stays
  showClock?: boolean;
  clockBgColor?: string;
  clockTextColor?: string;
  bgImageUrl?: string | null;
  bgColor?: string;
  titleTextColor?: string;
  // Weather
  city?: string;
  lat?: string;
  lon?: string;
}

export interface MarqueeItem {
  assetId: string;
  name: string;
  duration: number; // seconds this marquee stays before rotating
  config: MarqueeItemConfig;
}

interface MarqueeBarProps {
  items: MarqueeItem[];
  transition?: string; // FADE | SLIDE_UP | NONE
}

// ─── Clock (24h, no blinking colon) ─────────────────────────────────────────────
function Clock24({ textColor }: { textColor: string }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      const s = now.getSeconds().toString().padStart(2, '0');
      setTime(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className="font-black tracking-wider whitespace-nowrap tabular-nums"
      style={{ color: textColor, fontSize: 'clamp(18px, 2vw, 32px)' }}
    >
      {time}
    </span>
  );
}

// ─── News Ticker (vertical scroll) ──────────────────────────────────────────────
function NewsTicker({
  items,
  speed,
  scrolling,
  textColor,
}: {
  items: string[];
  speed: number;
  scrolling: boolean;
  textColor: string;
}) {
  const [idx, setIdx] = useState(0);
  const [animClass, setAnimClass] = useState('');

  useEffect(() => {
    if (!scrolling || items.length <= 1) return;
    const interval = setInterval(() => {
      setAnimClass('marquee-exit');
      setTimeout(() => {
        setIdx(prev => (prev + 1) % items.length);
        setAnimClass('marquee-enter');
        setTimeout(() => setAnimClass(''), 400);
      }, 400);
    }, speed * 1000);
    return () => clearInterval(interval);
  }, [items.length, speed, scrolling]);

  if (items.length === 0) return null;

  return (
    <div className="relative overflow-hidden h-full flex items-center flex-1 min-w-0 px-6">
      <p
        className={`font-black truncate transition-all duration-400 ${animClass}`}
        style={{ 
          color: textColor,
          fontSize: 'clamp(20px, 1.8vw, 36px)',
          lineHeight: '1.2'
        }}
      >
        {items[idx] || ''}
      </p>
      <style jsx>{`
        .marquee-exit {
          opacity: 0;
          transform: translateY(-100%);
          transition: all 0.4s ease-in;
        }
        .marquee-enter {
          opacity: 0;
          transform: translateY(100%);
          animation: slideIn 0.4s ease-out forwards;
        }
        @keyframes slideIn {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

// ─── Weather Summary ────────────────────────────────────────────────────────────
function useWeatherSummary(lat?: string, lon?: string, city?: string) {
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (!lat || !lon) return;
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Asia%2FTaipei`
        );
        const data = await res.json();
        const temp = Math.round(data.current?.temperature_2m ?? 0);
        const code = data.current?.weather_code ?? 0;
        const desc = weatherCodeToText(code);
        setSummary(`${city || '目前'} ${temp}°C ${desc}`);
      } catch {
        setSummary('天氣資料暫時無法取得');
      }
    };
    fetchWeather();
    const id = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [lat, lon, city]);

  return summary;
}

function RotatingRightBlock({ 
  lat, 
  lon, 
  city, 
  textColor 
}: { 
  lat?: string; 
  lon?: string; 
  city?: string; 
  textColor: string;
}) {
  const [mode, setMode] = useState<'CLOCK' | 'WEATHER'>('CLOCK');
  const weather = useWeatherSummary(lat, lon, city);

  useEffect(() => {
    const id = setInterval(() => {
      setMode(prev => prev === 'CLOCK' ? 'WEATHER' : 'CLOCK');
    }, 15000); // 15s rotation for better readability
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-full overflow-hidden flex flex-col justify-center items-center px-2">
      <div 
        className="transition-transform duration-1000 ease-in-out"
        style={{ transform: mode === 'CLOCK' ? 'translateY(25%)' : 'translateY(-25%)' }}
      >
        <div className="h-[60px] flex items-center justify-center">
          <Clock24 textColor={textColor} />
        </div>
        <div className="h-[60px] flex items-center justify-center">
          <span 
            className="font-black tracking-wider whitespace-nowrap"
            style={{ color: textColor, fontSize: 'clamp(14px, 1.3vw, 26px)' }}
          >
            {weather || 'Loading...'}
          </span>
        </div>
      </div>
    </div>
  );
}

function weatherCodeToText(code: number): string {
  if (code === 0) return '☀️ 晴';
  if (code <= 3) return '⛅ 多雲';
  if (code <= 48) return '🌫️ 霧';
  if (code <= 67) return '🌧️ 雨';
  if (code <= 77) return '❄️ 雪';
  if (code <= 82) return '🌧️ 陣雨';
  if (code <= 86) return '🌨️ 陣雪';
  return '⛈️ 雷雨';
}

// ─── RSS Fetcher ────────────────────────────────────────────────────────────────
function useNewsFeed(url?: string) {
  const [headlines, setHeadlines] = useState<string[]>([]);

  useEffect(() => {
    if (!url) return;
    const fetchNews = async () => {
      try {
        const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&_t=${Date.now()}`;
        const res = await fetch(proxyUrl, { cache: 'no-store' });
        const data = await res.json();
        if (data.items) {
          setHeadlines(data.items.slice(0, 20).map((i: any) => i.title));
        }
      } catch {
        setHeadlines(['新聞讀取中...']);
      }
    };
    fetchNews();
    const id = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [url]);

  return headlines;
}

// ─── Single Marquee Renderer ────────────────────────────────────────────────────
function SingleMarquee({ config }: { config: MarqueeItemConfig }) {
  const {
    title = '',
    titleBgColor = '#b8663e',
    textColor = '#000000',
    contentType = 'manual',
    content = '',
    newsUrl = '',
    scrolling = true,
    marqueeSpeed = 10,
    showClock = true,
    clockBgColor = '#ec6715',
    clockTextColor = '#FFFFFF',
    bgImageUrl = null,
    bgColor = '#dee2ca',
    titleTextColor = '#FFFFFF',
    city,
    lat,
    lon,
  } = config;

  const newsHeadlines = useNewsFeed(contentType === 'news' ? newsUrl : undefined);

  // Determine content items
  let contentItems: string[] = [];
  if (contentType === 'news' && newsHeadlines.length > 0) {
    contentItems = newsHeadlines;
  } else if (content) {
    contentItems = content.split('\n').filter(Boolean);
    if (contentItems.length === 0) contentItems = [content];
  } else {
    contentItems = [''];
  }

  return (
    <div
      className="absolute inset-0 font-sans overflow-hidden flex items-stretch"
      style={{
        backgroundColor: bgImageUrl ? 'transparent' : (bgColor === 'transparent' ? '#dee2ca' : bgColor),
        backgroundImage: bgImageUrl ? `url(${bgImageUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* 1. Title Block (Left, Slanted Right) */}
      {title && (
        <div
          className="flex-none flex items-center pl-8 pr-16 z-30"
          style={{ 
            backgroundColor: titleBgColor || '#0b486b',
            clipPath: 'polygon(0 0, 100% 0, calc(100% - 40px) 100%, 0% 100%)',
          }}
        >
          <span 
            className="font-black whitespace-nowrap tracking-wider"
            style={{ 
              color: titleTextColor || '#FFFFFF',
              fontSize: 'clamp(18px, 1.6vw, 32px)'
            }}
          >
            {title}
          </span>
        </div>
      )}

      {/* 2. Content Area (Center) - Flexible */}
      <div 
        className="flex-1 min-w-0 z-10"
        style={{ 
          marginLeft: title ? '-40px' : '0',
          marginRight: showClock ? '-40px' : '0',
          backgroundColor: bgImageUrl ? 'transparent' : (bgColor === 'transparent' ? '#dee2ca' : bgColor),
        }}
      >
        <div className="h-full" style={{ paddingLeft: title ? '40px' : '2rem', paddingRight: showClock ? '40px' : '2rem' }}>
          <NewsTicker
            items={contentItems}
            speed={marqueeSpeed}
            scrolling={scrolling}
            textColor={textColor || '#000000'}
          />
        </div>
      </div>

      {/* 3. Clock & Weather Block (Right, Slanted Left) */}
      {showClock && (
        <div 
          className="flex-none flex items-center pl-16 pr-8 z-30"
          style={{ 
            backgroundColor: clockBgColor,
            clipPath: 'polygon(40px 0, 100% 0, 100% 100%, 0% 100%)',
          }}
        >
          <RotatingRightBlock 
            lat={lat} 
            lon={lon} 
            city={city} 
            textColor={clockTextColor || '#FFFFFF'} 
          />
        </div>
      )}
    </div>
  );
}

// ─── Main MarqueeBar ────────────────────────────────────────────────────────────
export default function MarqueeBar({ items, transition = 'FADE' }: MarqueeBarProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [fadeState, setFadeState] = useState<'visible' | 'fading-out' | 'fading-in'>('visible');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Multi-item rotation
  useEffect(() => {
    if (items.length <= 1) return;

    const currentItem = items[activeIdx];
    if (!currentItem) return;

    timerRef.current = setTimeout(() => {
      if (transition === 'NONE') {
        setActiveIdx(prev => (prev + 1) % items.length);
      } else {
        setFadeState('fading-out');
        setTimeout(() => {
          setActiveIdx(prev => (prev + 1) % items.length);
          setFadeState('fading-in');
          setTimeout(() => setFadeState('visible'), 400);
        }, 400);
      }
    }, currentItem.duration * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeIdx, items, transition]);

  if (items.length === 0) return null;

  const currentItem = items[activeIdx];
  if (!currentItem) return null;

  const getOpacity = () => {
    if (transition === 'NONE') return 1;
    return fadeState === 'visible' ? 1 : 0;
  };

  const getTransform = () => {
    if (transition === 'SLIDE_UP') {
      if (fadeState === 'fading-out') return 'translateY(-100%)';
      if (fadeState === 'fading-in') return 'translateY(100%)';
    }
    return 'translateY(0)';
  };

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 overflow-hidden"
      style={{ height: 60 }}
    >
      <div
        className="w-full h-full relative"
        style={{
          opacity: getOpacity(),
          transform: getTransform(),
          transition: transition === 'NONE' ? 'none' : 'all 0.4s ease-in-out',
        }}
      >
        <SingleMarquee config={currentItem.config} />
      </div>
    </div>
  );
}
