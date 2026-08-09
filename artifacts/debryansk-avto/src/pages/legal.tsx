import React from "react";
import { Helmet } from "react-helmet-async";
import Layout from "@/components/Layout";
import { CTPhone } from "@/components/CTPhone";

export default function LegalPage() {
  return (
    <Layout>
      <Helmet>
        <title>Юридическая информация | Дебрянск Авто</title>
        <meta name="description" content="Юридическая информация, реквизиты и банковские данные ООО «Дебрянск Авто» — официального мультибрендового автодилера в Брянске." />
      </Helmet>

      <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-14 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">
          Юридическая информация
        </h1>
        <p className="text-sm text-slate-500 mb-8">ООО «Дебрянск Авто» — официальный автодилер в Брянске</p>

        <div className="space-y-8 text-sm sm:text-base text-slate-700">

          {/* Головная организация */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Головная организация</h2>
            <div className="bg-slate-50 rounded-xl p-5 space-y-2.5">
              <Row label="Полное наименование" value="Общество с ограниченной ответственностью «Дебрянск Авто»" />
              <Row label="Сокращённое наименование" value="ООО «Дебрянск Авто»" />
              <Row label="Юридический адрес" value="241050, г. Брянск, ул. Советская, д. 77" />
              <Row label="Фактический адрес" value="241050, г. Брянск, ул. Советская, д. 77" />
              <Row label="Почтовый адрес" value="241050, г. Брянск, ул. Советская, д. 77" />
              <RowPhone label="Телефон / Факс" phone="+74832777770" display="+7 (4832) 77-77-70" />
              <Row label="ИНН" value="3250521481" />
              <Row label="КПП" value="325701001" />
              <Row label="ОГРН" value="1113256000615" />
              <Row label="Дата регистрации" value="24 января 2011 г., г. Брянск" />
              <Row label="Регистрирующий орган" value="МРИ ФНС № 10 по Брянской области" />
              <Row label="Генеральный директор" value="Веденин Сергей Викторович" />
            </div>
          </section>

          {/* Обособленное подразделение */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Обособленное подразделение</h2>
            <div className="bg-slate-50 rounded-xl p-5 space-y-2.5">
              <Row label="Наименование" value="ООО «Дебрянск Авто» (ОП Дебрянск Авто Литейная)" />
              <Row label="Юридический адрес" value="241050, г. Брянск, ул. Советская, д. 77" />
              <Row label="Фактический адрес" value="Брянская область, г. Брянск, ул. Литейная, строение 3/2" />
              <Row label="ИНН" value="3250521481" />
              <Row label="КПП" value="320045001" />
              <Row label="ОГРН" value="1113256000615" />
            </div>
          </section>

          {/* Банковские реквизиты */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Банковские реквизиты</h2>
            <div className="bg-slate-50 rounded-xl p-5 space-y-2.5">
              <Row label="Банк" value='АО "Райффайзенбанк", г. Москва' />
              <Row label="Расчётный счёт" value="40702810100001489079" mono />
              <Row label="Корреспондентский счёт" value="30101810200000000700" mono />
              <Row label="БИК" value="044525700" mono />
            </div>
          </section>

          {/* Документы */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Документы</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DocLink href="/privacy" label="Политика конфиденциальности" desc="Обработка персональных данных" />
            </div>
          </section>

          {/* Контакты */}
          <section className="pt-2">
            <p className="text-slate-500 text-sm">
              По вопросам сотрудничества и документам:{" "}
              <a href="mailto:info@debryansk-auto.ru" className="text-primary hover:underline">
                info@debryansk-auto.ru
              </a>{" "}
              или{" "}
              <CTPhone className="text-primary hover:underline" phone="+7 (4832) 77-77-70">+7 (4832) 77-77-70</CTPhone>.
            </p>
          </section>

        </div>
      </div>
    </Layout>
  );
}

/* ── Вспомогательные компоненты ── */

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4">
      <span className="text-slate-500 shrink-0 sm:w-48">{label}:</span>
      <span className={`font-medium text-slate-800 ${mono ? "font-mono text-sm tracking-wide" : ""}`}>{value}</span>
    </div>
  );
}

function RowPhone({ label, phone, display }: { label: string; phone: string; display: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4">
      <span className="text-slate-500 shrink-0 sm:w-48">{label}:</span>
      <CTPhone className="font-medium text-primary hover:underline" phone={display}>{display}</CTPhone>
    </div>
  );
}

function DocLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <a
      href={href}
      className="flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-primary hover:shadow-sm transition-all group"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-slate-800 text-sm group-hover:text-primary transition-colors">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
    </a>
  );
}
