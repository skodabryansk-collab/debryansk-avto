import { EmailLayout, Banner, Heading, DataTable, ActionBlock, Hr } from "./EmailBase";

const accent = "#d97706";

export default function EmailTradeIn() {
  return (
    <EmailLayout accent={accent}>
      <Banner color={accent} label="Заявка на Trade-in" icon="🔄" />
      <Heading
        title="Trade-in: клиент хочет обменять автомобиль"
        sub="Клиент оставил данные своего авто для оценки"
      />
      <DataTable rows={[
        ["Имя клиента",      "Игорь Новиков"],
        ["Телефон",          "+7 (910) 234-56-78"],
        ["Марка / Модель",   "Toyota Camry"],
        ["Год выпуска",      "2019"],
        ["Пробег",           "87 000 км"],
        ["Состояние",        "Хорошее"],
        ["Владельцев",       "1"],
        ["Онлайн-оценка",    "1 200 000 — 1 450 000 ₽"],
        ["Комментарий",      "Небольшая царапина на бампере"],
        ["Источник",         "Кнопка Trade-in на сайте"],
        ["Дата / время",     "08.06.2026, 14:32"],
      ]} />
      <Hr />
      <ActionBlock
        phone="+7 (910) 234-56-78"
        label="Связаться и уточнить оценку"
        accent={accent}
      />
    </EmailLayout>
  );
}
