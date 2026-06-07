import { useEffect, useRef } from "react";
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
}

interface LeafletMapProps {
  locations: DealerLocation[];
  center?: [number, number];
  zoom?: number;
}

function makePinSvg(color: string, num: number) {
  const isBlue = color === "#0070b8";
  const grad = isBlue
    ? `<linearGradient id="g${num}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1a8ad4"/><stop offset="100%" stop-color="#0058a0"/></linearGradient>`
    : `<linearGradient id="g${num}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a0d050"/><stop offset="100%" stop-color="#6a9228"/></linearGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
    <defs>${grad}</defs>
    <filter id="sh${num}" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#00000044"/>
    </filter>
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 28 18 28S36 31.5 36 18C36 8.06 27.94 0 18 0z"
      fill="url(#g${num})" filter="url(#sh${num})"/>
    <circle cx="18" cy="18" r="10" fill="white" opacity="0.2"/>
    <text x="18" y="23" text-anchor="middle" font-size="13" font-family="Manrope,Arial,sans-serif"
      font-weight="800" fill="white">${num}</text>
  </svg>`;
}

export function LeafletMapComponent({ locations, center = [53.237, 34.365], zoom = 12 }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (!mounted || !containerRef.current) return;
      if (mapRef.current) return;

      const map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: false,
        attributionControl: true,
      });

      L.control.zoom({ position: "topright" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      for (const loc of locations) {
        const svgStr = makePinSvg(loc.color, loc.id);
        const icon = L.divIcon({
          html: svgStr,
          className: "",
          iconSize: [36, 46],
          iconAnchor: [18, 46],
          popupAnchor: [0, -46],
        });

        const brandsHtml = loc.brands
          .map(b => `<span style="display:inline-block;background:#e2e8f0;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:600;color:#334155;margin:2px 2px 0 0">${b}</span>`)
          .join("");

        const phoneHtml = loc.phone
          ? `<a href="tel:${loc.phone}" style="display:inline-block;margin-top:10px;background:linear-gradient(135deg,#0070b8,#0058a0);color:#fff;padding:7px 18px;border-radius:10px;font-size:12px;font-weight:700;text-decoration:none">📞 Позвонить</a>`
          : "";

        const popup = L.popup({ maxWidth: 260, className: "da-popup" }).setContent(`
          <div style="font-family:Manrope,Arial,sans-serif;padding:2px">
            <div style="font-size:13px;font-weight:800;color:#0f172a;line-height:1.3;margin-bottom:8px">${loc.address}</div>
            <div>${brandsHtml}</div>
            ${phoneHtml}
          </div>
        `);

        const marker = L.marker([loc.lat, loc.lng], { icon }).bindPopup(popup);
        marker.addTo(map);
        markersRef.current.push(marker);
      }
    }

    init();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = [];
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      `}</style>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </>
  );
}
