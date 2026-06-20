import React from "react";
import { Helmet } from "react-helmet-async";
import Layout from "@/components/Layout";

export default function PrivacyPage() {
  return (
    <Layout>
      <Helmet>
        <title>Политика конфиденциальности | Дебрянск Авто</title>
        <meta name="description" content="Политика конфиденциальности и обработки персональных данных ООО «Дебрянск Авто» — порядок сбора, хранения и защиты данных пользователей сайта (ФЗ-152)." />
      </Helmet>

      <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-14 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">
          Политика конфиденциальности и обработки персональных данных
        </h1>
        <p className="text-sm text-slate-500 mb-8">Последнее обновление: 20 июня 2026 г.</p>

        <div className="prose prose-slate max-w-none space-y-8 text-sm sm:text-base leading-relaxed text-slate-700">

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">1. Общие положения</h2>
            <p>
              Настоящая Политика конфиденциальности и обработки персональных данных (далее — «Политика»)
              определяет порядок сбора, хранения, использования и защиты персональных данных пользователей
              сайта{" "}
              <a href="https://debryansk-auto.ru" className="text-[#0070b8] hover:underline">
                debryansk-auto.ru
              </a>{" "}
              (далее — «Сайт»).
            </p>
            <p className="mt-2">
              Оператором персональных данных является{" "}
              <strong>ООО «Дебрянск Авто»</strong>, осуществляющее обработку персональных данных
              в соответствии с требованиями Федерального закона от 27.07.2006 № 152-ФЗ
              «О персональных данных» и иными применимыми нормативными актами Российской Федерации.
            </p>
            <p className="mt-2">
              Используя Сайт и оставляя заявки, вы подтверждаете, что ознакомились с настоящей
              Политикой и даёте согласие на обработку персональных данных на изложенных условиях.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">2. Сведения об операторе</h2>
            <div className="bg-slate-50 rounded-lg p-4 space-y-1.5">
              <p><strong>Полное наименование:</strong> Общество с ограниченной ответственностью «Дебрянск Авто»</p>
              <p><strong>Сокращённое наименование:</strong> ООО «Дебрянск Авто»</p>
              <p><strong>Юридический адрес:</strong> 241050, г. Брянск, ул. Советская, д. 77</p>
              <p><strong>Фактический адрес:</strong> 241050, г. Брянск, ул. Советская, д. 77</p>
              <p>
                <strong>Телефон:</strong>{" "}
                <a href="tel:+74832777770" className="text-[#0070b8] hover:underline">
                  +7 (4832) 77-77-70
                </a>
              </p>
              <p>
                <strong>Сайт:</strong>{" "}
                <a href="https://debryansk-auto.ru" className="text-[#0070b8] hover:underline">
                  debryansk-auto.ru
                </a>
              </p>
              <p><strong>ИНН:</strong> 3250521481</p>
              <p><strong>КПП:</strong> 325701001</p>
              <p><strong>ОГРН:</strong> 1113256000615</p>
              <p><strong>Дата регистрации:</strong> 24 января 2011 г.</p>
              <p><strong>Регистрирующий орган:</strong> МРИ ФНС № 10 по Брянской области</p>
              <p><strong>Генеральный директор:</strong> Веденин Сергей Викторович</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">3. Принципы обработки персональных данных</h2>
            <p>Обработка персональных данных осуществляется на следующих принципах:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>законность и справедливая основа;</li>
              <li>обработка только в целях, заявленных при сборе данных;</li>
              <li>соответствие объёма данных заявленным целям;</li>
              <li>достоверность и актуальность данных;</li>
              <li>хранение не дольше, чем требуется для достижения цели обработки;</li>
              <li>обеспечение конфиденциальности и безопасности данных.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">4. Перечень обрабатываемых персональных данных</h2>
            <p>Оператор обрабатывает следующие категории персональных данных:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>фамилия, имя, отчество;</li>
              <li>номер мобильного или стационарного телефона;</li>
              <li>адрес электронной почты (при указании в форме);</li>
              <li>данные об автомобиле (марка, модель, год, пробег, VIN — при подаче заявки на оценку или выкуп);</li>
              <li>IP-адрес, тип и версия браузера, операционная система (технические данные, собираемые автоматически);</li>
              <li>данные файлов cookie (для целей аналитики и улучшения работы Сайта).</li>
            </ul>
            <p className="mt-2">
              Оператор не обрабатывает специальные категории персональных данных (расовое или этническое
              происхождение, политические взгляды, религиозные убеждения, состояние здоровья, биометрические данные).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">5. Цели обработки персональных данных</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-slate-200 mt-2">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Цель</th>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Категории данных</th>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Срок хранения</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-200 px-3 py-2">Обработка заявок на покупку авто, тест-драйв, кредит, лизинг</td>
                    <td className="border border-slate-200 px-3 py-2">ФИО, телефон, email</td>
                    <td className="border border-slate-200 px-3 py-2">3 года</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-200 px-3 py-2">Обратный звонок</td>
                    <td className="border border-slate-200 px-3 py-2">Имя, телефон</td>
                    <td className="border border-slate-200 px-3 py-2">1 год</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 px-3 py-2">Выкуп и оценка автомобиля</td>
                    <td className="border border-slate-200 px-3 py-2">ФИО, телефон, данные об авто</td>
                    <td className="border border-slate-200 px-3 py-2">3 года</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-200 px-3 py-2">Запись в сервисный центр</td>
                    <td className="border border-slate-200 px-3 py-2">ФИО, телефон, данные об авто</td>
                    <td className="border border-slate-200 px-3 py-2">3 года</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 px-3 py-2">Веб-аналитика (Яндекс Метрика)</td>
                    <td className="border border-slate-200 px-3 py-2">Cookie, IP, данные браузера</td>
                    <td className="border border-slate-200 px-3 py-2">13 месяцев</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-200 px-3 py-2">Информирование об акциях (при согласии)</td>
                    <td className="border border-slate-200 px-3 py-2">Имя, телефон, email</td>
                    <td className="border border-slate-200 px-3 py-2">До отзыва согласия</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">6. Основания обработки</h2>
            <p>Обработка персональных данных осуществляется на основании:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>
                <strong>Согласия субъекта</strong> — при отправке формы на Сайте (ст. 9, ч. 1 ст. 6 Закона № 152-ФЗ);
              </li>
              <li>
                <strong>Договора</strong> — в рамках исполнения договора купли-продажи, оказания услуг,
                стороной которого является субъект данных (ч. 1 ст. 6 Закона № 152-ФЗ);
              </li>
              <li>
                <strong>Законного интереса оператора</strong> — для обеспечения безопасности Сайта
                и противодействия мошенничеству.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">7. Хранение и защита данных</h2>
            <p>
              Персональные данные хранятся на защищённых серверах, расположенных на территории
              Российской Федерации, в соответствии с требованиями ст. 18.1 Закона № 152-ФЗ.
            </p>
            <p className="mt-2">Для обеспечения безопасности данных Оператор применяет:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>шифрование данных при передаче (протокол HTTPS/TLS);</li>
              <li>ограничение доступа к персональным данным только для уполномоченных сотрудников;</li>
              <li>регулярное резервное копирование базы данных;</li>
              <li>организационные меры: инструктаж сотрудников, политику паролей, контроль доступа.</li>
            </ul>
            <p className="mt-2">
              По истечении сроков хранения, указанных в разделе 5, персональные данные уничтожаются
              или обезличиваются в течение 30 дней.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">8. Передача данных третьим лицам (субпроцессоры)</h2>
            <p>
              Оператор не продаёт персональные данные третьим лицам. Передача данных возможна
              только в следующих случаях:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>с согласия субъекта персональных данных;</li>
              <li>по требованию уполномоченных государственных органов в установленных законом случаях;</li>
              <li>партнёрам для оказания запрошенных пользователем услуг (см. таблицу ниже).</li>
            </ul>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Субпроцессор</th>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Назначение</th>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Политика</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-200 px-3 py-2">Яндекс (Яндекс Метрика)</td>
                    <td className="border border-slate-200 px-3 py-2">Веб-аналитика, статистика посещаемости</td>
                    <td className="border border-slate-200 px-3 py-2">
                      <a href="https://yandex.ru/legal/confidential" target="_blank" rel="noopener noreferrer" className="text-[#0070b8] hover:underline">yandex.ru/legal/confidential</a>
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-200 px-3 py-2">Банки-партнёры (по запросу)</td>
                    <td className="border border-slate-200 px-3 py-2">Оформление автокредита, лизинга</td>
                    <td className="border border-slate-200 px-3 py-2">Только с согласия клиента</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 px-3 py-2">Страховые компании (по запросу)</td>
                    <td className="border border-slate-200 px-3 py-2">Оформление КАСКО, ОСАГО</td>
                    <td className="border border-slate-200 px-3 py-2">Только с согласия клиента</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-200 px-3 py-2">Replit Inc. (хостинг)</td>
                    <td className="border border-slate-200 px-3 py-2">Хостинг и инфраструктура Сайта</td>
                    <td className="border border-slate-200 px-3 py-2">
                      <a href="https://replit.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0070b8] hover:underline">replit.com/privacy</a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">9. Права субъекта персональных данных</h2>
            <p>
              В соответствии с Федеральным законом № 152-ФЗ вы имеете право:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>получить подтверждение факта обработки и сведения об обрабатываемых данных;</li>
              <li>требовать уточнения, блокирования или уничтожения данных, если они неполны, устарели или неправомерно обрабатываются;</li>
              <li>отозвать согласие на обработку персональных данных в любой момент;</li>
              <li>требовать прекращения обработки для целей прямого маркетинга;</li>
              <li>обжаловать действия оператора в Роскомнадзор (rkn.gov.ru) или в судебном порядке.</li>
            </ul>
            <p className="mt-2">
              Для реализации своих прав направьте письменное обращение по почтовому адресу Оператора
              или на электронную почту{" "}
              <a href="mailto:info@debryansk-auto.ru" className="text-[#0070b8] hover:underline">
                info@debryansk-auto.ru
              </a>.
              Срок рассмотрения обращения — не более 30 дней.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">10. Порядок отзыва согласия</h2>
            <p>
              Вы вправе отозвать согласие на обработку персональных данных в любое время, направив
              письменное заявление в адрес Оператора. После получения заявления Оператор прекращает
              обработку данных в течение 30 дней, за исключением случаев, когда обработка необходима
              для исполнения договора или выполнения требований законодательства.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">11. Использование файлов cookie</h2>
            <p>
              Сайт использует файлы cookie для обеспечения корректной работы, сохранения
              пользовательских предпочтений и сбора аналитических данных через сервис Яндекс Метрика.
            </p>
            <p className="mt-2">
              Вы можете отключить cookie в настройках браузера, однако это может повлиять на
              работоспособность отдельных функций Сайта. Срок хранения аналитических cookie — 13 месяцев.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">12. Трансграничная передача данных</h2>
            <p>
              Оператор не осуществляет трансграничную передачу персональных данных на территории
              иностранных государств, за исключением передачи обезличенных аналитических данных
              сервисам, обеспечивающим работу Сайта, в объёме, минимально необходимом для
              функционирования инфраструктуры.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">13. Изменение Политики</h2>
            <p>
              Оператор вправе вносить изменения в настоящую Политику без предварительного
              уведомления пользователей. Актуальная версия всегда доступна на данной странице.
              Дата последнего обновления указана в начале документа. Продолжение использования
              Сайта после публикации изменений означает согласие с новой редакцией.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">14. Контактные данные оператора</h2>
            <p>По всем вопросам, связанным с обработкой персональных данных, обращайтесь:</p>
            <div className="bg-slate-50 rounded-lg p-4 mt-3 space-y-1.5">
              <p><strong>ООО «Дебрянск Авто»</strong></p>
              <p><strong>Адрес:</strong> 241050, г. Брянск, ул. Советская, д. 77</p>
              <p>
                <strong>Телефон:</strong>{" "}
                <a href="tel:+74832777770" className="text-[#0070b8] hover:underline">
                  +7 (4832) 77-77-70
                </a>
              </p>
              <p>
                <strong>Email:</strong>{" "}
                <a href="mailto:info@debryansk-auto.ru" className="text-[#0070b8] hover:underline">
                  info@debryansk-auto.ru
                </a>
              </p>
              <p>
                <strong>Сайт:</strong>{" "}
                <a href="https://debryansk-auto.ru/contacts" className="text-[#0070b8] hover:underline">
                  debryansk-auto.ru/contacts
                </a>
              </p>
            </div>
          </section>

        </div>
      </div>
    </Layout>
  );
}
