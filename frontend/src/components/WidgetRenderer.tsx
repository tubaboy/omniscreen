'use client';

import { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

export type WidgetType = 'DASHBOARD';

export interface DashboardConfig {
  // Clock
  showDate?: boolean;
  showSeconds?: boolean;
  // Weather
  lat?: number;
  lon?: number;
  city?: string;
  // Announcement
  title?: string;
  content?: string;
  scrolling?: boolean;
  bgColor?: string;
  textColor?: string;
  contentType?: 'manual' | 'news';
}

export interface WidgetConfig {
  widgetType: WidgetType;
  config: DashboardConfig;
}

// ─── Weather Helpers ──────────────────────────────────────────────────────

const WMO_CODES: Record<number, { label: string; emoji: string }> = {
  0: { label: '晴天', emoji: '☀️' },
  1: { label: '大致晴天', emoji: '🌤️' },
  2: { label: '局部多雲', emoji: '⛅' },
  3: { label: '陰天', emoji: '☁️' },
  45: { label: '霧', emoji: '🌫️' },
  48: { label: '淞霧', emoji: '🌫️' },
  51: { label: '毛毛雨', emoji: '🌦️' },
  53: { label: '毛毛雨', emoji: '🌦️' },
  55: { label: '毛毛雨', emoji: '🌦️' },
  61: { label: '小雨', emoji: '🌧️' },
  63: { label: '中雨', emoji: '🌧️' },
  65: { label: '大雨', emoji: '🌧️' },
  71: { label: '小雪', emoji: '🌨️' },
  73: { label: '中雪', emoji: '❄️' },
  80: { label: '陣雨', emoji: '🌦️' },
  85: { label: '陣雪', emoji: '🌨️' },
  95: { label: '雷雨', emoji: '⛈️' },
  99: { label: '強雷雨', emoji: '⛈️' },
};

interface WeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
}

// ─── Dashboard Widget (3-in-1 UI-UX-Pro-Max) ──────────────────────────────

