import { EmailLayout, Banner, Heading, DataTable, AttachmentSection, Tip, ActionBlock, Hr } from "./EmailBase";

const accent = "#0f766e";

export default function EmailOpenResume() {
  return (
    <EmailLayout accent={accent}>
      <Banner color={accent} label="Открытый отклик — кандидат в резерв" icon="📋" />
      <Heading
        title="Кандидат в кадровый резерв"
        sub="Не нашёл подходящей вакансии, но хочет работать в компании"
      />
      <DataTable rows={[
        ["Имя кандидата", "Андрей Смирнов"],
        ["Телефон",       "+7 (918) 876-54-32"],
        ["Источник",      "/vacancies — «Открытый отклик»"],
        ["Дата / время",  "08.06.2026, 14:32"],
      ]} />
      <AttachmentSection files={[
        { name: "smirnov_andrey_resume.pdf", size: "196 КБ · PDF", type: "PDF" },
        { name: "smirnov_portfolio.docx",    size: "512 КБ · Word", type: "DOC" },
      ]} />
      <Tip text="💡 Добавьте кандидата в базу для будущих открытых позиций" />
      <Hr />
      <ActionBlock
        phone="+7 (918) 876-54-32"
        label="Связаться с кандидатом"
        accent={accent}
      />
    </EmailLayout>
  );
}
