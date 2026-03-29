'use client';

import { useEffect, useState, useRef } from 'react';

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
  bgImageUrl?: string | null;
  contentType?: 'manual' | 'news';
  newsUrl?: string;
  marqueeSpeed?: number;
}

export interface WidgetConfig {
  widgetType: WidgetType;
  config: DashboardConfig;
}

// ─── Weather Helpers ──────────────────────────────────────────────────────

const WMO_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: '晴天', icon: 'wb_sunny' },
  1: { label: '大致晴天', icon: 'partly_cloudy_day' },
  2: { label: '局部多雲', icon: 'cloud' },
  3: { label: '陰天', icon: 'cloud' },
  45: { label: '霧', icon: 'foggy' },
  48: { label: '淞霧', icon: 'foggy' },
  51: { label: '毛毛雨', icon: 'rainy' },
  53: { label: '毛毛雨', icon: 'rainy' },
  55: { label: '毛毛雨', icon: 'rainy' },
  61: { label: '小雨', icon: 'rainy_light' },
  63: { label: '中雨', icon: 'rainy_heavy' },
  65: { label: '大雨', icon: 'rainy_heavy' },
  71: { label: '小雪', icon: 'ac_unit' },
  73: { label: '中雪', icon: 'ac_unit' },
  80: { label: '陣雨', icon: 'rainy' },
  85: { label: '陣雪', icon: 'ac_unit' },
  95: { label: '雷雨', icon: 'thunderstorm' },
  99: { label: '強雷雨', icon: 'thunderstorm' },
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

// ─── Dashboard Widget (Elegant Signage Style) ──────────────────────────────

