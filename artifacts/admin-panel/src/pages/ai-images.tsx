import React, { useRef, useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAiSessions, createAiSession, getAiMessages,
  generateAiImage, deleteAiSession, getAiStats,
  getBrandLogo, uploadBrandLogo, deleteBrandLogo, updateBrandLogoSettings,
  getBrandFonts, uploadBrandFont, deleteBrandFont,
  getLogoVariants, getSystemPrompts,
  uploadFile,
} from "@/lib/api";
import type { AiSession, AiMessage, BrandLogo, BrandFont, LogoVariant, SystemPrompt } from "@/lib/api";
import { ImageEditor } from "@/components/ImageEditor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Plus, Paperclip, Send, Loader2, Download,
  Upload, Trash2, MoreVertical, ListTodo, X, RotateCcw,
  ImageIcon, Pencil, Type,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── CSS variables for AI dark theme ─────────────────────────── */
const AI_THEME = `
  .ai-studio {
    --ai-bg-deep: #0a0a0f;
    --ai-surface: rgba(255 255 255 / 0.04);
    --ai-surface-hover: rgba(255 255 255 / 0.07);
    --ai-border: rgba(255 255 255 / 0.08);
    --ai-accent: #5E6AD2;
    --ai-accent-glow: rgba(94 106 210 / 0.25);
    --ai-text: #EDEDEF;
    --ai-text-muted: #8A8F98;
    --ai-success: #059669;
    --ai-radius: 14px;
    background: var(--ai-bg-deep);
    color: var(--ai-text);
    font-family: Inter, system-ui, sans-serif;
  }
  @media (prefers-reduced-motion: reduce) {
    .ai-studio * { transition: none !important; animation: none !important; }
  }
`;

const MODELS = [
  { value: "gemini/gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash" },
  { value: "gemini/gemini-3-pro-image-preview", label: "Gemini 3 Pro" },
  { value: "openai/gpt-image-2", label: "GPT Image 2" },
  { value: "black_forest_labs/flux-2-max", label: "Flux 2 Max · image-to-image" },
  { value: "black_forest_labs/flux-2-pro", label: "Flux 2 Pro · image-to-image" },
  { value: "black_forest_labs/flux-2-klein-9b", label: "Flux 2 Klein 9B · image-to-image" },
];

/** Модели, поддерживающие image-to-image через вложения */
const IMAGE_INPUT_MODELS = new Set([
  "gemini/gemini-3.1-flash-image-preview",
  "gemini/gemini-3-pro-image-preview",
  "black_forest_labs/flux-2-max",
  "black_forest_labs/flux-2-pro",
  "black_forest_labs/flux-2-klein-9b",
]);
const FLUX_MODELS = new Set([
  "black_forest_labs/flux-2-max",
  "black_forest_labs/flux-2-pro",
  "black_forest_labs/flux-2-klein-9b",
]);
const DEFAULT_IMAGE_INPUT_MODEL = "gemini/gemini-3.1-flash-image-preview";

const SIZES = [
  { value: "1024x1024", label: "1:1" },
  { value: "1024x1792", label: "9:16" },
  { value: "1792x1024", label: "16:9" },
];

const QUALITIES = [
  { value: "low",    label: "Низкое" },
  { value: "medium", label: "Среднее" },
  { value: "high",   label: "Высокое" },
];

const EXAMPLE_PROMPTS = [
  "Современный автосалон Дебрянск Авто снаружи ночью, неоновые огни, premium стиль",
  "Семья выбирает новый автомобиль в дилерском центре, тёплый свет, уютная атмосфера",
  "Детальный снимок руля и приборной панели нового кроссовера, кинематографичный свет",
  "Весенняя автомойка в дилерском центре, яркий день, сияющий автомобиль",
];

