import { EmailLayout, Banner, Heading, DataTable, CarCard, ActionBlock, Hr } from "./EmailBase";

const accent = "#059669";

export default function EmailCredit() {
  return (
    <EmailLayout accent={accent}>
      <Banner color={accent} label="Заявка на автокредит" icon="💳" />
      <Heading
        title="Заявка на кредит"
        sub="Клиент рассчитал кредит и оставил заявку"
      />
      <CarCard mark="Haval" model="Jolion" year={2025} price={2450000} dealer="Haval City, Брянск" />
      <DataTable rows={[
        ["Имя клиента",          "Дмитрий Козлов"],
        ["Телефон",              "+7 (903) 765-43-21"],
        ["Стоимость авто",       "2 450 000 ₽"],
        ["Первоначальный взнос", "490 000 ₽ (20%)"],
        ["Срок кредита",         "60 мес."],
        ["Ежемесячный платёж",   "~44 000 ₽ / мес."],
        ["Итоговая сумма",       "~3 130 000 ₽"],
        ["Дилерский центр",      "Haval City, ул. Советская 77, Брянск"],
        ["Источник",             "/new-cars — кредитный калькулятор"],
        ["Дата / время",         "08.06.2026, 14:32"],
      ]} />
      <Hr />
      <ActionBlock
        phone="+7 (903) 765-43-21"
        label="Проконсультировать клиента по кредиту"
        accent={accent}
      />
    </EmailLayout>
  );
}
