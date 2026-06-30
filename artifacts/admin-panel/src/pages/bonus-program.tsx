import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  getBonusProgram,
  updateBonusProgram,
  type BonusPerk,
  type BonusDiscountLevel,
  type BonusAction,
  type BonusRulesSection,
  type BonusProgramData,
} from "@/lib/api";

const ICON_OPTIONS = ["Car", "Percent", "Gift", "TrendingUp", "Users", "Wrench"];

function useFormState(remote: BonusProgramData | null | undefined) {
  const [heroTitle, setHeroTitle] = useState("");
  const [heroDescription, setHeroDescription] = useState("");
  const [perks, setPerks] = useState<BonusPerk[]>([]);
  const [discountLevels, setDiscountLevels] = useState<BonusDiscountLevel[]>([]);
  const [redemptionRules, setRedemptionRules] = useState<string[]>([]);
  const [bonusActions, setBonusActions] = useState<BonusAction[]>([]);
  const [importantNotes, setImportantNotes] = useState("");
  const [fullRulesSections, setFullRulesSections] = useState<BonusRulesSection[]>([]);

  useEffect(() => {
    if (!remote) return;
    setHeroTitle(remote.hero_title ?? "");
    setHeroDescription(remote.hero_description ?? "");
    setPerks(remote.perks ?? []);
    setDiscountLevels(remote.discount_levels ?? []);
    setRedemptionRules(remote.redemption_rules ?? []);
    setBonusActions(remote.bonus_actions ?? []);
    setImportantNotes(remote.important_notes ?? "");
    setFullRulesSections(remote.full_rules_sections ?? []);
  }, [remote]);

  return {
    heroTitle, setHeroTitle,
    heroDescription, setHeroDescription,
    perks, setPerks,
    discountLevels, setDiscountLevels,
    redemptionRules, setRedemptionRules,
    bonusActions, setBonusActions,
    importantNotes, setImportantNotes,
    fullRulesSections, setFullRulesSections,
  };
}