/* ── Helpers ─────────────────────────────────────────────────── */
function initials(login: string, fullName?: string | null): string {
  const name = fullName || login;
  const parts = name.split(/[\s@.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

function fmtTokenBadge(msg: AiMessage): string {
  const it = msg.input_text_tokens ?? 0;
  const ii = msg.input_image_tokens ?? 0;
  const ot = msg.output_tokens ?? 0;
  return `↑ ${it}t${ii ? `+${ii}img` : ""} / ↓ ${ot}t`;
}

/* ── Skeleton ─────────────────────────────────────────────────── */
function GeneratingSkeleton() {
  return (
    <div className="flex justify-start mb-4">
      <div
        className="w-full max-w-sm rounded-[14px] overflow-hidden animate-pulse"
        style={{ background: "var(--ai-surface)", border: "1px solid var(--ai-border)" }}
      >
        <div className="aspect-square w-full" style={{ background: "rgba(255 255 255 / 0.06)" }} />
        <div className="p-3 space-y-2">
          <div className="h-4 w-24 rounded" style={{ background: "rgba(255 255 255 / 0.08)" }} />
          <div className="h-8 w-full rounded" style={{ background: "rgba(255 255 255 / 0.05)" }} />
        </div>
      </div>
    </div>
  );
}

/* ── Session Card ─────────────────────────────────────────────── */
function SessionCard({
  session, active, onClick, onDelete,
}: {
  session: AiSession; active: boolean;
  onClick: () => void; onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="relative flex items-center gap-3 px-3 py-3 cursor-pointer rounded-lg transition-all duration-150"
      style={{
        background: active ? "var(--ai-surface-hover)" : "transparent",
        borderLeft: active ? "2px solid var(--ai-accent)" : "2px solid transparent",
        paddingLeft: active ? "calc(0.75rem - 2px)" : "0.75rem",
      }}
    >
      {/* Thumbnail or avatar */}
      {session.preview_url ? (
        <img
          src={session.preview_url}
          alt=""
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
          style={{ border: "1px solid var(--ai-border)" }}
        />
      ) : (
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--ai-surface)" }}
        >
          <ImageIcon className="w-5 h-5" style={{ color: "var(--ai-text-muted)" }} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--ai-text)" }}>
          {session.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Avatar className="w-4 h-4">
            <AvatarFallback className="text-[8px]" style={{ background: "var(--ai-accent)", color: "#fff" }}>
              {initials(session.admin_login, session.user_full_name)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs truncate" style={{ color: "var(--ai-text-muted)" }}>
            {fmtDate(session.created_at)}
          </span>
          {Number(session.message_count) > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-auto" style={{ background: "var(--ai-surface)" }}>
              {session.message_count}
            </Badge>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
          <button
            className="w-7 h-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "var(--ai-text-muted)" }}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={e => e.preventDefault()}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить сессию
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить сессию?</AlertDialogTitle>
                <AlertDialogDescription>
                  Все изображения и переписка этой сессии будут удалены безвозвратно.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive" onClick={onDelete}>Удалить</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ── Message Bubble ───────────────────────────────────────────── */
function UserBubble({ msg, onImageClick }: { msg: AiMessage; onImageClick?: (url: string) => void }) {
  const urls: string[] = Array.isArray(msg.image_urls) ? msg.image_urls as string[] : [];
  return (
    <div className="flex justify-end mb-4">
      <div
        className="max-w-[80%] rounded-2xl px-4 py-3"
        style={{ background: "var(--ai-surface-hover)", border: "1px solid var(--ai-border)" }}
      >
        {urls.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {urls.map((u, i) => (
              <img
                key={i} src={u} alt=""
                className="w-16 h-16 rounded-lg object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                onClick={() => onImageClick?.(u)}
              />
            ))}
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--ai-text)" }}>{msg.prompt}</p>
      </div>
    </div>
  );
}

function AssistantCard({
  msg, onUploadToSite, onEdit, onImageClick,
}: {
  msg: AiMessage;
  onUploadToSite: (url: string) => void;
  onEdit: (url: string) => void;
  onImageClick?: (url: string) => void;
}) {
  const handleDownload = () => {
    if (!msg.result_url) return;
    const a = document.createElement("a");
    a.href = msg.result_url;
    a.download = `ai-image-${msg.id}.png`;
    a.click();
  };

  if (msg.error_message) {
    return (
      <div className="flex justify-start mb-4">
        <div
          className="max-w-sm rounded-2xl p-4"
          style={{ background: "rgba(220 38 38 / 0.1)", border: "1px solid rgba(220 38 38 / 0.3)" }}
        >
          <p className="text-sm font-medium text-red-400 mb-1">Ошибка генерации</p>
          <p className="text-xs text-red-300/70 mb-3">{msg.error_message}</p>
        </div>
      </div>
    );
  }

  if (!msg.result_url) return null;

  return (
    <div className="flex justify-start mb-4">
      <div
        className="max-w-sm w-full rounded-[14px] overflow-hidden"
        style={{ border: "1px solid var(--ai-border)" }}
      >
        <img
          src={msg.result_url}
          alt={msg.prompt ?? ""}
          className="w-full aspect-square object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
          loading="lazy"
          onClick={() => onImageClick?.(msg.result_url!)}
        />
        <div className="p-3">
          {(msg.total_tokens ?? 0) > 0 && (
            <Badge
              variant="secondary"
              className="text-[11px] font-mono mb-2 tabular-nums"
              style={{ background: "var(--ai-surface)", color: "var(--ai-text-muted)", border: "1px solid var(--ai-border)" }}
            >
              {fmtTokenBadge(msg)}
            </Badge>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 text-xs"
              style={{ borderColor: "var(--ai-border)", color: "var(--ai-text)", background: "transparent" }}
              onClick={handleDownload}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Скачать
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 text-xs"
              style={{ borderColor: "var(--ai-accent)", color: "var(--ai-accent)", background: "transparent" }}
              onClick={() => onEdit(msg.result_url!)}
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Редактировать
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs px-2"
              style={{ color: "var(--ai-text-muted)" }}
              onClick={() => onUploadToSite(msg.result_url!)}
            >
              <Upload className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function AiImagesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gemini/gemini-3.1-flash-image-preview");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("medium");
  const [useSystemPrompt, setUseSystemPrompt] = useState(() =>
    localStorage.getItem("ai_studio_system_prompt") === "true"
  );
  const [activeSystemPromptId, setActiveSystemPromptId] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [skipAutoRef, setSkipAutoRef] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editingUrl, setEditingUrl] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);

  /* ── Queries ─────────────────────────────────────────────── */
  const { data: sessionsData } = useQuery({
    queryKey: ["ai-sessions"],
    queryFn: getAiSessions,
    refetchInterval: 30_000,
  });
  const sessions: AiSession[] = sessionsData?.data ?? [];

  const { data: brandLogoData, refetch: refetchLogo } = useQuery({
    queryKey: ["ai-brand-logo"],
    queryFn: getBrandLogo,
    staleTime: 60_000,
  });
  const brandLogo = brandLogoData?.data ?? null;
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { data: brandFontsData, refetch: refetchFonts } = useQuery({
    queryKey: ["ai-brand-fonts"],
    queryFn: getBrandFonts,
    staleTime: 60_000,
  });
  const brandFonts: BrandFont[] = brandFontsData?.data ?? [];

  const { data: messagesData, refetch: refetchMessages } = useQuery({
    queryKey: ["ai-messages", activeSessionId],
    queryFn: () => activeSessionId ? getAiMessages(activeSessionId) : null,
    enabled: !!activeSessionId,
  });
  const messages: AiMessage[] = messagesData?.data ?? [];

  /* ── Persist system prompt toggle ───────────────────────── */
  useEffect(() => {
    localStorage.setItem("ai_studio_system_prompt", String(useSystemPrompt));
  }, [useSystemPrompt]);

  /* ── Clear files + skip-ref flag when switching sessions ── */
  useEffect(() => {
    setFiles([]);
    setSkipAutoRef(false);
  }, [activeSessionId]);

  /* ── Auto-scroll ─────────────────────────────────────────── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isGenerating]);

  /* ── Create session ──────────────────────────────────────── */
  const createMutation = useMutation({
    mutationFn: () => createAiSession({ title: "Новая сессия", model }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["ai-sessions"] });
      setActiveSessionId(data.data.id);
      setDrawerOpen(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось создать сессию", variant: "destructive" }),
  });

  /* ── Delete session ──────────────────────────────────────── */
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAiSession(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["ai-sessions"] });
      if (activeSessionId === id) setActiveSessionId(null);
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось удалить сессию", variant: "destructive" }),
  });

  /* ── Brand logo ──────────────────────────────────────────── */
  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => uploadBrandLogo(file),
    onSuccess: () => {
      refetchLogo();
      toast({ title: "Логотип сохранён", description: "Теперь он доступен в редакторе изображений" });
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось загрузить логотип", variant: "destructive" }),
  });

  const deleteLogoMutation = useMutation({
    mutationFn: deleteBrandLogo,
    onSuccess: () => {
      refetchLogo();
      toast({ title: "Логотип удалён" });
    },
  });

  const updateLogoSettingsMutation = useMutation({
    mutationFn: updateBrandLogoSettings,
    onSuccess: () => refetchLogo(),
  });

  /* ── Brand fonts ─────────────────────────────────────────── */
  const uploadFontMutation = useMutation({
    mutationFn: ({ file, name }: { file: File; name: string }) => uploadBrandFont(file, name),
    onSuccess: () => {
      refetchFonts();
      toast({ title: "Шрифт загружен", description: "Доступен в редакторе изображений" });
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось загрузить шрифт", variant: "destructive" }),
  });

  const deleteFontMutation = useMutation({
    mutationFn: (name: string) => deleteBrandFont(name),
    onSuccess: () => refetchFonts(),
    onError: () => toast({ title: "Ошибка", description: "Не удалось удалить шрифт", variant: "destructive" }),
  });

  const handleFontUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\.[^.]+$/, "");
    uploadFontMutation.mutate({ file, name });
    e.target.value = "";
  }, [uploadFontMutation]);

  /* ── File handling ───────────────────────────────────────── */
  const validateAndAddFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    for (const f of arr) {
      if (f.size > 4 * 1024 * 1024) {
        toast({ title: "Файл слишком большой", description: `${f.name} превышает 4 МБ`, variant: "destructive" });
        return;
      }
    }
    setFiles(prev => [...prev, ...arr].slice(0, 5));
    // Auto-switch to a Gemini model if current model doesn't support image input
    setModel(prev => {
      if (!IMAGE_INPUT_MODELS.has(prev)) {
        toast({
          title: "Модель переключена на Gemini",
          description: "GPT Image 2 не поддерживает вложения. Используется Gemini 3.1 Flash.",
        });
        return DEFAULT_IMAGE_INPUT_MODEL;
      }
      return prev;
    });
  }, [toast]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) validateAndAddFiles(e.dataTransfer.files);
  };

  /* ── Generate ────────────────────────────────────────────── */
  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    if (FLUX_MODELS.has(model) && files.length === 0) {
      const hasPreviousImage = messages.some(m => m.role === "assistant" && !!m.result_url);
      if (!hasPreviousImage) {
        toast({
          title: "Flux работает с исходным изображением",
          description: "Прикрепите фото или сначала создайте изображение через Gemini.",
          variant: "destructive",
        });
        return;
      }
    }
    if (!activeSessionId) {
      const sess = await createMutation.mutateAsync();
      await doGenerate(sess.data.id);
    } else {
      await doGenerate(activeSessionId);
    }
  };

  const doGenerate = async (sessionId: number) => {
    setIsGenerating(true);
    const fd = new FormData();
    fd.append("prompt", prompt.trim());
    fd.append("model", model);
    fd.append("size", size);
    if (model === "openai/gpt-image-2") fd.append("quality", quality);
    if (useSystemPrompt) {
      fd.append("include_system_prompt", "true");
      if (activeSystemPromptId) fd.append("system_prompt_id", String(activeSystemPromptId));
    }
    for (const f of files) fd.append("files", f);
    if (skipAutoRef) fd.append("skip_auto_ref", "true");

    setPrompt("");
    setFiles([]);
    setSkipAutoRef(false);

    try {
      await generateAiImage(sessionId, fd);
      await refetchMessages();
      await qc.invalidateQueries({ queryKey: ["ai-sessions"] });
    } catch (err) {
      await refetchMessages(); // still show error card
      toast({ title: "Ошибка генерации", description: String(err), variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUploadToSite = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], "ai-image.png", { type: "image/png" });
      const uploadedUrl = await uploadFile(file);
      await navigator.clipboard.writeText(uploadedUrl);
      toast({ title: "Готово!", description: "URL изображения скопирован в буфер обмена" });
    } catch {
      toast({ title: "Ошибка", description: "Не удалось загрузить изображение", variant: "destructive" });
    }
  };

  /* ── Keyboard shortcut ────────────────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  /* ── Session list panel (shared between sidebar and drawer) ─ */
  const SessionPanel = () => (
    <div className="flex flex-col h-full">
      <Button
        className="w-full h-11 font-semibold text-sm mb-3"
        style={{ background: "var(--ai-accent)", color: "#fff", border: "none" }}
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending}
      >
        {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
        Новая сессия
      </Button>

      <div className="flex-1 overflow-y-auto space-y-0.5 -mx-1">
        {sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--ai-surface)" }}>
              <Sparkles className="w-6 h-6" style={{ color: "var(--ai-accent)" }} />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--ai-text)" }}>Создайте первую сессию</p>
            <p className="text-xs" style={{ color: "var(--ai-text-muted)" }}>Каждая сессия — отдельная история генерации</p>
          </div>
        )}
        {sessions.map(s => (
          <div key={s.id} className="group">
            <SessionCard
              session={s}
              active={activeSessionId === s.id}
              onClick={() => { setActiveSessionId(s.id); setDrawerOpen(false); }}
              onDelete={() => deleteMutation.mutate(s.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <>
      <style>{AI_THEME}</style>
      <div
        className="ai-studio flex h-[calc(100dvh-0px)] overflow-hidden"
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {/* ── Desktop sidebar ─────────────────────────────── */}
        <aside
          className="hidden lg:flex flex-col w-[260px] flex-shrink-0 p-3 overflow-hidden"
          style={{ borderRight: "1px solid var(--ai-border)" }}
        >
          <div className="flex items-center gap-2 mb-4 px-1">
            <Sparkles className="w-5 h-5" style={{ color: "var(--ai-accent)" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--ai-text)" }}>AI‑студия</span>
          </div>

          {/* ── Brand logo widget ── */}
          <div className="mb-3 rounded-xl p-3" style={{ background: "var(--ai-surface)", border: "1px solid var(--ai-border)" }}>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--ai-text-muted)" }}>Логотип бренда</p>
            {brandLogo ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <img src={brandLogo.url} alt="Логотип" className="w-10 h-10 object-contain rounded-lg flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs" style={{ color: "var(--ai-text)" }}>Загружен · Sharp-compositing</p>
                    <button onClick={() => deleteLogoMutation.mutate()} className="text-xs mt-0.5 hover:underline" style={{ color: "var(--ai-text-muted)" }}>
                      Удалить
                    </button>
                  </div>
                </div>

                {/* Position picker — 2×2 corner grid */}
                <div>
                  <p className="text-[10px] mb-1" style={{ color: "var(--ai-text-muted)" }}>Позиция</p>
                  <div className="grid grid-cols-2 gap-1">
                    {([
                      { v: "northwest", label: "↖" },
                      { v: "northeast", label: "↗" },
                      { v: "southwest", label: "↙" },
                      { v: "southeast", label: "↘" },
                    ] as const).map(({ v, label }) => (
                      <button
                        key={v}
                        onClick={() => updateLogoSettingsMutation.mutate({ position: v })}
                        className="h-7 rounded-lg text-sm transition-all"
                        style={{
                          background: brandLogo.position === v ? "var(--ai-accent)" : "rgba(255,255,255,0.05)",
                          color: brandLogo.position === v ? "#fff" : "var(--ai-text-muted)",
                          border: `1px solid ${brandLogo.position === v ? "var(--ai-accent)" : "var(--ai-border)"}`,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Size picker */}
                <div>
                  <p className="text-[10px] mb-1" style={{ color: "var(--ai-text-muted)" }}>Размер: {brandLogo.size_pct}% ширины</p>
                  <div className="flex gap-1">
                    {[10, 15, 20, 25].map(s => (
                      <button
                        key={s}
                        onClick={() => updateLogoSettingsMutation.mutate({ size_pct: s })}
                        className="flex-1 h-7 rounded-lg text-[11px] transition-all"
                        style={{
                          background: brandLogo.size_pct === s ? "var(--ai-accent)" : "rgba(255,255,255,0.05)",
                          color: brandLogo.size_pct === s ? "#fff" : "var(--ai-text-muted)",
                          border: `1px solid ${brandLogo.size_pct === s ? "var(--ai-accent)" : "var(--ai-border)"}`,
                        }}
                      >
                        {s}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadLogoMutation.isPending}
                className="w-full flex items-center justify-center gap-2 h-9 rounded-lg text-xs transition-all"
                style={{ border: "1px dashed var(--ai-border)", color: "var(--ai-text-muted)", background: "transparent" }}
              >
                {uploadLogoMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Загрузить логотип
              </button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/svg+xml,image/webp,image/jpeg"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogoMutation.mutate(f); e.target.value = ""; }}
            />
          </div>

          {/* ── Шрифты бренда ─────────────────────────────── */}
          <div
            className="mb-3 rounded-xl p-3"
            style={{ background: "var(--ai-surface)", border: "1px solid var(--ai-border)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Type className="w-3 h-3" style={{ color: "var(--ai-text-muted)" }} />
                <p className="text-xs font-medium" style={{ color: "var(--ai-text-muted)" }}>Шрифты бренда</p>
              </div>
              <button
                onClick={() => fontInputRef.current?.click()}
                disabled={uploadFontMutation.isPending}
                className="text-xs transition-colors"
                style={{ color: "var(--ai-accent)" }}
              >
                {uploadFontMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "+ Добавить"}
              </button>
            </div>

            {brandFonts.length === 0 ? (
              <p className="text-[11px] text-center py-1" style={{ color: "var(--ai-text-muted)" }}>
                Загрузите TTF/OTF/WOFF2 для использования в редакторе
              </p>
            ) : (
              <div className="space-y-1">
                {brandFonts.map(f => (
                  <div key={f.name} className="flex items-center justify-between px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <span className="text-xs truncate" style={{ color: "var(--ai-text)" }}>{f.name}</span>
                    <button
                      onClick={() => deleteFontMutation.mutate(f.name)}
                      className="ml-2 w-5 h-5 flex items-center justify-center rounded transition-colors flex-shrink-0"
                      style={{ color: "var(--ai-text-muted)" }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fontInputRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              className="hidden"
              onChange={handleFontUpload}
            />
          </div>

          <SessionPanel />
        </aside>

        {/* ── Chat area ───────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile sticky header */}
          <div
            className="flex lg:hidden items-center gap-3 px-4 py-3 sticky top-0 z-10"
            style={{ borderBottom: "1px solid var(--ai-border)", background: "var(--ai-bg-deep)", backdropFilter: "blur(12px)" }}
          >
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
              <DrawerTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2" style={{ borderColor: "var(--ai-border)", color: "var(--ai-text)", background: "transparent" }}>
                  <ListTodo className="w-4 h-4" />
                  Сессии
                  {sessions.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 h-4">{sessions.length}</Badge>
                  )}
                </Button>
              </DrawerTrigger>
              <DrawerContent className="h-[70vh]" style={{ background: "var(--ai-bg-deep)", borderColor: "var(--ai-border)" }}>
                <DrawerHeader>
                  <DrawerTitle style={{ color: "var(--ai-text)" }}>Сессии</DrawerTitle>
                </DrawerHeader>
                <div className="px-4 pb-4 flex-1 overflow-y-auto">
                  <SessionPanel />
                </div>
              </DrawerContent>
            </Drawer>

            <span className="text-sm font-medium truncate flex-1" style={{ color: "var(--ai-text)" }}>
              {sessions.find(s => s.id === activeSessionId)?.title ?? "AI‑студия"}
            </span>

            {/* Model select mobile */}
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="text-xs rounded-lg px-2 py-1 h-8 border"
              style={{ background: "var(--ai-surface)", color: "var(--ai-text-muted)", borderColor: "var(--ai-border)" }}
            >
              {MODELS.map(m => (
                <option key={m.value} value={m.value}>
                  {IMAGE_INPUT_MODELS.has(m.value) ? `🖼 ${m.label}` : m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Chat feed */}
          <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6" style={{ scrollBehavior: "smooth" }}>
            {/* Empty state */}
            {!activeSessionId && (
              <div className="flex flex-col items-center justify-center h-full gap-6 text-center max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "var(--ai-accent-glow)", border: "1px solid var(--ai-accent)" }}>
                  <Sparkles className="w-8 h-8" style={{ color: "var(--ai-accent)" }} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--ai-text)" }}>AI‑генератор изображений</h2>
                  <p className="text-sm" style={{ color: "var(--ai-text-muted)" }}>Создайте новую сессию или выберите существующую</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                  {EXAMPLE_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => { setPrompt(p); createMutation.mutate(); }}
                      className="text-left px-3 py-2.5 rounded-xl text-xs transition-all duration-150"
                      style={{
                        background: "var(--ai-surface)",
                        border: "1px solid var(--ai-border)",
                        color: "var(--ai-text-muted)",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--ai-surface-hover)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "var(--ai-surface)")}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Session with no messages */}
            {activeSessionId && messages.length === 0 && !isGenerating && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <Sparkles className="w-10 h-10 opacity-30" style={{ color: "var(--ai-text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--ai-text-muted)" }}>Введите промпт и нажмите «Сгенерировать»</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {EXAMPLE_PROMPTS.slice(0, 2).map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setPrompt(p)}
                      className="px-3 py-1.5 rounded-full text-xs transition-all duration-150"
                      style={{ background: "var(--ai-surface)", border: "1px solid var(--ai-border)", color: "var(--ai-text-muted)" }}
                    >
                      {p.slice(0, 40)}…
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {activeSessionId && messages.map(msg => (
              msg.role === "user"
                ? <UserBubble key={msg.id} msg={msg} onImageClick={setLightboxUrl} />
                : <AssistantCard key={msg.id} msg={msg} onUploadToSite={handleUploadToSite} onEdit={setEditingUrl} onImageClick={setLightboxUrl} />
            ))}

            {/* Generating skeleton */}
            {isGenerating && <GeneratingSkeleton />}

            <div ref={chatEndRef} />
          </div>

          {/* ── Input form ────────────────────────────────── */}
          {activeSessionId !== null || true ? (
            <div
              className={cn(
                "sticky bottom-0 px-4 lg:px-8 pt-3 pb-safe-or-3 transition-all duration-200",
                isDragging && "ring-2 ring-inset",
              )}
              style={{
                background: "rgba(10 10 15 / 0.9)",
                backdropFilter: "blur(12px)",
                borderTop: "1px solid var(--ai-border)",
                paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
                ...(isDragging ? { ringColor: "var(--ai-accent)" } : {}),
              }}
            >
              {/* Attached files */}
              {(files.length > 0 || (() => {
                const lastResult = messages.filter(m => m.role === "assistant" && m.result_url).slice(-1)[0];
                return !skipAutoRef && files.length === 0 && !!lastResult;
              })()) && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                      style={{ background: "var(--ai-surface)", border: "1px solid var(--ai-border)", color: "var(--ai-text-muted)" }}
                    >
                      {f.name.slice(0, 20)}
                      <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {/* Auto-ref indicator: shown when no files attached but session has a previous result */}
                  {files.length === 0 && !skipAutoRef && (() => {
                    const lastResult = messages.filter(m => m.role === "assistant" && m.result_url).slice(-1)[0];
                    if (!lastResult) return null;
                    return (
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                        style={{ background: "rgba(94,106,210,0.12)", border: "1px solid rgba(94,106,210,0.3)", color: "rgba(165,173,255,0.9)" }}
                      >
                        ↩ Редактирование предыдущего
                        <button
                          onClick={() => setSkipAutoRef(true)}
                          title="Начать с чистого листа (без базового изображения)"
                          style={{ color: "rgba(165,173,255,0.6)" }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              <Textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Опишите изображение… (Ctrl+Enter для отправки)"
                className="w-full resize-none text-sm border-0 focus-visible:ring-0 mb-2"
                style={{
                  minHeight: 80,
                  background: "var(--ai-surface)",
                  color: "var(--ai-text)",
                  borderRadius: "var(--ai-radius)",
                  border: "1px solid var(--ai-border)",
                  caretColor: "var(--ai-accent)",
                  touchAction: "manipulation",
                  fontSize: 16, // prevents iOS zoom
                }}
                rows={3}
              />

              <div className="flex items-center gap-2 flex-wrap">
                {/* File attach */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files && validateAndAddFiles(e.target.files)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-150"
                  style={{ background: "var(--ai-surface)", border: "1px solid var(--ai-border)", color: "var(--ai-text-muted)" }}
                  title="Прикрепить фото"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                {/* System prompt toggle */}
                <SystemPromptToggle
                  useSystemPrompt={useSystemPrompt}
                  setUseSystemPrompt={setUseSystemPrompt}
                  activeSystemPromptId={activeSystemPromptId}
                  setActiveSystemPromptId={setActiveSystemPromptId}
                />

                {/* Model select — desktop */}
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="hidden lg:block text-xs rounded-xl px-3 h-11 border flex-shrink-0"
                  style={{ background: "var(--ai-surface)", color: "var(--ai-text-muted)", borderColor: "var(--ai-border)" }}
                >
                  {MODELS.map(m => (
                    <option key={m.value} value={m.value}>
                      {IMAGE_INPUT_MODELS.has(m.value) ? `🖼 ${m.label}` : m.label}
                    </option>
                  ))}
                </select>

                {/* Size select */}
                <select
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  className="text-xs rounded-xl px-3 h-11 border flex-shrink-0"
                  style={{ background: "var(--ai-surface)", color: "var(--ai-text-muted)", borderColor: "var(--ai-border)" }}
                >
                  {SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>

                {/* Quality select — only GPT Image 2 */}
                {model === "openai/gpt-image-2" && (
                  <select
                    value={quality}
                    onChange={e => setQuality(e.target.value)}
                    className="text-xs rounded-xl px-3 h-11 border flex-shrink-0"
                    style={{ background: "var(--ai-surface)", color: "var(--ai-text-muted)", borderColor: "var(--ai-border)" }}
                  >
                    {QUALITIES.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
                  </select>
                )}

                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="ml-auto h-11 px-5 font-semibold text-sm min-w-[140px]"
                  style={{
                    background: "var(--ai-accent)",
                    color: "#fff",
                    opacity: (!prompt.trim() || isGenerating) ? 0.5 : 1,
                    transition: "all 150ms",
                  }}
                  onMouseDown={e => { e.currentTarget.style.transform = "scale(0.97)"; }}
                  onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  {isGenerating
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Генерация…</>
                    : <><Send className="w-4 h-4 mr-2" />Сгенерировать</>
                  }
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Image Editor overlay ──────────────────────────── */}
      {editingUrl && (
        <ImageEditorWithVariants
          imageUrl={editingUrl}
          brandLogo={brandLogo}
          fonts={brandFonts}
          onClose={() => setEditingUrl(null)}
        />
      )}

      {/* ── Lightbox ──────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.88)" }}
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 rounded-full p-2 hover:bg-white/10 transition-colors"
            style={{ color: "#fff" }}
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-[92vw] max-h-[92vh] rounded-xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

/* ── Stats widget (used on dashboard) ───────────────────────── */
export function AiImagesStatsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-images-stats"],
    queryFn: getAiStats,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="font-semibold text-sm">AI‑студия</span>
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const initStr = (login: string, name?: string | null) => {
    const s = name || login;
    return s.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-sm">AI‑студия</span>
          <Badge variant="secondary" className="ml-auto text-[10px]">30 дней</Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Сессий", value: data.sessions },
            { label: "Запросов", value: data.requests },
            { label: "Токенов", value: (data.tokens?.total ?? 0).toLocaleString("ru-RU") },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-lg font-bold text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Tokens breakdown */}
        {data.tokens && (
          <div className="space-y-1 mb-4 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Текст (вход)</span><span className="tabular-nums">{data.tokens.inputText.toLocaleString("ru-RU")} t</span>
            </div>
            <div className="flex justify-between">
              <span>Фото (вход)</span><span className="tabular-nums">{data.tokens.inputImage.toLocaleString("ru-RU")} t</span>
            </div>
            <div className="flex justify-between">
              <span>Изображения (выход)</span><span className="tabular-nums">{data.tokens.output.toLocaleString("ru-RU")} t</span>
            </div>
          </div>
        )}

        {/* Top users */}
        {(data.topUsers ?? []).length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Топ пользователи</p>
            {data.topUsers.slice(0, 3).map((u: { admin_login: string; full_name: string; total_tokens: number; requests: number }) => (
              <div key={u.admin_login} className="flex items-center gap-2">
                <Avatar className="w-6 h-6">
                  <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-700">{initStr(u.admin_login, u.full_name)}</AvatarFallback>
                </Avatar>
                <span className="text-xs flex-1 truncate">{u.full_name || u.admin_login}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{Number(u.total_tokens).toLocaleString("ru-RU")} t</span>
              </div>
            ))}
          </div>
        )}

        {/* Models */}
        {(data.byModel ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.byModel.map((m: { model: string; count: number }) => (
              <Badge key={m.model} variant="secondary" className="text-[10px]">
                {m.model.split("/").pop()} · {m.count}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* keep RotateCcw import used */
void RotateCcw;

/* ── SystemPromptToggle ────────────────────────────────────── */
function SystemPromptToggle({
  useSystemPrompt, setUseSystemPrompt, activeSystemPromptId, setActiveSystemPromptId,
}: {
  useSystemPrompt: boolean;
  setUseSystemPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  activeSystemPromptId: number | null;
  setActiveSystemPromptId: React.Dispatch<React.SetStateAction<number | null>>;
}) {
  const { data } = useQuery({ queryKey: ["system-prompts"], queryFn: getSystemPrompts, staleTime: 60_000 });
  const prompts: SystemPrompt[] = data?.data ?? [];
  const defaultPrompt = prompts.find(p => p.is_default) ?? prompts[0];
  const activePrompt = prompts.find(p => p.id === activeSystemPromptId) ?? defaultPrompt;

  if (prompts.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setUseSystemPrompt(v => !v)}
        className="h-11 px-3 flex items-center gap-1.5 rounded-xl text-xs font-medium transition-all duration-150"
        style={{
          background: useSystemPrompt ? "var(--ai-accent)" : "var(--ai-surface)",
          border: `1px solid ${useSystemPrompt ? "var(--ai-accent)" : "var(--ai-border)"}`,
          color: useSystemPrompt ? "#fff" : "var(--ai-text-muted)",
        }}
        title={useSystemPrompt ? "Выключить системный промпт" : "Включить системный промпт"}
      >
        <span className="text-[10px] font-bold">СП</span>
        {useSystemPrompt && activePrompt && (
          <span className="max-w-[80px] truncate">{activePrompt.name}</span>
        )}
      </button>
      {useSystemPrompt && prompts.length > 1 && (
        <select
          value={activeSystemPromptId ?? ""}
          onChange={e => setActiveSystemPromptId(e.target.value ? Number(e.target.value) : null)}
          className="h-11 px-2 rounded-xl text-xs border"
          style={{ background: "var(--ai-surface)", color: "var(--ai-text-muted)", borderColor: "var(--ai-border)", maxWidth: 120 }}
        >
          <option value="">По умолчанию</option>
          {prompts.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}

/* ── ImageEditorWithVariants ───────────────────────────────── */
function ImageEditorWithVariants({
  imageUrl, brandLogo, fonts, onClose,
}: {
  imageUrl: string;
  brandLogo: BrandLogo | null;
  fonts: BrandFont[];
  onClose: () => void;
}) {
  const { data } = useQuery({ queryKey: ["logo-variants"], queryFn: getLogoVariants, staleTime: 60_000 });
  const logoVariants: LogoVariant[] = data?.data ?? [];
  return (
    <ImageEditor
      imageUrl={imageUrl}
      brandLogo={brandLogo}
      logoVariants={logoVariants}
      fonts={fonts}
      onClose={onClose}
    />
  );
}
