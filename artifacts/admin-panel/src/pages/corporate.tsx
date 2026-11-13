import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Camera, Loader2, Upload, X } from "lucide-react";
import { processSessionResponse } from "@/lib/session-client";
function getToken() { return localStorage.getItem("admin_token"); }
function authHeaders(t = getToken()): Record<string, string> {
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/* ── Types ──────────────────────────────────────────────────────────────── */
interface AdvantageItem { title: string; description: string }
interface AdvantageGroup { groupTitle: string; items: AdvantageItem[] }
interface Step { title: string; description: string }
interface CorporateData {
  hero_title: string;
  hero_subtitle: string;
  advantages: AdvantageGroup[];
  steps: Step[];
  sales_manager_name: string | null;
  sales_manager_role: string | null;
  sales_manager_phone: string | null;
  sales_manager_email: string | null;
  sales_manager_photo: string | null;
  service_manager_name: string | null;
  service_manager_role: string | null;
  service_manager_phone: string | null;
  service_manager_email: string | null;
  service_manager_photo: string | null;
}

const DEFAULT: CorporateData = {
  hero_title: "", hero_subtitle: "", advantages: [], steps: [],
  sales_manager_name: null, sales_manager_role: null, sales_manager_phone: null,
  sales_manager_email: null, sales_manager_photo: null,
  service_manager_name: null, service_manager_role: null, service_manager_phone: null,
  service_manager_email: null, service_manager_photo: null,
};

/* ── Photo Crop Editor ───────────────────────────────────────────────────── */
interface CropState { offsetX: number; offsetY: number; scale: number }

function PhotoCropEditor({
  file, onSave, onCancel, saving,
}: {
  file: File;
  onSave: (crop: { x: number; y: number; size: number }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const cropState = useRef<CropState>({ offsetX: 0, offsetY: 0, scale: 1 });
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [sliderVal, setSliderVal] = useState(130);

  const CANVAS_SIZE = 320;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { offsetX, offsetY, scale } = cropState.current;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }, []);

  const clampOffset = useCallback((ox: number, oy: number, scale: number) => {
    const img = imgRef.current;
    if (!img) return { ox, oy };
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    return {
      ox: Math.min(0, Math.max(CANVAS_SIZE - drawW, ox)),
      oy: Math.min(0, Math.max(CANVAS_SIZE - drawH, oy)),
    };
  }, []);

  const applySlider = useCallback((pct: number) => {
    const img = imgRef.current;
    if (!img) return;
    const minScale = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
    const maxScale = minScale * 5;
    const newScale = minScale + (maxScale - minScale) * ((pct - 100) / 400);
    const cs = cropState.current;
    const scaleChange = newScale / cs.scale;
    const pivotX = CANVAS_SIZE / 2;
    const pivotY = CANVAS_SIZE / 2;
    const newOx = pivotX - (pivotX - cs.offsetX) * scaleChange;
    const newOy = pivotY - (pivotY - cs.offsetY) * scaleChange;
    const { ox, oy } = clampOffset(newOx, newOy, newScale);
    cropState.current = { scale: newScale, offsetX: ox, offsetY: oy };
    draw();
  }, [draw, clampOffset]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const minScale = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
      const initScale = minScale * 1.3;
      const drawW = img.naturalWidth * initScale;
      const drawH = img.naturalHeight * initScale;
      cropState.current = {
        scale: initScale,
        offsetX: (CANVAS_SIZE - drawW) / 2,
        offsetY: (CANVAS_SIZE - drawH) / 2,
      };
      setLoaded(true);
      draw();
    };
    img.src = URL.createObjectURL(file);
    return () => URL.revokeObjectURL(img.src);
  }, [file, draw]);

  useEffect(() => { if (loaded) draw(); }, [loaded, draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const cs = cropState.current;
    dragStart.current = { x: e.clientX, y: e.clientY, ox: cs.offsetX, oy: cs.offsetY };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const { ox, oy } = clampOffset(
      dragStart.current.ox + dx,
      dragStart.current.oy + dy,
      cropState.current.scale,
    );
    cropState.current.offsetX = ox;
    cropState.current.offsetY = oy;
    draw();
  }, [draw, clampOffset]);

  const handleMouseUp = useCallback(() => { dragStart.current = null; }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const img = imgRef.current;
    if (!img) return;
    const cs = cropState.current;
    const minScale = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
    const factor = e.deltaY < 0 ? 1.08 : 0.93;
    const newScale = Math.min(minScale * 5, Math.max(minScale, cs.scale * factor));
    const scaleChange = newScale / cs.scale;
    const { ox, oy } = clampOffset(
      CANVAS_SIZE / 2 - (CANVAS_SIZE / 2 - cs.offsetX) * scaleChange,
      CANVAS_SIZE / 2 - (CANVAS_SIZE / 2 - cs.offsetY) * scaleChange,
      newScale,
    );
    const newPct = 100 + ((newScale - minScale) / (minScale * 4)) * 400;
    setSliderVal(Math.round(Math.min(500, Math.max(100, newPct))));
    cropState.current = { scale: newScale, offsetX: ox, offsetY: oy };
    draw();
  }, [draw, clampOffset]);

  const touchStart = useRef<{ x: number; y: number; ox: number; oy: number; dist?: number; scale?: number } | null>(null);

  const handleTouchStartNative = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const cs = cropState.current;
    if (e.touches.length === 1) {
      touchStart.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY, ox: cs.offsetX, oy: cs.offsetY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[1]!.clientX - e.touches[0]!.clientX;
      const dy = e.touches[1]!.clientY - e.touches[0]!.clientY;
      touchStart.current = { x: 0, y: 0, ox: cs.offsetX, oy: cs.offsetY, dist: Math.sqrt(dx * dx + dy * dy), scale: cs.scale };
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (!touchStart.current) return;
    const img = imgRef.current;
    if (!img) return;
    const cs = cropState.current;
    if (e.touches.length === 1) {
      const dx = e.touches[0]!.clientX - touchStart.current.x;
      const dy = e.touches[0]!.clientY - touchStart.current.y;
      const { ox, oy } = clampOffset(touchStart.current.ox + dx, touchStart.current.oy + dy, cs.scale);
      cs.offsetX = ox; cs.offsetY = oy;
    } else if (e.touches.length === 2 && touchStart.current.dist && touchStart.current.scale) {
      const dx = e.touches[1]!.clientX - e.touches[0]!.clientX;
      const dy = e.touches[1]!.clientY - e.touches[0]!.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minScale = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
      const newScale = Math.min(minScale * 5, Math.max(minScale, touchStart.current.scale * (dist / touchStart.current.dist)));
      const { ox, oy } = clampOffset(
        CANVAS_SIZE / 2 - (CANVAS_SIZE / 2 - touchStart.current.ox) * (newScale / touchStart.current.scale),
        CANVAS_SIZE / 2 - (CANVAS_SIZE / 2 - touchStart.current.oy) * (newScale / touchStart.current.scale),
        newScale,
      );
      cs.scale = newScale; cs.offsetX = ox; cs.offsetY = oy;
    }
    draw();
  }, [draw, clampOffset]);

  const handleTouchEnd = useCallback(() => { touchStart.current = null; }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("touchstart", handleTouchStartNative, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("touchstart", handleTouchStartNative);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [loaded, handleMouseMove, handleMouseUp, handleWheel, handleTouchStartNative, handleTouchMove, handleTouchEnd]);

  function getCrop(): { x: number; y: number; size: number } {
    const img = imgRef.current!;
    const { offsetX, offsetY, scale } = cropState.current;
    const x = Math.round(-offsetX / scale);
    const y = Math.round(-offsetY / scale);
    const size = Math.round(CANVAS_SIZE / scale);
    return {
      x: Math.max(0, Math.min(x, img.naturalWidth - size)),
      y: Math.max(0, Math.min(y, img.naturalHeight - size)),
      size: Math.max(1, Math.min(size, Math.min(img.naturalWidth - x, img.naturalHeight - y))),
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <h3 className="font-semibold text-slate-900 text-center">Кадрирование фото</h3>
        <p className="text-xs text-slate-500 text-center">Тяните фото мышью для смещения · колесо мыши или ползунок для масштаба</p>
        <div className="flex justify-center">
          {!loaded ? (
            <div className="w-[320px] h-[320px] rounded-full bg-slate-100 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="rounded-full cursor-grab active:cursor-grabbing touch-none select-none"
              style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
              onMouseDown={handleMouseDown}
            />
          )}
        </div>
        {loaded && (
          <div className="flex items-center gap-3 px-1">
            <span className="text-slate-400 text-base leading-none select-none">−</span>
            <input
              type="range" min={100} max={500} step={1}
              className="flex-1 accent-[#0070b8]"
              value={sliderVal}
              onChange={e => {
                const v = Number(e.target.value);
                setSliderVal(v);
                applySlider(v);
              }}
            />
            <span className="text-slate-400 text-base leading-none select-none">+</span>
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>
            Отмена
          </Button>
          <Button
            className="flex-1 bg-[#0070b8] hover:bg-[#005a94] text-white"
            onClick={() => { if (loaded) onSave(getCrop()); }}
            disabled={!loaded || saving}
          >
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Загружаем...</> : "Сохранить фото"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Manager Photo Upload ─────────────────────────────────────────────────── */
function ManagerPhotoUpload({
  photoUrl, onUpload, label,
}: {
  photoUrl: string | null;
  onUpload: (url: string) => void;
  label: string;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSave(crop: { x: number; y: number; size: number }) {
    if (!cropFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", cropFile);
      fd.append("cropX", String(crop.x));
      fd.append("cropY", String(crop.y));
      fd.append("cropSize", String(crop.size));
      const token = getToken();
      const res = await fetch("/api/admin/corporate-page/photo", {
        method: "POST",
        headers: authHeaders(token),
        body: fd,
      });
      processSessionResponse(res, token, "admin_token");
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Ошибка загрузки");
      onUpload(j.url);
      toast({ title: "Фото загружено", description: "Не забудьте нажать «Сохранить»" });
    } catch (err) {
      toast({ title: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
      setCropFile(null);
    }
  }

  return (
    <>
      {cropFile && (
        <PhotoCropEditor
          file={cropFile}
          onSave={handleSave}
          onCancel={() => setCropFile(null)}
          saving={uploading}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) { setCropFile(f); e.target.value = ""; }
        }}
      />
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 flex items-center justify-center shrink-0">
          {photoUrl ? (
            <img src={photoUrl} alt={label} className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-6 h-6 text-slate-400" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 text-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            {photoUrl ? "Заменить фото" : "Загрузить фото"}
          </Button>
          {photoUrl && (
            <button
              type="button"
              onClick={() => onUpload("")}
              className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Удалить
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function CorporateAdminPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<CorporateData>(DEFAULT);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-corporate-page"],
    queryFn: async () => {
      const token = getToken();
      const r = await fetch("/api/admin/corporate-page", { headers: authHeaders(token) });
      processSessionResponse(r, token, "admin_token");
      const j = await r.json();
      return j.data as CorporateData | null;
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        hero_title: data.hero_title ?? "",
        hero_subtitle: data.hero_subtitle ?? "",
        advantages: data.advantages ?? [],
        steps: data.steps ?? [],
        sales_manager_name: data.sales_manager_name ?? null,
        sales_manager_role: data.sales_manager_role ?? null,
        sales_manager_phone: data.sales_manager_phone ?? null,
        sales_manager_email: data.sales_manager_email ?? null,
        sales_manager_photo: data.sales_manager_photo ?? null,
        service_manager_name: data.service_manager_name ?? null,
        service_manager_role: data.service_manager_role ?? null,
        service_manager_phone: data.service_manager_phone ?? null,
        service_manager_email: data.service_manager_email ?? null,
        service_manager_photo: data.service_manager_photo ?? null,
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: CorporateData) => {
      const token = getToken();
      const r = await fetch("/api/admin/corporate-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(payload),
      });
      processSessionResponse(r, token, "admin_token");
      if (!r.ok) throw new Error("save error");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Сохранено", description: "Не забудьте обновить кэш сайта" });
      qc.invalidateQueries({ queryKey: ["admin-corporate-page"] });
      setDirty(false);
    },
    onError: () => toast({ title: "Ошибка сохранения", variant: "destructive" }),
  });

  function set(patch: Partial<CorporateData>) {
    setForm(f => ({ ...f, ...patch }));
    setDirty(true);
  }

  function addGroup() { set({ advantages: [...form.advantages, { groupTitle: "", items: [] }] }); }
  function removeGroup(gi: number) { set({ advantages: form.advantages.filter((_, i) => i !== gi) }); }
  function setGroupTitle(gi: number, v: string) {
    const a = [...form.advantages]; a[gi] = { ...a[gi]!, groupTitle: v }; set({ advantages: a });
  }
  function addItem(gi: number) {
    const a = [...form.advantages];
    a[gi] = { ...a[gi]!, items: [...a[gi]!.items, { title: "", description: "" }] };
    set({ advantages: a });
  }
  function removeItem(gi: number, ii: number) {
    const a = [...form.advantages];
    a[gi] = { ...a[gi]!, items: a[gi]!.items.filter((_, i) => i !== ii) };
    set({ advantages: a });
  }
  function setItem(gi: number, ii: number, field: "title" | "description", v: string) {
    const a = [...form.advantages];
    const items = [...a[gi]!.items]; items[ii] = { ...items[ii]!, [field]: v };
    a[gi] = { ...a[gi]!, items }; set({ advantages: a });
  }
  function moveItem(gi: number, ii: number, dir: -1 | 1) {
    const a = [...form.advantages]; const items = [...a[gi]!.items]; const ni = ii + dir;
    if (ni < 0 || ni >= items.length) return;
    [items[ii], items[ni]] = [items[ni]!, items[ii]!];
    a[gi] = { ...a[gi]!, items }; set({ advantages: a });
  }
  function addStep() { set({ steps: [...form.steps, { title: "", description: "" }] }); }
  function removeStep(i: number) { set({ steps: form.steps.filter((_, j) => j !== i) }); }
  function setStep(i: number, field: "title" | "description", v: string) {
    const s = [...form.steps]; s[i] = { ...s[i]!, [field]: v }; set({ steps: s });
  }
  function moveStep(i: number, dir: -1 | 1) {
    const s = [...form.steps]; const ni = i + dir;
    if (ni < 0 || ni >= s.length) return;
    [s[i], s[ni]] = [s[ni]!, s[i]!]; set({ steps: s });
  }

  if (isLoading) return <div className="p-8 text-center text-slate-400">Загрузка...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Корпоративные клиенты</h1>
          <p className="text-sm text-slate-400 mt-1">Контент страницы /corporate</p>
        </div>
        <Button
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending || !dirty}
          className="brand-gradient border-0 text-white font-bold"
        >
          {mutation.isPending ? "Сохраняем..." : "Сохранить"}
        </Button>
      </div>

      {/* HERO */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-extrabold text-slate-700">Hero-блок</h2>
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">Заголовок</label>
          <input value={form.hero_title} onChange={e => set({ hero_title: e.target.value })}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0070b8]"
            placeholder="Автомобили для бизнеса" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">Подзаголовок</label>
          <textarea value={form.hero_subtitle} onChange={e => set({ hero_subtitle: e.target.value })}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0070b8] resize-none"
            rows={3} placeholder="Краткое описание предложения..." />
        </div>
      </section>

      {/* ADVANTAGES */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-700">Преимущества</h2>
          <Button size="sm" variant="outline" onClick={addGroup} className="text-xs font-bold gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Добавить группу
          </Button>
        </div>
        {form.advantages.map((group, gi) => (
          <div key={gi} className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex gap-2 items-center">
              <input value={group.groupTitle} onChange={e => setGroupTitle(gi, e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-[#0070b8]"
                placeholder="Название группы" />
              <Button size="sm" variant="ghost" onClick={() => removeGroup(gi)} className="text-red-400 hover:text-red-600 px-2">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {group.items.map((item, ii) => (
                <div key={ii} className="bg-slate-50 rounded-lg p-3 space-y-2">
                  <div className="flex gap-2 items-center">
                    <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
                    <input value={item.title} onChange={e => setItem(gi, ii, "title", e.target.value)}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-semibold outline-none focus:border-[#0070b8] bg-white"
                      placeholder="Заголовок" />
                    <div className="flex gap-0.5 shrink-0">
                      <button onClick={() => moveItem(gi, ii, -1)} className="p-1 rounded hover:bg-slate-200 text-slate-400"><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => moveItem(gi, ii, 1)} className="p-1 rounded hover:bg-slate-200 text-slate-400"><ChevronDown className="w-3.5 h-3.5" /></button>
                      <button onClick={() => removeItem(gi, ii)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <textarea value={item.description} onChange={e => setItem(gi, ii, "description", e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 outline-none focus:border-[#0070b8] resize-none bg-white"
                    rows={2} placeholder="Описание пункта" />
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => addItem(gi)} className="text-xs gap-1 w-full">
                <Plus className="w-3 h-3" /> Добавить пункт
              </Button>
            </div>
          </div>
        ))}
      </section>

      {/* STEPS */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-700">Шаги («Как это работает»)</h2>
          <Button size="sm" variant="outline" onClick={addStep} className="text-xs font-bold gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Добавить шаг
          </Button>
        </div>
        <div className="space-y-3">
          {form.steps.map((step, i) => (
            <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex gap-2 items-center">
                <span className="w-7 h-7 rounded-lg bg-[#0070b8] text-white text-xs font-extrabold flex items-center justify-center shrink-0">{i + 1}</span>
                <input value={step.title} onChange={e => setStep(i, "title", e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-semibold outline-none focus:border-[#0070b8]"
                  placeholder="Заголовок шага" />
                <div className="flex gap-0.5">
                  <button onClick={() => moveStep(i, -1)} className="p-1 rounded hover:bg-slate-200 text-slate-400"><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => moveStep(i, 1)} className="p-1 rounded hover:bg-slate-200 text-slate-400"><ChevronDown className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeStep(i)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <textarea value={step.description} onChange={e => setStep(i, "description", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 outline-none focus:border-[#0070b8] resize-none"
                rows={2} placeholder="Описание шага" />
            </div>
          ))}
        </div>
      </section>

      {/* MANAGERS */}
      {(["sales", "service"] as const).map(role => {
        const isS = role === "sales";
        const nameKey = isS ? "sales_manager_name" : "service_manager_name";
        const roleKey = isS ? "sales_manager_role" : "service_manager_role";
        const phoneKey = isS ? "sales_manager_phone" : "service_manager_phone";
        const emailKey = isS ? "sales_manager_email" : "service_manager_email";
        const photoKey = isS ? "sales_manager_photo" : "service_manager_photo";
        const sectionLabel = isS ? "Менеджер по продажам" : "Менеджер по сервису";
        const defaultRole = isS ? "Менеджер по продажам" : "Менеджер по сервису";
        return (
          <section key={role} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-extrabold text-slate-700">{sectionLabel}</h2>
            <p className="text-xs text-slate-400">Если поля не заполнены — сайт показывает общий телефон компании.</p>

            {/* Photo upload */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block">Фото</label>
              <ManagerPhotoUpload
                photoUrl={form[photoKey]}
                label={sectionLabel}
                onUpload={url => set({ [photoKey]: url || null } as any)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Имя и фамилия</label>
                <input value={form[nameKey] ?? ""} onChange={e => set({ [nameKey]: e.target.value || null } as any)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0070b8]"
                  placeholder="Иванов Иван" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Должность</label>
                <input value={form[roleKey] ?? ""} onChange={e => set({ [roleKey]: e.target.value || null } as any)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0070b8]"
                  placeholder={defaultRole} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Телефон</label>
                <input value={form[phoneKey] ?? ""} onChange={e => set({ [phoneKey]: e.target.value || null } as any)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0070b8]"
                  placeholder="+74832000000" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Email</label>
                <input type="email" value={form[emailKey] ?? ""} onChange={e => set({ [emailKey]: e.target.value || null } as any)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0070b8]"
                  placeholder="manager@example.ru" />
              </div>
            </div>
          </section>
        );
      })}

      <div className="flex justify-end pb-8">
        <Button
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending || !dirty}
          className="brand-gradient border-0 text-white font-bold px-8 h-11"
        >
          {mutation.isPending ? "Сохраняем..." : "Сохранить изменения"}
        </Button>
      </div>
    </div>
  );
}
