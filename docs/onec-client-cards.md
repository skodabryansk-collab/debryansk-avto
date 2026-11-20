# Выгрузка рабочих листов менеджеров в 1С

## Назначение

1С получает новые рабочие листы (РЛ), заполненные менеджерами в портале. Интеграция работает по схеме polling: 1С периодически запрашивает API, импортирует новые записи и сохраняет курсор.

Это не интеграция опроса посетителей шоурума. Каждая запись содержит персональные данные клиента — имя, телефон и сведения о его интересе к автомобилю.

## Production API

Базовый адрес:

```text
https://debryansk-auto.ru/api/integrations/1c/v1
```

Интеграция включена только в production. API в dev-preview намеренно не принимает этот токен.

Токен передаётся только в заголовке, не в URL:

```http
Authorization: Bearer <ONEC_CLIENT_CARDS_TOKEN>
Accept: application/json
```

`ONEC_CLIENT_CARDS_TOKEN` — отдельный секрет интеграции. Его значение хранится на сервере и должно быть сохранено в защищённой конфигурации 1С. Не помещайте токен в запросы, журналы, исходный код или сообщения.

## Первичная настройка курсора

При первом подключении вызовите endpoint один раз:

```http
GET /client-cards/initial-cursor
```

Полный адрес:

```text
https://debryansk-auto.ru/api/integrations/1c/v1/client-cards/initial-cursor
```

Пример ответа:

```json
{
  "ok": true,
  "data": {
    "after_id": 120,
    "as_of": "2026-11-01T09:00:00.000Z"
  }
}
```

Сохраните `after_id` как начальный курсор в 1С. Это пропустит РЛ, созданные до подключения интеграции. Endpoint не возвращает данные клиентов.

Не вызывайте его при каждом опросе: повторная инициализация может пропустить новые записи. Если требуется импортировать историю, вместо этого начните с `after_id=0`.

## Получение новых РЛ

Запрашивайте следующую страницу:

```http
GET /client-cards?after_id=<последний_успешно_импортированный_ID>&limit=100
```

Пример:

```bash
curl --get 'https://debryansk-auto.ru/api/integrations/1c/v1/client-cards' \
  --header "Authorization: Bearer $ONEC_CLIENT_CARDS_TOKEN" \
  --header 'Accept: application/json' \
  --data-urlencode 'after_id=120' \
  --data-urlencode 'limit=100'
```

- `after_id` обязателен, целое число не меньше `0`.
- `limit` необязателен: по умолчанию `100`, допустимый диапазон — от `1` до `100`.
- API возвращает записи с ID строго больше `after_id`, в порядке возрастания ID.
- Пустая страница — нормальный ответ: новых РЛ пока нет.
- Частоту опроса задаёт 1С; API не отправляет уведомления или вебхуки.

