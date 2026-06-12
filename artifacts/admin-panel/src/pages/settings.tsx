import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSetting } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, Phone } from "lucide-react";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (settings?.header_phone !== undefined) {
      setPhone(settings.header_phone);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: () => updateSetting("header_phone", phone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Сохранено", description: "Телефон в шапке обновлён." });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-5 h-5 text-[#0070b8]" />
        <h1 className="text-xl font-bold text-slate-900">Настройки сайта</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="header_phone" className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Phone className="w-4 h-4" />
            Телефон в шапке сайта
          </Label>
          <Input
            id="header_phone"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+7 (4832) 000-000"
            disabled={isLoading}
            className="font-mono"
          />
          <p className="text-xs text-slate-400">
            Отображается в верхней строке на всех страницах сайта.
          </p>
        </div>

        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || isLoading}
          className="bg-[#0070b8] hover:bg-[#005a96] text-white"
        >
          {mutation.isPending ? "Сохранение…" : "Сохранить изменения"}
        </Button>
      </div>
    </div>
  );
}