function DashboardWidget({ config }: { config: DashboardConfig }) {
  const {
    showDate = true,
    showSeconds = true,
    lat = 25.08, // Default to Neihu area roughly
    lon = 121.57,
    city = '台北市內湖區',
    title = '即時公告',
    content = '',
    scrolling = true,
    bgColor = '#ec5b13', // Primary orange from template
    textColor = '#ffffff',
    contentType = 'manual',
    newsUrl = 'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
    marqueeSpeed = 40,
  } = config;

  const currentSpeed = Number(marqueeSpeed) || 40;

  // States
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [newsContent, setNewsContent] = useState<string>('');
  const [loadingNews, setLoadingNews] = useState(false);
  const [dynamicDuration, setDynamicDuration] = useState(currentSpeed);
  
  const contentRef = useRef<HTMLDivElement>(null);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Weather
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
        console.error('Weather error', e);
      }
    };
    fetchWeather();
    const t = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [lat, lon]);

  // News
  useEffect(() => {
    if (contentType !== 'news') return;
    const fetchNews = async () => {
      setLoadingNews(true);
      try {
        // Bypass rss2json discovery cache (FREE tier has 1 hour cache)
        // We add a cache buster to the SOURCE URL itself so the server thinks it's a new request
        const urlObj = new URL(newsUrl);
        urlObj.searchParams.set('_ccb', Date.now().toString());
        const sourceUrlWithBuster = urlObj.toString();
        
        const encodedRssUrl = encodeURIComponent(sourceUrlWithBuster);
        // Add cache-buster to the proxy request as well
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodedRssUrl}&_t=${Date.now()}`);
        const data = await res.json();
        if (data.status === 'ok' && data.items) {
          // Decode simple HTML entities and join titles
          const titles = data.items.map((item: any) => {
            let t = item.title || '';
            // Simple mapping for common RSS HTML entities
            return t.replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&amp;/g, "&")
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">")
                    .split(' - ')[0];
          }).join(' ｜ ');
          setNewsContent(titles);
        } else {
          setNewsContent('暫時無法獲取新聞資訊，請稍後再試。');
        }
      } catch (e) {
        setNewsContent('新聞讀取服務異常');
      } finally {
        setLoadingNews(false);
      }
    };
    fetchNews();
    const t = setInterval(fetchNews, 10 * 60 * 1000); // Updated from 30m to 10m
    return () => clearInterval(t);
  }, [contentType, newsUrl]);

  const marqueePrefix = (contentType === 'news' && title && title !== '即時公告' && title !== '焦點公告') ? `${title}：` : '';
  const displayContent = contentType === 'news' 
    ? (newsContent || (loadingNews ? '新聞讀取中...' : '')) 
    : (content || '歡迎光臨，祝您有美好的一天！');

  const fullDisplayText = marqueePrefix + displayContent;

  // Dynamic Marquee
  useEffect(() => {
    if (!scrolling || !contentRef.current) {
      setDynamicDuration(currentSpeed);
      return;
    }
    const calculateDuration = () => {
      const contentWidth = contentRef.current?.offsetWidth || 0;
      if (contentWidth > 0) {
        // Screen-relative Calibration: 
        // currentSpeed (15s-180s) represents the time it takes for text to cross ONE screen width (100vw).
        // The animation scrolls 50% of contentWidth (since content is doubled for the loop).
        const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
        const loopDistance = contentWidth / 2;
        const velocity = screenWidth / currentSpeed; // Physical speed: pixels per second
        
        const calculated = loopDistance / velocity;
        setDynamicDuration(Math.max(calculated, 1)); // Realistic floor
      }
    };
    calculateDuration();
    // Re-run if content or speed changes
  }, [scrolling, fullDisplayText, currentSpeed]);

  // UI Formatting
  const timeOptions: Intl.DateTimeFormatOptions = { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  };
  if (showSeconds) {
    timeOptions.second = '2-digit';
  }
  const timeStr = now.toLocaleTimeString('en-US', timeOptions).toUpperCase();
  const [timeMain, timePeriod] = timeStr.split(' ');
  
  // Create components for flashing colon
  const renderTimeWithBlinkingColons = (time: string) => {
    const parts = time.split(':');
    return parts.map((part, i) => (
      <span key={i}>
        {part}
        {i < parts.length - 1 && (
          <span className={`${showSeconds ? 'animate-pulse-fast' : ''} inline-block mx-1`}>:</span>
        )}
      </span>
    ));
  };

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const wmo = weather ? (WMO_CODES[weather.weatherCode] ?? { label: '未知', icon: 'thermostat' }) : null;

  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col justify-between font-sans text-white bg-black">
      {/* ─── External Assets ─── */}
      <link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      
      <style>{`
        .font-serif { font-family: 'Playfair Display', serif; }
        .font-display { font-family: 'Public Sans', sans-serif; }
        .glass {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }
        @keyframes marqueeScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-text {
          display: flex;
          width: max-content;
          animation: marqueeScroll linear infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.1; }
        }
        .animate-pulse-fast {
          animation: blink 1s step-end infinite;
        }
      `}</style>

      {/* ─── Background ─── */}
      <div className="absolute inset-0 z-0">
        <div 
          className="w-full h-full bg-cover bg-center transition-opacity duration-1000"
          style={{ 
            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.8)), url('${config.bgImageUrl || '/backgrounds/taipei-neihu.png'}')`,
          }}
        />
      </div>

      {/* ─── Top Section: Time and Date ─── */}
      <div className="relative z-10 flex flex-col items-center pt-24 space-y-2">
        <h1 className="font-serif text-[180px] leading-none tracking-tight drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-baseline">
          {renderTimeWithBlinkingColons(timeMain)}
          <span className="text-[60px] font-light opacity-80 uppercase tracking-[0.2em] ml-6">
            {timePeriod}
          </span>
        </h1>
        <div className="h-1 w-24 bg-[#ec5b13] my-6 rounded-full shadow-[0_0_15px_rgba(236,91,19,0.5)]"></div>
        {showDate && (
          <p className="font-serif text-4xl italic tracking-wide text-white/90">
            {dateStr}
          </p>
        )}
      </div>

      {/* ─── Middle Section: Weather Card ─── */}
      <div className="relative z-10 flex justify-center px-12 mb-12">
        <div className="glass rounded-[40px] p-10 flex items-center gap-16 max-w-4xl w-full shadow-2xl">
          <div className="flex items-center gap-10">
            {wmo && (
              <span className="material-symbols-outlined text-[100px] text-[#ec5b13]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {wmo.icon}
              </span>
            )}
            <div>
              {weather && (
                <p className="text-8xl font-black tracking-tighter tabular-nums leading-none">
                  {weather.temp}°<span className="text-4xl font-light opacity-60 ml-1">C</span>
                </p>
              )}
              <p className="text-2xl font-bold uppercase tracking-[0.3em] text-white/70 mt-2">
                {wmo?.label || '讀取中...'}
              </p>
            </div>
          </div>
          
          <div className="h-20 w-px bg-white/20"></div>
          
          <div className="flex flex-col gap-4 flex-1">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-[#ec5b13] text-3xl">location_on</span>
              <p className="text-3xl font-bold tracking-wider">{city}</p>
            </div>
            
            {weather && (
              <div className="flex gap-6">
                <div className="bg-[#ec5b13]/20 rounded-2xl px-5 py-2 border border-[#ec5b13]/30 backdrop-blur-md">
                  <p className="text-white text-sm uppercase tracking-widest font-black">
                    High: {weather.tempMax}°
                  </p>
                </div>
                <div className="bg-white/10 rounded-2xl px-5 py-2 border border-white/10 backdrop-blur-md">
                  <p className="text-white text-sm uppercase tracking-widest font-black">
                    Low: {weather.tempMin}°
                  </p>
                </div>
                <div className="bg-white/5 rounded-2xl px-5 py-2 border border-white/5 text-white/60">
                  <p className="text-xs uppercase tracking-widest font-bold">
                    Humidity: {weather.humidity}%
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Bottom Section: News Ticker ─── */}
      <div className="relative z-20 w-full glass border-x-0 border-b-0 py-8 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center px-12 h-[80px]">
          {/* Label using the Widget Title */}
          <div className="flex items-center gap-4 pr-12 border-r border-white/20 h-full">
            <span className="material-symbols-outlined text-[#ec5b13] text-4xl">campaign</span>
            <span className="text-white font-black uppercase tracking-[0.4em] text-xl whitespace-nowrap">
              {title}
            </span>
          </div>
          
          <div className="overflow-hidden flex-1 relative h-full flex items-center pl-12">
            {fullDisplayText && (
              <div 
                key={fullDisplayText}
                className={scrolling ? "animate-marquee-text" : "flex items-center shrink-0"}
                style={scrolling ? { animationDuration: `${dynamicDuration}s` } : {}}
              >
                {[1, (scrolling ? 2 : 1)].map((i) => (
                  <div key={i} ref={i === 1 ? contentRef : null} className="flex items-center shrink-0 pr-[20vw]">
                    <span className="text-4xl font-light tracking-wide whitespace-nowrap inline-flex items-center">
                      {fullDisplayText}
                      {scrolling && <span className="mx-20 text-[#ec5b13] text-2xl">●</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main WidgetRenderer ──────────────────────────────────────────────────

export default function WidgetRenderer({ widgetConfig }: { widgetConfig: WidgetConfig }) {
  if (!widgetConfig || widgetConfig.widgetType !== 'DASHBOARD') return null;
  return <DashboardWidget config={widgetConfig.config} />;
}