function DashboardWidget({ config }: { config: DashboardConfig }) {
  const {
    showDate = true,
    showSeconds = true,
    lat = 25.04,
    lon = 121.51,
    city = '台北市',
    title = '焦點公告',
    content = '',
    scrolling = true,
    bgColor = '#0f172a',
    textColor = '#ffffff',
    contentType = 'manual',
  } = config;

  // Clock State
  const [now, setNow] = useState(new Date());
  
  // Weather State
  const [weather, setWeather] = useState<WeatherData | null>(null);
  
  // Marquee State
  const [newsContent, setNewsContent] = useState<string>('');
  const [loadingNews, setLoadingNews] = useState(false);

  // Clock Effect
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Weather Effect
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FTaipei&forecast_days=1`;
        const res = await fetch(url);
        const data = await res.json();
        setWeather({
          temp: Math.round(data.current.temperature_2m),
          feelsLike: Math.round(data.current.apparent_temperature),
          humidity: data.current.relative_humidity_2m,
          windSpeed: Math.round(data.current.wind_speed_10m),
          weatherCode: data.current.weather_code,
          tempMax: Math.round(data.daily.temperature_2m_max[0]),
          tempMin: Math.round(data.daily.temperature_2m_min[0]),
        });
      } catch (e) {
        console.error('Weather fetch error', e);
      }
    };
    fetchWeather();
    const t = setInterval(fetchWeather, 10 * 60 * 1000); // 10 minutes
    return () => clearInterval(t);
  }, [lat, lon]);

  // News Fetching Effect
  useEffect(() => {
    if (contentType !== 'news') return;

    const fetchNews = async () => {
      setLoadingNews(true);
      try {
        // Use rss2json to parse Google News RSS for Taiwan
        const rssUrl = encodeURIComponent('https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant');
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
        const data = await res.json();
        if (data.status === 'ok' && data.items) {
          const titles = data.items.map((item: any) => item.title.split(' - ')[0]).join(' ｜ ');
          setNewsContent(titles);
        }
      } catch (e) {
        console.error('Failed to fetch news', e);
        setNewsContent('暫時無法取得新聞資料');
      } finally {
        setLoadingNews(false);
      }
    };

    fetchNews();
    const t = setInterval(fetchNews, 30 * 60 * 1000); // 30 minutes
    return () => clearInterval(t);
  }, [contentType]);

  const displayContent = contentType === 'news' ? (newsContent || (loadingNews ? '新聞讀取中...' : '')) : content;

  // Marquee Effect - Removed setInterval offset, using CSS animation for better performance
  // No longer need setOffset(x) in a loop


  // Format Time & Date
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const ss = now.getSeconds().toString().padStart(2, '0');
  const dateStr = now.toLocaleDateString('zh-TW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  const wmo = weather ? (WMO_CODES[weather.weatherCode] ?? { label: '未知', emoji: '🌡️' }) : null;

  return (
    <div className="w-full h-full relative overflow-hidden text-white flex flex-col font-sans" style={{ background: '#050505' }}>
      
      {/* ─── Mesh Gradient Background Animations ─── */}
      <div className="absolute inset-0 pointer-events-none opacity-80 mix-blend-screen" style={{ zIndex: 0 }}>
        <div className="absolute -top-[40%] -left-[20%] w-[80vw] h-[80vw] max-w-[1200px] max-h-[1200px] rounded-full bg-violet-600/30 blur-[120px] animate-[pulse_8s_ease-in-out_infinite_alternate]" />
        <div className="absolute top-[20%] -right-[20%] w-[70vw] h-[70vw] max-w-[1000px] max-h-[1000px] rounded-full bg-blue-500/20 blur-[100px] animate-[pulse_10s_ease-in-out_infinite_alternate_reverse]" />
        <div className="absolute -bottom-[30%] left-[20%] w-[60vw] h-[60vw] max-w-[900px] max-h-[900px] rounded-full bg-emerald-500/20 blur-[120px] animate-[pulse_12s_ease-in-out_infinite_alternate]" />
      </div>

      {/* ─── Main Content Area (Glassmorphism layout) ─── */}
      <div className="relative z-10 flex-1 w-full flex flex-col pt-12 px-12 md:px-20 lg:px-24">
        
        {/* Top Grid: Clock (Left) & Weather (Right) */}
        <div className="flex-1 flex flex-col md:flex-row items-center justify-between gap-12 w-full h-full max-h-[calc(100%-140px)]">
          
          {/* Left Side: Giant Clock */}
          <div className="flex-1 flex flex-col justify-center items-start drop-shadow-2xl">
            <div className="flex items-baseline font-black tracking-tighter tabular-nums leading-none mb-4">
              <span style={{ fontSize: 'clamp(120px, 20vw, 320px)', textShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                {hh}
              </span>
              <span className="opacity-60" style={{ fontSize: 'clamp(100px, 15vw, 240px)', animation: 'clockBlink 1s step-end infinite' }}>:</span>
              <span style={{ fontSize: 'clamp(120px, 20vw, 320px)', textShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                {mm}
              </span>
              {showSeconds && (
                <span className="opacity-40 ml-4 font-bold" style={{ fontSize: 'clamp(40px, 6vw, 100px)' }}>
                  {ss}
                </span>
              )}
            </div>
            
            {showDate && (
              <div className="mt-4 px-8 py-4 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 shadow-xl inline-block">
                <span className="font-bold tracking-widest text-white/90 uppercase" style={{ fontSize: 'clamp(20px, 3vw, 42px)' }}>
                  {dateStr}
                </span>
              </div>
            )}
          </div>

          {/* Right Side: Glass Weather Card */}
          <div className="w-full max-w-lg lg:max-w-2xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] rounded-[40px] p-10 flex flex-col h-fit">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">📍</span>
              <span className="text-3xl lg:text-5xl font-black text-white/90 tracking-widest uppercase">{city}</span>
            </div>
            
            {weather && wmo ? (
              <>
                <div className="flex items-center gap-8 mb-10">
                  <span style={{ fontSize: 'clamp(80px, 12vw, 180px)', filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.3))' }}>
                    {wmo.emoji}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-black tabular-nums tracking-tighter" style={{ fontSize: 'clamp(80px, 10vw, 140px)', lineHeight: 0.9 }}>
                      {weather.temp}°
                    </span>
                    <span className="text-3xl lg:text-5xl font-bold text-white/70 mt-2">
                      {wmo.label}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full bg-black/20 rounded-[28px] p-6 border border-white/5">
                  {[
                    { label: '體感', value: `${weather.feelsLike}°C` },
                    { label: '濕度', value: `${weather.humidity}%` },
                    { label: '最高', value: `${weather.tempMax}°C` },
                    { label: '最低', value: `${weather.tempMin}°C` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col items-center justify-center p-2">
                      <span className="text-white/40 text-sm lg:text-lg font-bold tracking-widest mb-1">{label}</span>
                      <span className="text-white font-black text-xl lg:text-3xl">{value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center opacity-50 space-y-4">
                <div className="w-16 h-16 border-4 border-whtie/20 border-t-white/80 rounded-full animate-spin" />
                <p className="text-2xl font-bold animate-pulse mt-4">同步氣象資料中…</p>
              </div>
            )}
          </div>
          
        </div>
      </div>

      {/* ─── Bottom Announcement Marquee ─── */}
      {displayContent && (
        <div 
          className="relative z-20 w-full h-[120px] lg:h-[160px] flex items-center overflow-hidden border-t shadow-2xl shrink-0"
          style={{ 
            backgroundColor: `${bgColor}CC`, // 80% opacity transparent hex
            backdropFilter: 'blur(24px)',
            borderColor: 'rgba(255,255,255,0.1)'
          }}
        >
          {/* Title Badge with Background Fade */}
          <div 
            className="absolute left-0 top-0 bottom-0 z-30 flex items-center px-12 lg:px-16" 
            style={{ 
              background: `linear-gradient(90deg, ${bgColor} 85%, transparent)`,
              width: '450px' // Increased width for the fade effect
            }}
          >
            {title && (
              <span className="font-black text-4xl lg:text-6xl tracking-widest uppercase px-6 py-2 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-md" style={{ color: textColor, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                {title}
              </span>
            )}
          </div>
          
          <div className="flex-1 w-full h-full relative overflow-hidden flex items-center">
            {scrolling ? (
              <div 
                className="flex whitespace-nowrap animate-marquee-text"
                style={{ 
                  color: textColor,
                  textShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
              >
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center shrink-0 pr-[400px]">
                    <span style={{ fontSize: displayContent.length > 50 ? 'clamp(32px, 4vw, 60px)' : 'clamp(40px, 5vw, 80px)', fontWeight: 900 }}>
                      {displayContent}
                    </span>
                    <span className="opacity-30 px-20 text-6xl">•</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full h-full flex items-center px-12 pl-[460px]">
                  <p 
                    className="font-bold truncate"
                    style={{ 
                      fontSize: displayContent.length > 50 ? 'clamp(32px, 3.5vw, 60px)' : 'clamp(36px, 4vw, 70px)', 
                      color: textColor,
                      textShadow: '0 4px 12px rgba(0,0,0,0.2)' 
                    }}
                  >
                    {displayContent}
                  </p>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes clockBlink { 0%,100%{opacity:.6} 50%{opacity:.1} }
        @keyframes marqueeScroll {
          0% { transform: translateX(400px); }
          100% { transform: translateX(calc(-50% + 200px)); }
        }
        .animate-marquee-text {
          animation: marqueeScroll 25s linear infinite;
        }
      `}</style>
    </div>
  );
}

// ─── Main WidgetRenderer ──────────────────────────────────────────────────

export default function WidgetRenderer({ widgetConfig }: { widgetConfig: WidgetConfig }) {
  if (!widgetConfig || widgetConfig.widgetType !== 'DASHBOARD') return null;
  return <DashboardWidget config={widgetConfig.config} />;
}
