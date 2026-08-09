import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { phoneHref } from "@/lib/normalizePhone";

export interface DealerLocation {
  id: number;
  address: string;
  short: string;
  brands: string[];
  serviceBrands?: string[];
  lat: number;
  lng: number;
  color: string;
  phone?: string;
  hours?: string;
}

export interface YandexMapHandle {
  openLocation: (id: number) => void;
}

interface YandexMapProps {
  locations: DealerLocation[];
  center?: [number, number];
  zoom?: number;
  activeId?: number | null;
  onMarkerClick?: (id: number) => void;
}

declare global {
  interface Window {
    ymaps3: any;
  }
}

const DA_PRIMARY = "#0070b8";

function makePinSvg(color: string, num: number, active: boolean): string {
  const isBlue = color === DA_PRIMARY;
  const gid = `g${num}${active ? "a" : ""}`;
  const grad = isBlue
    ? `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1a8ad4"/><stop offset="100%" stop-color="#0058a0"/></linearGradient>`
    : `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a0d050"/><stop offset="100%" stop-color="#6a9228"/></linearGradient>`;
  const scale = active ? 1.25 : 1;
  const w = Math.round(36 * scale);
  const h = Math.round(46 * scale);
  const stroke = active ? 'stroke="white" stroke-width="2"' : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 36 46">
  <defs>${grad}
    <filter id="sh${num}" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#00000044"/>
    </filter>
  </defs>
  <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 28 18 28S36 31.5 36 18C36 8.06 27.94 0 18 0z"
    fill="url(#${gid})" filter="url(#sh${num})" ${stroke}/>
  <circle cx="18" cy="18" r="10" fill="white" opacity="0.2"/>
  <text x="18" y="23" text-anchor="middle" font-size="13"
    font-family="Manrope,Arial,sans-serif" font-weight="800" fill="white">${num}</text>
</svg>`;
}

function makeMarkerElement(
  loc: DealerLocation,
  isActive: boolean,
  num: number,
  onMarkerClick: ((id: number) => void) | undefined,
  closeOtherPopups: (exceptId: number) => void
): HTMLDivElement {
  const scale = isActive ? 1.25 : 1;
  const pinH = Math.round(46 * scale);

  const dealerBrandsHtml = loc.brands.length > 0
    ? `<div style="margin-top:6px">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Дилер</div>
        ${loc.brands.map(b =>
          `<span style="display:inline-block;background:#dbeafe;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:600;color:#1d4ed8;margin:2px 2px 0 0">${b}</span>`
        ).join("")}
      </div>`
    : "";

  const serviceBrandsHtml = (loc.serviceBrands ?? []).length > 0
    ? `<div style="margin-top:6px">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Сервис</div>
        ${(loc.serviceBrands ?? []).map(b =>
          `<span style="display:inline-block;background:#fed7aa;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:600;color:#c2410c;margin:2px 2px 0 0">${b}</span>`
        ).join("")}
      </div>`
    : "";

  const phoneHtml = loc.phone
    ? `<a href="${phoneHref(loc.phone)}" onclick="event.stopPropagation()" style="display:inline-block;margin-top:10px;background:linear-gradient(135deg,${DA_PRIMARY},#0058a0);color:#fff;padding:7px 18px;border-radius:10px;font-size:12px;font-weight:700;text-decoration:none">Позвонить</a>`
    : "";

  const hoursHtml = loc.hours
    ? `<div style="font-size:11px;color:#64748b;margin-top:4px">${loc.hours}</div>`
    : "";

  const pinW = Math.round(36 * scale);

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `position:relative;display:block;width:${pinW}px;height:${pinH}px;cursor:pointer;user-select:none;transform:translate(-${pinW / 2}px,-${pinH}px);`;

  wrapper.innerHTML = `
    <div class="da-ym-popup" onclick="event.stopPropagation()" style="
      display:${isActive ? "block" : "none"};
      position:absolute;
      bottom:${pinH + 8}px;
      left:50%;
      transform:translateX(-50%);
      background:white;
      border-radius:14px;
      box-shadow:0 8px 30px rgba(0,0,0,0.15);
      border:1px solid #e2e8f0;
      padding:14px 16px;
      font-family:Manrope,Arial,sans-serif;
      width:240px;
      z-index:10;
      pointer-events:auto;
    ">
      <div style="font-size:13px;font-weight:800;color:#0f172a;line-height:1.3;margin-bottom:2px">${loc.short}</div>
      <div style="font-size:11px;color:#475569;margin-bottom:4px">${loc.address}</div>
      ${hoursHtml}
      ${dealerBrandsHtml}
      ${serviceBrandsHtml}
      ${phoneHtml}
    </div>
    ${makePinSvg(loc.color, num, isActive)}
  `;

  wrapper.addEventListener("click", (e) => {
    e.stopPropagation();
    const popup = wrapper.querySelector(".da-ym-popup") as HTMLElement;
    if (!popup) return;
    const willOpen = popup.style.display === "none";
    // Close every other popup first
    closeOtherPopups(loc.id);
    // Toggle this popup
    popup.style.display = willOpen ? "block" : "none";
    onMarkerClick?.(loc.id);
  });

  return wrapper;
}

async function waitForYmaps3(): Promise<any> {
  if (window.ymaps3) {
    await window.ymaps3.ready;
    return window.ymaps3;
  }
  return new Promise((resolve) => {
    const timer = setInterval(async () => {
      if (window.ymaps3) {
        clearInterval(timer);
        await window.ymaps3.ready;
        resolve(window.ymaps3);
      }
    }, 50);
  });
}

function calcBoundingBox(locations: DealerLocation[]) {
  const lats = locations.map(l => l.lat);
  const lngs = locations.map(l => l.lng);
  return {
    minLat: Math.min(...lats), maxLat: Math.max(...lats),
    minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
  };
}

function calcCenterFromLocations(locations: DealerLocation[]): [number, number] {
  if (!locations.length) return [34.325, 53.249];
  const { minLat, maxLat, minLng, maxLng } = calcBoundingBox(locations);
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2]; // [lng, lat] for ymaps3
}

function calcZoomFromLocations(locations: DealerLocation[]): number {
  if (locations.length <= 1) return 15;
  const { minLat, maxLat, minLng, maxLng } = calcBoundingBox(locations);
  // Add 20% padding to bounding box so pins don't sit on the edge
  const span = Math.max(maxLat - minLat, maxLng - minLng) * 1.4;
  if (span < 0.015) return 16;
  if (span < 0.03)  return 15;
  if (span < 0.06)  return 14;
  if (span < 0.12)  return 13;
  if (span < 0.25)  return 12;
  return 11;
}

export const YandexMap = forwardRef<YandexMapHandle, YandexMapProps>(
  function YandexMap({ locations, center, zoom, activeId, onMarkerClick }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markersRef = useRef<Record<string | number, any>>({});
    const elementsRef = useRef<Record<number, HTMLDivElement>>({});
    const ymaps3Ref = useRef<any>(null);
    const initializedRef = useRef(false);
    const fittedRef = useRef(false); // tracks if we've done the initial bounding-box fit

    function getCenter(): [number, number] {
      if (center) return [center[1], center[0]];
      return calcCenterFromLocations(locations);
    }

    function getZoom(): number {
      if (zoom != null) return zoom;
      return calcZoomFromLocations(locations);
    }

    function closeOtherPopups(exceptId: number) {
      Object.entries(elementsRef.current).forEach(([id, el]) => {
        if (Number(id) !== exceptId) {
          const popup = el.querySelector(".da-ym-popup") as HTMLElement | null;
          if (popup) popup.style.display = "none";
        }
      });
    }

    function clearMarkers() {
      const map = mapRef.current;
      if (!map) return;
      Object.values(markersRef.current).forEach((m: any) => {
        try { map.removeChild(m); } catch { /* ignore */ }
      });
      markersRef.current = {};
      elementsRef.current = {};
    }

    function drawMarkers(y3: any, map: any) {
      const { YMapMarker } = y3;

      locations.forEach((loc, idx) => {
        const isActive = activeId === loc.id;
        const el = makeMarkerElement(loc, isActive, idx + 1, onMarkerClick, closeOtherPopups);
        elementsRef.current[loc.id] = el;

        const marker = new YMapMarker(
          {
            coordinates: [loc.lng, loc.lat],
            zIndex: isActive ? 10 : 1,
          },
          el
        );
        map.addChild(marker);
        markersRef.current[loc.id] = marker;

        if (isActive) {
          map.setLocation({ center: [loc.lng, loc.lat], zoom: 15, duration: 500 });
        }
      });
    }

    // Expose openLocation(id) to parent via ref
    useImperativeHandle(ref, () => ({
      openLocation: (id: number) => {
        const map = mapRef.current;
        const loc = locations.find(l => l.id === id);
        if (!map || !loc) return;

        // Close all other popups
        closeOtherPopups(id);

        // Open this popup
        const el = elementsRef.current[id];
        if (el) {
          const popup = el.querySelector(".da-ym-popup") as HTMLElement | null;
          if (popup) popup.style.display = "block";
        }

        // Fly to this location
        map.setLocation({ center: [loc.lng, loc.lat], zoom: 15, duration: 400 });
      },
    }), [locations]);

    useEffect(() => {
      let mounted = true;

      async function init() {
        const y3 = await waitForYmaps3();
        if (!mounted || !containerRef.current || initializedRef.current) return;
        initializedRef.current = true;
        ymaps3Ref.current = y3;

        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapControls } = y3;

        const [{ YMapZoomControl }] = await Promise.all([
          y3.import("@yandex/ymaps3-controls@0.0.1"),
        ]);

        const map = new YMap(containerRef.current, {
          location: { center: getCenter(), zoom: getZoom() },
        });

        map.addChild(new YMapDefaultSchemeLayer());
        map.addChild(new YMapDefaultFeaturesLayer());

        const controls = new YMapControls({ position: "right" });
        controls.addChild(new YMapZoomControl());
        map.addChild(controls);

        mapRef.current = map;
        drawMarkers(y3, map);

        // Mark as fitted if we already have locations
        if (locations.length > 0) fittedRef.current = true;
      }

      init();

      return () => {
        mounted = false;
        clearMarkers();
        if (mapRef.current) {
          try { mapRef.current.destroy?.(); } catch { /* ignore */ }
          mapRef.current = null;
        }
        initializedRef.current = false;
        fittedRef.current = false;
      };
    }, []);

    useEffect(() => {
      if (!mapRef.current || !ymaps3Ref.current) return;
      clearMarkers();
      drawMarkers(ymaps3Ref.current, mapRef.current);

      // First time we have real locations after async load → fit bounding box
      if (!fittedRef.current && locations.length > 0 && !activeId) {
        fittedRef.current = true;
        mapRef.current.setLocation({
          center: calcCenterFromLocations(locations),
          zoom: calcZoomFromLocations(locations),
          duration: 300,
        });
      }
    }, [locations, activeId]);

    return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
  }
);
