import { EmailLayout, Banner, Heading, DataTable, MsgBox, ActionBlock, Hr, BLUE } from "./EmailBase";

export default function EmailFeedback() {
  return (
    <EmailLayout accent={BLUE}>
      <Banner color={BLUE} label="Обращение через форму контактов" icon="✉️" />
      <Heading
        title="Новое сообщение от клиента"
        sub="Сообщение получено через форму на странице /contacts"
      />
      <DataTable rows={[
        ["Имя клиента",  "Наталья Фёдорова"],
        ["Телефон",      "+7 (920) 111-22-33"],
        ["Email",        "n.fedorova@mail.ru"],
        ["Источник",     "/contacts — форма обратной связи"],
        ["Дата / время", "08.06.2026, 14:32"],
      ]} />
      <MsgBox text="Здравствуйте! Меня интересует Haval Jolion в комплектации Premium. Хотела бы узнать, есть ли в наличии синий цвет, и возможно ли оформление в кредит без первого взноса. Заранее спасибо." />
      <Hr />
      <ActionBlock
        phone="+7 (920) 111-22-33"
        email="n.fedorova@mail.ru"
        label="Ответить клиенту"
        accent={BLUE}
      />
    </EmailLayout>
  );
}
