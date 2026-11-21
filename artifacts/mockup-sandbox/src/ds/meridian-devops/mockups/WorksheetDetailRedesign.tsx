import type { ReactNode } from "react";
import "./WorksheetDetailRedesign.css";
import { Glass } from "glisse";
import { Badge } from "@workspace/meridian-devops/components/ui/badge";
import { Button } from "@workspace/meridian-devops/components/ui/button";
import {
  ArrowRightLeft,
  CarFront,
  Clock3,
  History,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react";

const needs = [
  { brand: "Haval", model: "DARGO", budget: "3–5 млн", date: "Июнь 2026" },
  { brand: "JETOUR", model: "T2", budget: "5+ млн", date: "Не указана" },
];

function DataLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Section({
  title,
  count,
  children,
  className = "",
}: {
  title: string;
  count?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 border-t border-border pt-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {count != null && <Badge variant="secondary">{count}</Badge>}
      </div>
      {children}
    </section>
  );
}

export function WorksheetDetailRedesign() {
  return (
    <div className="min-h-screen bg-background p-3 text-foreground sm:p-6">
      <div className="mx-auto flex max-h-[840px] max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <header className="shrink-0 border-b border-border px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-col gap-3 pr-10 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono">РЛ №142</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-3.5" />
                  21 мая 2026, 14:32
                </span>
                <span>Алексей Смирнов</span>
              </div>
            </div>
            <Button variant="outline" className="min-h-11 w-full shrink-0 sm:w-auto">
              <Pencil className="size-4" />
              Редактировать
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <Glass
            data-theme="light"
            className="worksheet-glass grid gap-5 rounded-xl p-4 text-white sm:p-5 md:grid-cols-[1.1fr_0.9fr]"
          >
            <section className="min-w-0">
              <div className="flex items-center gap-2 text-white/70">
                <UserRound className="size-4" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em]">Клиент</h2>
              </div>
              <p className="mt-2 break-words text-2xl font-semibold tracking-tight sm:text-3xl">Илья Соколов</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm">
                <span className="inline-flex items-center gap-2">
                  <Phone className="size-4 text-white/65" />
                  +7 915 123-45-67
                </span>
                <span className="text-white/75">Мужской</span>
              </div>
            </section>

            <section className="min-w-0 border-t border-white/15 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
              <div className="flex items-center gap-2 text-white/70">
                <ArrowRightLeft className="size-4" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em]">Статус из 1С</h2>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge className="border border-white/15 bg-white/12 text-white hover:bg-white/12">В работе</Badge>
                <span className="text-sm text-white/75">Павел Морозов · менеджер ДЦ</span>
              </div>
              <p className="mt-3 text-xs text-white/65">Обновлено 21 мая 2026, 15:04</p>
            </section>
          </Glass>

          <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
            <Section title="Потребности" count={needs.length}>
              <div className="mt-3 divide-y divide-border">
                {needs.map((need, index) => (
                  <article key={need.model} className="flex min-w-0 gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted font-mono text-xs">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold">{need.brand} {need.model}</p>
                      <dl className="mt-2 grid grid-cols-2 gap-3">
                        <DataLine label="Бюджет" value={need.budget} />
                        <DataLine label="Покупка" value={need.date} />
                      </dl>
                    </div>
                  </article>
                ))}
              </div>
            </Section>

            <Section title="Текущий автомобиль" count={1}>
              <article className="mt-3 flex min-w-0 gap-3">
                <CarFront className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold">Kia Sportage 2020</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                    <DataLine label="Пробег" value="63 000 км" />
                    <DataLine label="Трейд-ин" value="Да" />
                    <DataLine label="Поколение" value="IV" />
                    <DataLine label="Владельцы" value="2" />
                  </dl>
                </div>
              </article>
            </Section>

            <Section title="Предложение">
              <div className="mt-3 flex min-w-0 flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="break-words text-lg font-semibold">Haval DARGO 2026</p>
                  <p className="mt-1 text-sm text-muted-foreground">Кредит · VIN LGWEEUA56PK123456</p>
                </div>
                <p className="shrink-0 text-right text-lg font-semibold text-primary">3 149 000 ₽</p>
              </div>
            </Section>

            <Section title="Комментарий менеджера">
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Клиент планирует покупку в ближайший месяц. Сравнивает комплектации и условия кредита.
              </p>
            </Section>

            <Section title="История изменений" count={2} className="md:col-span-2">
              <ol className="mt-3 divide-y divide-border">
                <li className="py-3 first:pt-0 last:pb-0">
                  <details open className="group">
                    <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">Алексей Смирнов · менеджер</span>
                      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        21 мая 2026, 14:48 · 2 изменения
                        <History className="size-4" />
                      </span>
                    </summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="min-w-0 border-l-2 border-border pl-3">
                        <p className="text-xs text-muted-foreground">Бюджет · было</p>
                        <p className="mt-1 break-words text-sm">2–3 млн</p>
                      </div>
                      <div className="min-w-0 border-l-2 border-primary pl-3">
                        <p className="text-xs text-muted-foreground">Бюджет · стало</p>
                        <p className="mt-1 break-words text-sm font-medium">3–5 млн</p>
                      </div>
                    </div>
                  </details>
                </li>
                <li className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">Алексей Смирнов · менеджер</span>
                    <span className="text-xs text-muted-foreground">21 мая 2026, 14:32 · создан</span>
                  </div>
                </li>
              </ol>
            </Section>
          </div>
        </main>
      </div>
    </div>
  );
}

