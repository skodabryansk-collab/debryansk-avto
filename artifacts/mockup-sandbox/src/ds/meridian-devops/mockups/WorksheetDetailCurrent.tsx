import type { ReactNode } from "react";
import { Badge } from "@workspace/meridian-devops/components/ui/badge";
import { Button } from "@workspace/meridian-devops/components/ui/button";
import { CarFront, Pencil } from "lucide-react";

const needs = [
  { brand: "Haval", model: "DARGO", budget: "3–5 млн", date: "Июнь 2026" },
  { brand: "JETOUR", model: "T2", budget: "5+ млн", date: "Не указана" },
];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
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
    <section className={`min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-card-foreground">{title}</h3>
        {count != null && <Badge variant="secondary">{count}</Badge>}
      </div>
      {children}
    </section>
  );
}

export function WorksheetDetailCurrent() {
  return (
    <div className="min-h-screen bg-background p-4 text-foreground sm:p-8">
      <div className="mx-auto flex max-h-[820px] max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <header className="shrink-0 border-b border-border px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-3 pr-10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Рабочий лист №142</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Создан 21 мая 2026, 14:32 · Алексей Смирнов
              </p>
            </div>
            <Button variant="outline" className="min-h-11 w-full sm:w-auto">
              <Pencil className="size-4" />
              Редактировать
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Клиент" className="lg:col-span-2">
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="ФИО" value="Илья Соколов" />
                <Field label="Телефон" value="+7 915 123-45-67" />
                <Field label="Пол" value="Мужской" />
              </dl>
            </Section>

            <Section title="Потребности" count={needs.length}>
              <div className="mt-4 space-y-3">
                {needs.map((need, index) => (
                  <article key={need.model} className="rounded-lg bg-muted p-3">
                    <div className="flex items-start gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-card text-xs font-semibold">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="break-words font-semibold">{need.brand} {need.model}</p>
                        <p className="mt-2 text-sm text-muted-foreground">Бюджет · {need.budget}</p>
                        <p className="mt-1 text-sm text-muted-foreground">Покупка · {need.date}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </Section>

            <Section title="Текущие автомобили" count={1}>
              <article className="mt-4 rounded-lg bg-muted p-3">
                <div className="flex items-start gap-3">
                  <CarFront className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="break-words font-semibold">Kia Sportage 2020</p>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Пробег" value="63 000 км" />
                      <Field label="Трейд-ин" value="Да" />
                      <Field label="Поколение" value="IV" />
                      <Field label="Владельцы" value="2" />
                    </dl>
                  </div>
                </div>
              </article>
            </Section>

            <Section title="Предложение">
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Автомобиль" value="Haval DARGO 2026" />
                <Field label="Цена" value="3 149 000 ₽" />
                <Field label="Способ оплаты" value="Кредит" />
                <Field label="VIN" value="LGWEEUA56PK123456" />
              </dl>
            </Section>

            <Section title="Данные из 1С">
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Менеджер ДЦ" value="Павел Морозов" />
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Статус</dt>
                  <dd className="mt-1">
                    <Badge variant="secondary">В работе</Badge>
                  </dd>
                  <p className="mt-2 text-sm text-muted-foreground">Рабочий лист у менеджера ДЦ.</p>
                </div>
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">Обновлено из 1С · 21 мая 2026, 15:04</p>
            </Section>

            <Section title="Комментарий менеджера" className="lg:col-span-2">
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Клиент планирует покупку в ближайший месяц. Сравнивает комплектации и условия кредита.
              </p>
            </Section>

            <Section title="История изменений" count={2} className="lg:col-span-2">
              <ol className="mt-4 space-y-2">
                <li className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">Алексей Смирнов · менеджер</span>
                    <span className="text-xs text-muted-foreground">21 мая 2026, 14:48 · 2 изменения</span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Было · Бюджет" value="2–3 млн" />
                    <Field label="Стало · Бюджет" value="3–5 млн" />
                  </div>
                </li>
                <li className="rounded-lg border border-border p-3">
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