export default function BonusProgramPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: remote, isLoading } = useQuery({
    queryKey: ["admin-bonus-program"],
    queryFn: getBonusProgram,
  });

  const form = useFormState(remote);

  const mutation = useMutation({
    mutationFn: () =>
      updateBonusProgram({
        hero_title: form.heroTitle,
        hero_description: form.heroDescription,
        perks: form.perks,
        discount_levels: form.discountLevels,
        redemption_rules: form.redemptionRules,
        bonus_actions: form.bonusActions,
        important_notes: form.importantNotes,
        full_rules_sections: form.fullRulesSections,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bonus-program"] });
      toast({ title: "Сохранено", description: "Бонусная программа обновлена." });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Бонусная программа</h1>
          <p className="text-sm text-slate-500 mt-0.5">Приказ №474 от 01.10.2024 — страница /service/bonus</p>
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="bg-[#0070b8] hover:bg-[#005fa0] gap-2"
        >
          <Save className="w-4 h-4" />
          {mutation.isPending ? "Сохраняю…" : "Сохранить"}
        </Button>
      </div>

      <Tabs defaultValue="hero">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="hero">Заголовок</TabsTrigger>
          <TabsTrigger value="perks">Преимущества</TabsTrigger>
          <TabsTrigger value="levels">Уровни</TabsTrigger>
          <TabsTrigger value="rules">Где списывать</TabsTrigger>
          <TabsTrigger value="actions">За что начисляется</TabsTrigger>
          <TabsTrigger value="notes">Важно</TabsTrigger>
          <TabsTrigger value="full-rules">Полные правила</TabsTrigger>
        </TabsList>

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <TabsContent value="hero" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Hero-секция</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Заголовок</Label>
                <Input
                  value={form.heroTitle}
                  onChange={e => form.setHeroTitle(e.target.value)}
                  placeholder="Бонусная программа Дебрянск Авто"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Описание</Label>
                <Textarea
                  value={form.heroDescription}
                  onChange={e => form.setHeroDescription(e.target.value)}
                  rows={4}
                  placeholder="Описание бонусной программы…"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Perks ─────────────────────────────────────────────────── */}
        <TabsContent value="perks" className="mt-4 space-y-3">
          {form.perks.map((perk, i) => (
            <Card key={i}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
                    <select
                      value={perk.icon}
                      onChange={e => {
                        const next = [...form.perks];
                        next[i] = { ...next[i], icon: e.target.value };
                        form.setPerks(next);
                      }}
                      className="border border-slate-200 rounded-md px-2 py-1.5 text-sm"
                    >
                      {ICON_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <Input
                      value={perk.title}
                      onChange={e => {
                        const next = [...form.perks];
                        next[i] = { ...next[i], title: e.target.value };
                        form.setPerks(next);
                      }}
                      placeholder="Заголовок"
                      className="flex-1"
                    />
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="text-slate-400 hover:text-red-500"
                    onClick={() => form.setPerks(form.perks.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <Textarea
                  value={perk.description}
                  onChange={e => {
                    const next = [...form.perks];
                    next[i] = { ...next[i], description: e.target.value };
                    form.setPerks(next);
                  }}
                  rows={2}
                  placeholder="Описание"
                  className="ml-7"
                />
              </CardContent>
            </Card>
          ))}
          <Button
            variant="outline" size="sm" className="gap-2"
            onClick={() => form.setPerks([...form.perks, { icon: "Gift", title: "", description: "" }])}
          >
            <Plus className="w-4 h-4" /> Добавить преимущество
          </Button>
        </TabsContent>

        {/* ── Discount levels ───────────────────────────────────────── */}
        <TabsContent value="levels" className="mt-4 space-y-3">
          {form.discountLevels.map((lvl, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label>Название</Label>
                    <Input
                      value={lvl.name}
                      onChange={e => {
                        const next = [...form.discountLevels];
                        next[i] = { ...next[i], name: e.target.value };
                        form.setDiscountLevels(next);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Порог (₽)</Label>
                    <Input
                      type="number" value={lvl.threshold}
                      onChange={e => {
                        const next = [...form.discountLevels];
                        next[i] = { ...next[i], threshold: Number(e.target.value) };
                        form.setDiscountLevels(next);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>% бонусов</Label>
                    <Input
                      type="number" value={lvl.percent}
                      onChange={e => {
                        const next = [...form.discountLevels];
                        next[i] = { ...next[i], percent: Number(e.target.value) };
                        form.setDiscountLevels(next);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Цвет</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="color" value={lvl.color}
                        onChange={e => {
                          const next = [...form.discountLevels];
                          next[i] = { ...next[i], color: e.target.value };
                          form.setDiscountLevels(next);
                        }}
                        className="w-10 h-9 px-1 cursor-pointer"
                      />
                      <Button
                        variant="ghost" size="icon" className="text-slate-400 hover:text-red-500"
                        onClick={() => form.setDiscountLevels(form.discountLevels.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button
            variant="outline" size="sm" className="gap-2"
            onClick={() => form.setDiscountLevels([
              ...form.discountLevels,
              { level: form.discountLevels.length + 1, name: "", threshold: 0, percent: 0, color: "#6b7280" },
            ])}
          >
            <Plus className="w-4 h-4" /> Добавить уровень
          </Button>
        </TabsContent>

        {/* ── Redemption rules ──────────────────────────────────────── */}
        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Где можно списать бонусы</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {form.redemptionRules.map((rule, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={rule}
                    onChange={e => {
                      const next = [...form.redemptionRules];
                      next[i] = e.target.value;
                      form.setRedemptionRules(next);
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost" size="icon" className="text-slate-400 hover:text-red-500"
                    onClick={() => form.setRedemptionRules(form.redemptionRules.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline" size="sm" className="gap-2 mt-2"
                onClick={() => form.setRedemptionRules([...form.redemptionRules, ""])}
              >
                <Plus className="w-4 h-4" /> Добавить правило
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Bonus actions ─────────────────────────────────────────── */}
        <TabsContent value="actions" className="mt-4 space-y-3">
          {form.bonusActions.map((action, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <Input
                    value={action.title}
                    onChange={e => {
                      const next = [...form.bonusActions];
                      next[i] = { ...next[i], title: e.target.value };
                      form.setBonusActions(next);
                    }}
                    className="flex-1 font-bold"
                    placeholder="Название группы"
                  />
                  <Button
                    variant="ghost" size="icon" className="text-slate-400 hover:text-red-500"
                    onClick={() => form.setBonusActions(form.bonusActions.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {action.items.map((item, j) => (
                  <div key={j} className="flex gap-2">
                    <Input
                      value={item}
                      onChange={e => {
                        const next = [...form.bonusActions];
                        const items = [...next[i].items];
                        items[j] = e.target.value;
                        next[i] = { ...next[i], items };
                        form.setBonusActions(next);
                      }}
                      className="flex-1 text-sm"
                    />
                    <Button
                      variant="ghost" size="icon" className="text-slate-400 hover:text-red-500"
                      onClick={() => {
                        const next = [...form.bonusActions];
                        next[i] = { ...next[i], items: next[i].items.filter((_, k) => k !== j) };
                        form.setBonusActions(next);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline" size="sm" className="gap-1.5 text-xs"
                  onClick={() => {
                    const next = [...form.bonusActions];
                    next[i] = { ...next[i], items: [...next[i].items, ""] };
                    form.setBonusActions(next);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Добавить пункт
                </Button>
              </CardContent>
            </Card>
          ))}
          <Button
            variant="outline" size="sm" className="gap-2"
            onClick={() => form.setBonusActions([...form.bonusActions, { title: "", items: [] }])}
          >
            <Plus className="w-4 h-4" /> Добавить группу
          </Button>
        </TabsContent>

        {/* ── Important notes ───────────────────────────────────────── */}
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Важное примечание</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={form.importantNotes}
                onChange={e => form.setImportantNotes(e.target.value)}
                rows={5}
                placeholder="Бонусные рубли не являются платёжным средством…"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Full rules ────────────────────────────────────────────── */}
        <TabsContent value="full-rules" className="mt-4 space-y-3">
          {form.fullRulesSections.map((section, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <Input
                    value={section.title}
                    onChange={e => {
                      const next = [...form.fullRulesSections];
                      next[i] = { ...next[i], title: e.target.value };
                      form.setFullRulesSections(next);
                    }}
                    className="flex-1 font-bold"
                    placeholder="Заголовок раздела"
                  />
                  <Button
                    variant="ghost" size="icon" className="text-slate-400 hover:text-red-500"
                    onClick={() => form.setFullRulesSections(form.fullRulesSections.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {section.items.map((item, j) => (
                  <div key={j} className="flex gap-2">
                    <Textarea
                      value={item}
                      onChange={e => {
                        const next = [...form.fullRulesSections];
                        const items = [...next[i].items];
                        items[j] = e.target.value;
                        next[i] = { ...next[i], items };
                        form.setFullRulesSections(next);
                      }}
                      rows={2}
                      className="flex-1 text-sm"
                    />
                    <Button
                      variant="ghost" size="icon" className="text-slate-400 hover:text-red-500 self-start mt-1"
                      onClick={() => {
                        const next = [...form.fullRulesSections];
                        next[i] = { ...next[i], items: next[i].items.filter((_, k) => k !== j) };
                        form.setFullRulesSections(next);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline" size="sm" className="gap-1.5 text-xs"
                  onClick={() => {
                    const next = [...form.fullRulesSections];
                    next[i] = { ...next[i], items: [...next[i].items, ""] };
                    form.setFullRulesSections(next);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Добавить пункт
                </Button>
              </CardContent>
            </Card>
          ))}
          <Button
            variant="outline" size="sm" className="gap-2"
            onClick={() => form.setFullRulesSections([...form.fullRulesSections, { title: "", items: [] }])}
          >
            <Plus className="w-4 h-4" /> Добавить раздел
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
