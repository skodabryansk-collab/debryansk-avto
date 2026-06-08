import { EmailLayout, Banner, Heading, DataTable, ActionBlock, Hr, BLUE } from "./EmailBase";

export default function EmailCallback() {
  return (
    <EmailLayout accent={BLUE}>
      <Banner color={BLUE} label="Заказать звонок — сайт Дебрянск Авто" icon="📞" />
      <Heading
        title="Клиент ждёт звонка"
        sub="Заявка оставлена через кнопку «Заказать звонок» в шапке сайта"
      />
      <DataTable rows={[
        ["Имя клиента",     "Александр Петров"],
        ["Телефон",         "+7 (920) 456-78-90"],
        ["Источник",        "Кнопка «Заказать звонок» — шапка сайта"],
        ["Дилерский центр", "Не указан (общий запрос)"],
        ["Дата / время",    "08.06.2026, 14:32"],
      ]} />
      <Hr />
      <ActionBlock
        phone="+7 (920) 456-78-90"
        label="Перезвонить клиенту"
        accent={BLUE}
      />
    </EmailLayout>
  );
}
