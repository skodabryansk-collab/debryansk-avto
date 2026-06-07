import { useEffect, useRef, useCallback } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";

export interface DealerLocation {
  id: number;
  address: string;
  short: string;
  brands: string[];
  lat: number;
  lng: number;
  color: string;
  phone?: string;
  hours?: string;
}

interface YandexMapProps {
  locations: DealerLocation[];
  center?: [number, number];
  zoom?: number;
  activeId?: number | null;
  onMarkerClick?: (id: number) => void;
}

function makePinSvg(color: string, num: number, active: boolean) {
  const isBlue = color === "#0070b8";
  const grad = isBlue
    ? `<linearGradient id="g${num}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1a8ad4"/><stop offset="100%" stop-color="#0058a0"/></linearGradient>`
    : `<linearGradient id="g${num}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a0d050"/><stop offset="100%" stop-color="#6a9228"/></linearGradient>`;
  const scale = active ? 1.25 : 1;
  const stroke = active ? 'stroke="white" stroke-width="2"' : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${36 * scale}" height="${46 * scale}" viewBox="0 0 36 46">
    <defs>${grad}</defs>
    <filter id="sh${num}" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#00000044"/>
    </filter>
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 28 18 28S36 31.5 36 18C36 8.06 27.94 0 18 0z"
      fill="url(#g${num})" filter="url(#sh${num})" ${stroke}/>
    <circle cx="18" cy="18" r="10" fill="white" opacity="0.2"/>
    <text x="18" y="23" text-anchor="middle" font-size="13" font-family="Manrope,Arial,sans-serif"
      font-weight="800" fill="white">${num}</text>
  </svg>`;
}

function svgToDataUrl(svg: string) {
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}

export function YandexMap({ locations, center, zoom, activeId, onMarkerClick }: YandexMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Record<number, Marker>>({});
  const LRef = useRef<any>(null);

  const getCenter = useCallback((): [number, number] => {
    if (center) return center;
    if (locations.length === 0) return [53.249, 34.325];
    const lats = locations.map(l => l.lat);
    const lngs = locations.map(l => l.lng);
    return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
  }, [center, locations]);

  const getZoom = useCallback((): number => {
    if (zoom != null) return zoom;
    if (locations.length <= 1) return 15;
    const lats = locations.map(l => l.lat);
    const lngs = locations.map(l => l.lng);
    const latSpan = Math.max(...lats) - Math.min(...lats);
    const lngSpan = Math.max(...lngs) - Math.min(...lngs);
    const maxSpan = Math.max(latSpan, lngSpan);
    if (maxSpan < 0.02) return 15;
    if (maxSpan < 0.05) return 14;
    if (maxSpan < 0.1) return 13;
    if (maxSpan < 0.2) return 12;
    return 11;
  }, [zoom, locations]);

  const refreshMarkers = useCallback(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach(m => m.removeFrom(map));
    markersRef.current = {};

    for (const loc of locations) {
      const isActive = activeId === loc.id;
      const svgStr = makePinSvg(loc.color, loc.id, isActive);
      const icon = L.divIcon({
        html: svgStr,
        className: isActive ? "da-marker-active" : "da-marker",
        iconSize: [36 * (isActive ? 1.25 : 1), 46 * (isActive ? 1.25 : 1)],
        iconAnchor: [18 * (isActive ? 1.25 : 1), 46 * (isActive ? 1.25 : 1)],
        popupAnchor: [0, -46 * (isActive ? 1.25 : 1)],
      });

      const brandsHtml = loc.brands
        .map(b => `<span style="display:inline-block;background:#e2e8f0;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:600;color:#334155;margin:2px 2px 0 0">${b}</span>`)
        .join("");

      const phoneHtml = loc.phone
        ? `<a href="tel:${loc.phone}" style="display:inline-block;margin-top:10px;background:linear-gradient(135deg,#0070b8,#0058a0);color:#fff;padding:7px 18px;border-radius:10px;font-size:12px;font-weight:700;text-decoration:none">Позвонить</a>`
        : "";

      const hoursHtml = loc.hours
        ? `<div style="font-size:11px;color:#64748b;margin-top:4px">${loc.hours}</div>`
        : "";

      const popup = L.popup({ maxWidth: 280, className: "da-popup" }).setContent(`
        <div style="font-family:Manrope,Arial,sans-serif;padding:2px">
          <div style="font-size:13px;font-weight:800;color:#0f172a;line-height:1.3;margin-bottom:6px">${loc.address}</div>
          ${hoursHtml}
          <div style="margin-top:6px">${brandsHtml}</div>
          ${phoneHtml}
        </div>
      `);

      const marker = L.marker([loc.lat, loc.lng], { icon }).bindPopup(popup);
      marker.on("click", () => {
        onMarkerClick?.(loc.id);
      });
      marker.addTo(map);
      markersRef.current[loc.id] = marker;

      if (isActive) {
        marker.openPopup();
        map.flyTo([loc.lat, loc.lng], 15, { duration: 1 });
      }
    }
  }, [locations, activeId, onMarkerClick]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      LRef.current = L;

      if (!mounted || !containerRef.current) return;
      if (mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: getCenter(),
        zoom: getZoom(),
        zoomControl: false,
        attributionControl: true,
      });

      L.control.zoom({ position: "topright" }).addTo(map);

      L.tileLayer("https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ru_RU", {
        attribution: '&copy; <a href="https://yandex.ru/maps">Яндекс</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      refreshMarkers();
    }

    init();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = {};
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current && LRef.current) {
      refreshMarkers();
    }
  }, [refreshMarkers]);

  return (
    <>
      <style>{`
        .da-popup .leaflet-popup-content-wrapper {
          border-radius: 14px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.15);
          padding: 0;
          border: 1px solid #e2e8f0;
        }
        .da-popup .leaflet-popup-content {
          margin: 14px 16px;
        }
        .da-popup .leaflet-popup-tip-container {
          margin-top: -1px;
        }
        .leaflet-attribution-flag { display: none !important; }
        .da-marker-active { z-index: 1000 !important; }
        .da-marker { transition: transform 0.2s ease; }
        .da-marker svg, .da-marker-active svg { display: block; width: 100%; height: 100%; }
      `}</style>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </>
  );
}
