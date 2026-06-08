import { EmailLayout, Banner, Heading, DataTable, VacancyCard, AttachmentSection, ActionBlock, Hr } from "./EmailBase";

const accent = "#7c3aed";

export default function EmailVacancy() {
  return (
    <EmailLayout accent={accent}>
      <Banner color={accent} label="Отклик на вакансию" icon="💼" />
      <Heading
        title="Новый кандидат"
        sub="Кандидат откликнулся через страницу Вакансии"
      />
      <VacancyCard
        title="Менеджер по продажам новых автомобилей"
        dept="Продажи"
        dealer="OMODA · JAECOO, с. Супонево"
        salary="от 80 000 ₽"
      />
      <DataTable rows={[
        ["Имя кандидата",      "Екатерина Иванова"],
        ["Телефон",            "+7 (906) 543-21-09"],
        ["Отдел",              "Продажи"],
        ["Дилерский центр",    "OMODA · JAECOO, с. Супонево"],
        ["Ожидаемая зарплата", "от 80 000 ₽"],
        ["Источник",           "/vacancies — кнопка «Откликнуться»"],
        ["Дата / время",       "08.06.2026, 14:32"],
      ]} />
      <AttachmentSection files={[
        { name: "ivanova_ekaterina_resume.pdf", size: "284 КБ · PDF", type: "PDF" },
      ]} />
      <Hr />
      <ActionBlock
        phone="+7 (906) 543-21-09"
        label="Связаться с кандидатом"
        accent={accent}
      />
    </EmailLayout>
  );
}
