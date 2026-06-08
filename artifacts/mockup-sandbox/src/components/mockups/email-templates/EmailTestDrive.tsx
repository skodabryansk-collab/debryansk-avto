import { EmailLayout, Banner, Heading, DataTable, CarCard, ActionBlock, Hr } from "./EmailBase";

const accent = "#0070b8";

export default function EmailTestDrive() {
  return (
    <EmailLayout accent={accent}>
      <Banner color={accent} label="Запись на тест-драйв" icon="🏁" />
      <Heading
        title="Новая запись на тест-драйв"
        sub="Клиент выбрал автомобиль и хочет приехать"
      />
      <CarCard mark="OMODA" model="C5" year={2025} price={2890000} dealer="OMODA · JAECOO, с. Супонево" />
      <DataTable rows={[
        ["Имя клиента",     "Мария Соколова"],
        ["Телефон",         "+7 (915) 123-45-67"],
        ["Желаемая дата",   "15 июня 2026"],
        ["Желаемое время",  "11:00"],
        ["Дилерский центр", "OMODA · JAECOO, с. Супонево"],
        ["Комментарий",     "Интересует полный привод, хочу сравнить с S5"],
        ["Источник",        "/new-cars — карточка OMODA C5"],
        ["Дата / время",    "08.06.2026, 14:32"],
      ]} />
      <Hr />
      <ActionBlock
        phone="+7 (915) 123-45-67"
        label="Подтвердить запись и позвонить клиенту"
        accent={accent}
      />
    </EmailLayout>
  );
}