Пример ответа:

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": 121,
        "created_at": "2026-11-20T17:10:00.000Z",
        "manager_id": 7,
        "manager_name": "Имя менеджера",
        "organization_code": "<официальный код организации>",
        "organization_name": "Литейная",
        "department_code": "<официальный код подразделения>",
        "department_name": "Haval City",
        "client_name": "<ФИО клиента>",
        "client_phone": "<телефон клиента>",
        "client_gender": null,
        "desired_brand": "Haval City",
        "desired_model": "DARGO",
        "desired_vehicle_undecided": false,
        "budget_range": "от 3 до 4 млн",
        "current_car": null,
        "current_car_brand": null,
        "current_car_model": null,
        "current_car_year": null,
        "current_car_mileage": null,
        "current_car_generation": null,
        "current_car_body_type": null,
        "current_car_owners_count": null,
        "current_car_inventory_id": null,
        "trade_in_plan": null,
        "commercial_brand": "Haval City",
        "commercial_model": "DARGO",
        "commercial_car_id": null,
        "commercial_car": null,
        "payment_method": null,
        "comment": null
      }
    ],
    "next_cursor": 121,
    "has_more": false
  }
}
```

Пример условный. `created_at` — дата и время в ISO 8601 UTC. Необязательные значения в ответе передаются как `null`.

### Поля РЛ

| Поле | Тип | Значение |
|---|---|---|
| `id` | integer | ID РЛ в исходной системе; используйте как уникальный ключ импорта |
| `created_at` | datetime | Дата создания РЛ |
| `manager_id`, `manager_name` | integer, string/null | Менеджер, создавший РЛ |
| `organization_code`, `organization_name` | string | Организация и её код из локации марки |
| `department_code`, `department_name` | string | Подразделение и его код из марки |
| `client_name`, `client_phone` | string | ФИО и телефон клиента |
| `client_gender` | `male`, `female` или `null` | Пол, если указан |
| `desired_brand`, `desired_model` | string/null | Желаемые марка и модель |
| `desired_vehicle_undecided` | boolean | Клиент ещё не определился с автомобилем |
| `budget_range` | string/null | Выбранный диапазон бюджета |
| `current_car` | string/null | Текстовое описание текущего автомобиля |
| `current_car_brand`, `current_car_model` | string/null | Марка и модель текущего автомобиля |
| `current_car_year`, `current_car_mileage` | integer/null | Год выпуска и пробег |
| `current_car_generation`, `current_car_body_type` | string/null | Поколение и тип кузова |
| `current_car_owners_count` | string/null | Количество владельцев, если указано |
| `current_car_inventory_id` | integer/null | ID связанного автомобиля с пробегом в базе |
| `trade_in_plan` | string/null | Намерение клиента сдать автомобиль в трейд-ин |
| `commercial_brand`, `commercial_model` | string/null | Марка и модель предложения |
| `commercial_car_id` | integer/null | ID конкретного автомобиля из предложения |
| `commercial_car` | object/null | Снимок автомобиля: `id`, `external_id`, `brand`, `model`, `year`, `modification`, `complectation`, `color`, `price`; поля могут быть `null` |
| `payment_method` | string/null | Предпочтительный способ оплаты |
| `comment` | string/null | Комментарий менеджера |

## Алгоритм импорта и курсор

1. 1С запрашивает страницу с сохранённым `after_id`.
2. Импортируйте `items` в 1С идемпотентно, используя `id` как ключ источника.
3. Сохраните `next_cursor` только после успешного импорта всех элементов страницы.
4. Если `has_more: true`, сразу запросите следующую страницу, передав сохранённый `next_cursor` как `after_id`.
5. Если `items` пуст, `next_cursor` останется прежним; повторите запрос позже.

При сетевой ошибке или ответе `5xx` не передвигайте курсор. Этот endpoint выдаёт новые РЛ по ID; изменения уже импортированных РЛ повторно не выгружаются.

## Сопоставление организации и подразделения

- Организация — локация, к которой привязана марка в базе.
- Подразделение — марка.
- Для РЛ сначала используется марка коммерческого предложения (`commercial_brand`), если она заполнена; иначе — желаемая марка (`desired_brand`).
- Марка должна соответствовать ровно одной локации.

В production сейчас заведены **временные коды `TMP1C-*`**, не предназначенные для 1С. API блокирует страницу с РЛ, если код не подтверждён, остаётся временным или марка не сопоставлена однозначно. После получения официальных кодов их нужно внести в базу до начала обмена.

### Текущие временные коды

| Организация / локация | Временный код |
|---|---|
| Литейная | `TMP1C-ORG-0001` |
| Советская | `TMP1C-ORG-0002` |
| Супонево | `TMP1C-ORG-0003` |
| Московский | `TMP1C-ORG-0004` |

| Подразделение / марка | Временный код | Локация |
|---|---|---|
| OMODA | `TMP1C-DEPT-0001` | Супонево |
| JAECOO | `TMP1C-DEPT-0002` | Супонево |
| Haval City | `TMP1C-DEPT-0003` | Литейная |
| Haval Pro | `TMP1C-DEPT-0004` | Московский |
| Tenet | `TMP1C-DEPT-0005` | Советская |
| JETOUR | `TMP1C-DEPT-0006` | Московский |
| Volkswagen, сервис | `TMP1C-DEPT-0177` | Советская |
| SKODA, сервис | `TMP1C-DEPT-0178` | Супонево |
| Exeed, сервис | `TMP1C-DEPT-0179` | Супонево |
| Mercedes-Benz, сервис | `TMP1C-DEPT-0180` | Московский |
| SOUEAST | `TMP1C-DEPT-0217` | Московский |
| Tenet Plus | `TMP1C-DEPT-0218` | Советская |
| Jeland | `TMP1C-DEPT-0219` | Супонево |
| С пробегом | `TMP1C-DEPT-0008` | Локация не назначена |

Для марки «С пробегом» локация в базе отсутствует. Если такие РЛ потребуется отправлять, сначала назначьте ей организацию.

## Обработка ошибок

Все ошибки возвращаются JSON-ответом вида:

```json
{
  "ok": false,
  "error": "mapping_not_ready",
  "card_id": 121,
  "missing_fields": ["department_code", "organization_code"]
}
```

| HTTP | `error` | Действие 1С |
|---|---|---|
| `400` | `invalid_query` | Исправить `after_id` или `limit`; курсор не менять |
| `401` | `unauthorized` | Проверить Bearer-токен; курсор не менять |
| `409` | `mapping_not_ready` | Остановить импорт, передать `card_id` и `missing_fields` ответственному за коды; не пропускать РЛ и не менять курсор |
| `503` | `integration_not_configured` | Сообщить администратору; токен на сервере не настроен |
| `500` | `internal_error` | Повторить позже с тем же курсором |

## OpenAPI

Полный контракт также опубликован в `lib/api-spec/openapi.yaml`: операции `getOneCClientCards` и `getOneCClientCardsInitialCursor`.
