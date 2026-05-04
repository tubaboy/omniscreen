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

      // Clear existing markers (both CircleMarker and Marker with DivIcon)
      map.eachLayer(layer => {
        if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
          map.removeLayer(layer);
        }
      });

      const validScreens = screens.filter(s => s.latitude && s.longitude);

      validScreens.forEach(screen => {
        const offline = isOffline(screen.lastSeen);
        const hasSnapshot = !offline && screen.lastSnapshotUrl;

        let marker: L.CircleMarker | L.Marker;

        if (hasSnapshot) {
          // Online + has screenshot → show thumbnail with green glowing border
          const icon = L.divIcon({
            className: '',
            iconSize: [72, 48],
            iconAnchor: [36, 24],
            popupAnchor: [0, -28],
            html: `
              <div style="
                position: relative;
                width: 72px;
                height: 48px;
                border-radius: 10px;
                overflow: hidden;
                border: 3px solid #22c55e;
                box-shadow: 0 0 12px rgba(34, 197, 94, 0.5), 0 2px 8px rgba(0,0,0,0.2);
                background: #000;
                cursor: pointer;
              ">
                <img
                  src="${screen.lastSnapshotUrl}"
                  style="width: 100%; height: 100%; object-fit: cover;"
                  onerror="this.style.display='none'"
                />
                <div style="
                  position: absolute;
                  bottom: 2px;
                  right: 2px;
                  width: 8px;
                  height: 8px;
                  border-radius: 50%;
                  background: #22c55e;
                  box-shadow: 0 0 6px #22c55e;
                  animation: pulse-green 2s infinite;
                "></div>
              </div>
              <style>
                @keyframes pulse-green {
                  0%, 100% { opacity: 1; box-shadow: 0 0 6px #22c55e; }
                  50% { opacity: 0.6; box-shadow: 0 0 12px #22c55e; }
                }
              </style>
            `,
          });

          marker = L.marker([screen.latitude!, screen.longitude!], { icon }).addTo(map);
        } else {
          // Offline or no screenshot → red circle marker
          marker = L.circleMarker([screen.latitude!, screen.longitude!], {
            radius: 10,
            fillColor: '#ef4444',
            color: '#dc2626',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.8,
          }).addTo(map);
        }

        // Build popup content
        const popupContent = `
          <div style="font-family: system-ui, sans-serif; min-width: 200px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${offline ? '#ef4444' : '#22c55e'}; display: inline-block;"></span>
              <strong style="font-size: 14px;">${screen.name}</strong>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
              ${screen.orientation.startsWith('LANDSCAPE') ? '橫向' : '縱向'} · ${offline ? '離線' : '在線'}
            </div>
            ${screen.lastSnapshotUrl ? `
              <div style="border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 6px;">
                <img src="${screen.lastSnapshotUrl}" style="width: 100%; height: auto; display: block;" onerror="this.parentElement.style.display='none'" />
              </div>
            ` : ''}
            ${screen.tags?.length ? `<div style="font-size: 10px; color: #94a3b8;">${screen.tags.join(', ')}</div>` : ''}
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 280 });
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
