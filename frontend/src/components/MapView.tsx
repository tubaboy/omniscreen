'use client';

import { useEffect, useRef } from 'react';
import type L from 'leaflet';
import { Screen } from '@/lib/api';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  screens: Screen[];
  onScreenClick: (screen: Screen) => void;
}

export default function MapView({ screens, onScreenClick }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const isOffline = (lastSeen: string) => {
    if (!lastSeen) return true;
    return Date.now() - new Date(lastSeen).getTime() > 2 * 60 * 1000;
  };

  useEffect(() => {
    // Dynamic import to avoid SSR issues
    import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      // Default center on Taiwan
      const map = L.map(mapRef.current).setView([25.0330, 121.5654], 7);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Fix Leaflet default icon issue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when screens change
  useEffect(() => {
    import('leaflet').then((L) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      // Clear existing circle markers
      map.eachLayer(layer => {
        if (layer instanceof L.CircleMarker) map.removeLayer(layer);
      });

      const validScreens = screens.filter(s => s.latitude && s.longitude);

      validScreens.forEach(screen => {
        const offline = isOffline(screen.lastSeen);

        // Custom circle marker
        const marker = L.circleMarker([screen.latitude!, screen.longitude!], {
          radius: 10,
          fillColor: offline ? '#ef4444' : '#22c55e',
          color: offline ? '#dc2626' : '#16a34a',
          weight: 3,
          opacity: 1,
          fillOpacity: 0.8,
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; min-width: 180px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${offline ? '#ef4444' : '#22c55e'}; display: inline-block;"></span>
              <strong style="font-size: 14px;">${screen.name}</strong>
            </div>
            <div style="font-size: 11px; color: #64748b;">
              ${screen.orientation === 'LANDSCAPE' ? '橫向' : '縱向'} · ${offline ? '離線' : '在線'}
            </div>
            ${screen.tags?.length ? `<div style="margin-top: 4px; font-size: 10px; color: #94a3b8;">${screen.tags.join(', ')}</div>` : ''}
          </div>
        `);

        marker.on('click', () => onScreenClick(screen));
      });

      // Auto-fit bounds if we have markers
      if (validScreens.length > 0) {
        const bounds = L.latLngBounds(
          validScreens.map(s => [s.latitude!, s.longitude!] as [number, number])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    });
  }, [screens, onScreenClick]);

  const validCount = screens.filter(s => s.latitude && s.longitude).length;
  const totalCount = screens.length;

  return (
    <div className="relative">
      <div ref={mapRef} className="w-full h-[500px] rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden" />
      {validCount < totalCount && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur-md border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
          <p className="text-xs font-bold text-slate-500">
            {validCount}/{totalCount} 台螢幕已設定座標
            {validCount < totalCount && <span className="text-amber-500 ml-1">· 點擊螢幕可設定位置</span>}
          </p>
        </div>
      )}
    </div>
  );
}
