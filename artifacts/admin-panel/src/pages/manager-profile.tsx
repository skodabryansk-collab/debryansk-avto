import React, { useRef, useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, LogOut, User, Camera, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import {
  getManagerToken,
  getManagerTokenStorageKey,
  getManagerName,
  logoutManager,
  isAdminUsingManagerPortal,
} from "@/lib/manager-auth";
import { useManagerAuth } from "@/lib/manager-auth";
import { processSessionResponse } from "@/lib/session-client";

interface ManagerProfile {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  login: string;
  photoUrl: string | null;
}

async function fetchProfile(): Promise<{ ok: boolean; data: ManagerProfile }> {
  const token = getManagerToken();
  const res = await fetch("/api/manager/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });
  processSessionResponse(res, token, getManagerTokenStorageKey());
  if (!res.ok) throw new Error("Ошибка загрузки профиля");
  return res.json();
}

async function saveProfile(data: { name: string; phone: string; email: string }): Promise<void> {
  const token = getManagerToken();
  const res = await fetch("/api/manager/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  processSessionResponse(res, token, getManagerTokenStorageKey());
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Ошибка сохранения");
}

async function changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
  const token = getManagerToken();
  const res = await fetch("/api/manager/profile/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  processSessionResponse(res, token, getManagerTokenStorageKey());
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Ошибка смены пароля");
}

async function uploadPhoto(file: File, crop: { x: number; y: number; size: number }): Promise<{ objectKey: string }> {
  const token = getManagerToken();
  const fd = new FormData();
  fd.append("photo", file);
  fd.append("cropX", String(crop.x));
  fd.append("cropY", String(crop.y));
  fd.append("cropSize", String(crop.size));
  const res = await fetch("/api/manager/profile/photo", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  processSessionResponse(res, token, getManagerTokenStorageKey());
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Ошибка загрузки фото");
  return json;
}

function photoDisplayUrl(): string {
  const token = getManagerToken();
  return `/api/manager/profile/photo${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

interface CropState {
  offsetX: number;
  offsetY: number;
  scale: number;
}

function PhotoCropEditor({
  file,
  onSave,
  onCancel,
  saving,
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

  const clampOffset = useCallback((ox: number, oy: number, scale: number) => {
    const img = imgRef.current;
    if (!img) return { ox, oy };
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const minX = CANVAS_SIZE - drawW;
    const minY = CANVAS_SIZE - drawH;
    return {
      ox: Math.min(0, Math.max(minX, ox)),
      oy: Math.min(0, Math.max(minY, oy)),
    };
  }, []);

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

  const applySlider = useCallback((pct: number) => {
    const img = imgRef.current;
    if (!img) return;
    const minScale = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
    const newScale = minScale + (minScale * 4) * ((pct - 100) / 400);
    const cs = cropState.current;
    const scaleChange = newScale / cs.scale;
    const { ox, oy } = clampOffset(
      CANVAS_SIZE / 2 - (CANVAS_SIZE / 2 - cs.offsetX) * scaleChange,
      CANVAS_SIZE / 2 - (CANVAS_SIZE / 2 - cs.offsetY) * scaleChange,
      newScale,
    );
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

  useEffect(() => {
    if (loaded) draw();
  }, [loaded, draw]);

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
    const newScale = Math.min(5, Math.max(minScale, cs.scale * factor));
    const scaleChange = newScale / cs.scale;
    const pivotX = CANVAS_SIZE / 2;
    const pivotY = CANVAS_SIZE / 2;
    const newOx = pivotX - (pivotX - cs.offsetX) * scaleChange;
    const newOy = pivotY - (pivotY - cs.offsetY) * scaleChange;
    const { ox, oy } = clampOffset(newOx, newOy, newScale);
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
      const dist = Math.sqrt(dx * dx + dy * dy);
      touchStart.current = { x: 0, y: 0, ox: cs.offsetX, oy: cs.offsetY, dist, scale: cs.scale };
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
      const factor = dist / touchStart.current.dist;
      const minScale = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
      const newScale = Math.min(5, Math.max(minScale, touchStart.current.scale * factor));
      const pivotX = CANVAS_SIZE / 2;
      const pivotY = CANVAS_SIZE / 2;
      const newOx = pivotX - (pivotX - touchStart.current.ox) * (newScale / touchStart.current.scale);
      const newOy = pivotY - (pivotY - touchStart.current.oy) * (newScale / touchStart.current.scale);
      const { ox, oy } = clampOffset(newOx, newOy, newScale);
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
        <p className="text-xs text-slate-500 text-center">Тяните фото пальцем — двумя пальцами масштабируйте</p>
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
              type="range"
              min={100}
              max={500}
              step={1}
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
            className="flex-1 bg-[#0070b8] hover:bg-[#005a94]"
            onClick={() => { if (loaded) onSave(getCrop()); }}
            disabled={!loaded || saving}
          >
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохраняем...</> : "Сохранить фото"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all
      ${type === "success" ? "bg-green-600" : "bg-red-600"}`}>
      {type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      {message}
    </div>
  );
}

export default function ManagerProfilePage() {
  const { logout } = useManagerAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["manager-profile"],
    queryFn: fetchProfile,
  });

  const profile = data?.data;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [cropFile, setCropFile] = useState<File | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setPhone(profile.phone ?? "");
      setEmail(profile.email ?? "");
    }
  }, [profile]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  const profileMutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manager-profile"] });
      showToast("Профиль сохранён", "success");
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      showToast("Пароль изменён", "success");
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const photoMutation = useMutation({
    mutationFn: ({ file, crop }: { file: File; crop: { x: number; y: number; size: number } }) =>
      uploadPhoto(file, crop),
    onSuccess: () => {
      setCropFile(null);
      qc.invalidateQueries({ queryKey: ["manager-profile"] });
      showToast("Фото обновлено", "success");
    },
    onError: (err: Error) => { setCropFile(null); showToast(err.message, "error"); },
  });

  function handleLogout() {
    if (isAdminUsingManagerPortal()) { setLocation("/"); return; }
    logout();
    setLocation("/manager/login");
  }

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    profileMutation.mutate({ name, phone, email });
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast("Пароли не совпадают", "error");
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) { setCropFile(file); e.target.value = ""; }
  }

  return (
    <div className="min-h-screen bg-[#f2f5f8]">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/manager/quotes")}
            className="text-slate-400 hover:text-slate-700 transition-colors"
            title="Назад к КП"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <svg viewBox="0 0 200 33" className="h-6 text-[#0070b8]" fill="currentColor">
            <path d="M33.7,15.9C33.4,6.8,25.7-.3,16.6,0,7.5.3.3,8.1,0,17.2c.1,2.7.8,5.2,2.1,7.4l2.7-4.2c-.33-1.04-.52-2.14-.56-3.29-.23-6.72,5.04-12.35,11.76-12.58,6.72-.23,12.35,5.04,12.58,11.76.23,6.72-5.04,12.35-11.76,12.58-1.35.05-2.64-.14-3.86-.5l.05-.05,6.41-17.46-.73.02s-11.61,18.14-11.77,18.66c0,0,.63.65,1.23,1.11.62.47,1.43.92,1.43.92,2.23,1.02,4.72,1.55,7.34,1.46,9.02-.3,16.09-7.85,15.79-16.88Z"/>
          </svg>
          <span className="font-semibold text-slate-900">Мой профиль</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500">
          <LogOut className="h-4 w-4 mr-1.5" />
          Выйти
        </Button>
      </header>

      <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />Загрузка...
          </div>
        ) : (
          <>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="h-4 w-4 text-[#0070b8]" />
                  Фото профиля
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 flex items-center justify-center flex-none">
                    {profile?.photoUrl ? (
                      <img
                        src={photoDisplayUrl()}
                        alt="Фото"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <User className="h-8 w-8 text-slate-400" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">Загрузите фото для КП. Оно будет отображаться в круглом аватаре.</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="h-4 w-4 mr-1.5" />
                      {profile?.photoUrl ? "Изменить фото" : "Загрузить фото"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-[#0070b8]" />
                  Личные данные
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="p-name">Имя</Label>
                    <Input id="p-name" value={name} onChange={e => setName(e.target.value)} required placeholder="Иван Иванов" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-phone">Телефон</Label>
                    <Input id="p-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (999) 000-00-00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-email">Email</Label>
                    <Input id="p-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="manager@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-400">Логин</Label>
                    <Input value={profile?.login ?? ""} disabled className="bg-slate-50 text-slate-400" />
                  </div>
                  <Button
                    type="submit"
                    disabled={profileMutation.isPending}
                    className="bg-[#0070b8] hover:bg-[#005a94] text-white"
                  >
                    {profileMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : "Сохранить"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Смена пароля</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pw-current">Текущий пароль</Label>
                    <Input
                      id="pw-current"
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pw-new">Новый пароль</Label>
                    <Input
                      id="pw-new"
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      minLength={6}
                      placeholder="Минимум 6 символов"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pw-confirm">Подтверждение</Label>
                    <Input
                      id="pw-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={passwordMutation.isPending}
                    className="bg-[#0070b8] hover:bg-[#005a94] text-white"
                  >
                    {passwordMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : "Изменить пароль"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {cropFile && (
        <PhotoCropEditor
          file={cropFile}
          saving={photoMutation.isPending}
          onCancel={() => setCropFile(null)}
          onSave={(crop) => photoMutation.mutate({ file: cropFile, crop })}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
