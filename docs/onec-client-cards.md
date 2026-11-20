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

## Поля автомобиля и планируемой покупки

Актуальный контракт передаёт:

- `needs[].planned_purchase_date` — необязательная дата планируемой покупки (`YYYY-MM-DD`) для каждой потребности. Если менеджер дату не указал, передаётся `null`.
- `current_cars[]` — массив автомобилей клиента без внутреннего идентификатора строки каталога.
- `commercial_car_vin` — VIN выбранного автомобиля из предложения; `null`, если автомобиль не выбран или VIN отсутствует.
- `commercial_offer.car_vin` — тот же VIN внутри блока предложения. Вложенный `commercial_offer.car` содержит снимок характеристик автомобиля и его `vin`.

Внешний контракт не содержит `current_car_inventory_id`, `current_cars[].inventory_id` или числовой `commercial_car_id`. Внутренний ID записи каталога используется только порталом для связи с выбранным автомобилем; в 1С передаётся VIN.

Пример, когда менеджер выбрал автомобиль из предложения:

```json
{
  "commercial_car_vin": "XW8ZZZ61ZHG000456",
  "commercial_car": {
    "vin": "XW8ZZZ61ZHG000456",
    "brand": "Haval City",
    "model": "DARGO",
    "year": 2026,
    "modification": "2.0 бензин, 7DCT, 4WD",
    "complectation": "Техно+",
    "color": "Серый",
    "price": 3899000
  },
  "commercial_offer": {
    "brand_id": 9,
    "brand": "Haval City",
    "model": "DARGO",
    "car_vin": "XW8ZZZ61ZHG000456",
    "car": {
      "vin": "XW8ZZZ61ZHG000456",
      "brand": "Haval City",
      "model": "DARGO",
      "year": 2026,
      "modification": "2.0 бензин, 7DCT, 4WD",
      "complectation": "Техно+",
      "color": "Серый",
      "price": 3899000
    },
    "organization_code": "<код организации>",
    "organization_name": "Литейная",
    "department_code": "<код подразделения>",
    "department_name": "Haval City"
  }
}
```

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
        "needs": [
          {
            "brand_id": 9,
            "brand": "Haval City",
            "model": "DARGO",
            "undecided": false,
            "budget_range": "3–5 млн",
            "planned_purchase_date": "2027-05-21",
            "organization_code": "<код организации>",
            "organization_name": "Литейная",
            "department_code": "<код подразделения>",
            "department_name": "Haval City"
          },
          {
            "brand_id": 14,
            "brand": "JETOUR",
            "model": "DASHING",
            "undecided": false,
            "budget_range": "3–5 млн",
            "planned_purchase_date": null,
            "organization_code": "<код организации>",
            "organization_name": "Московский",
            "department_code": "<код подразделения>",
            "department_name": "JETOUR"
          }
        ],
        "current_cars": [
          {
            "brand": "Toyota",
            "model": "Camry",
            "year": 2019,
            "mileage": 75000,
            "generation": null,
            "body_type": "Седан",
            "owners_count": "2",
            "trade_in_plan": "Да"
          }
        ],
        "commercial_brand": null,
        "commercial_model": null,
        "commercial_car_vin": null,
        "commercial_car": null,
        "commercial_offer": null,
        "brand_records": [
          {
            "source_key": "121:9",
            "brand_id": 9,
            "brand_name": "Haval City",
            "organization_code": "<код организации>",
            "organization_name": "Литейная",
            "department_code": "<код подразделения>",
            "department_name": "Haval City",
            "needs": [
              {
                "brand_id": 9,
                "brand": "Haval City",
                "model": "DARGO",
                "undecided": false,
                "budget_range": "3–5 млн",
                "planned_purchase_date": "2027-05-21",
                "organization_code": "<код организации>",
                "organization_name": "Литейная",
                "department_code": "<код подразделения>",
                "department_name": "Haval City"
              }
            ],
            "commercial_offer": null
          },
          {
            "source_key": "121:14",
            "brand_id": 14,
            "brand_name": "JETOUR",
            "organization_code": "<код организации>",
            "organization_name": "Московский",
            "department_code": "<код подразделения>",
            "department_name": "JETOUR",
            "needs": [
              {
                "brand_id": 14,
                "brand": "JETOUR",
                "model": "DASHING",
                "undecided": false,
                "budget_range": "3–5 млн",
                "planned_purchase_date": null,
                "organization_code": "<код организации>",
                "organization_name": "Московский",
                "department_code": "<код подразделения>",
                "department_name": "JETOUR"
              }
            ],
            "commercial_offer": null
          }
        ],
        "payment_method": "Кредит",
        "comment": "<комментарий менеджера>"
      }
    ],
    "next_cursor": 121,
    "has_more": false
  }
}
```

Пример условный. `created_at` — дата и время в ISO 8601 UTC. Необязательные значения в ответе передаются как `null`.

`payment_method` содержит ровно одно из значений `Кредит`, `Лизинг`, `Наличные / Безнал` либо `null`, если способ оплаты не выбран. В API передаётся точная подпись из формы.

### Поля РЛ

| Поле | Тип | Значение |
|---|---|---|
| `id` | integer | ID РЛ в исходной системе; используйте как уникальный ключ импорта |
| `created_at` | datetime | Дата создания РЛ |
| `manager_id`, `manager_name` | integer, string/null | Менеджер, создавший РЛ |
| `client_name`, `client_phone` | string | ФИО и телефон клиента |
| `client_gender` | `male`, `female` или `null` | Пол, если указан |
| `needs[]` | array | Потребности: марка, модель, признак неопределённости, бюджет, планируемая дата покупки и коды организации/подразделения для конкретной марки |
| `current_cars[]` | array | Все автомобили клиента: марка, модель, год, пробег, поколение, кузов, владельцы и трейд-ин |
| `commercial_brand`, `commercial_model` | string/null | Марка и модель предложения |
| `commercial_car_vin` | string/null | VIN выбранного автомобиля из предложения; `null`, если VIN отсутствует или автомобиль не выбран |
| `commercial_car` | object/null | Данные выбранного автомобиля: `vin`, `brand`, `model`, `year`, `modification`, `complectation`, `color`, `price`; поля могут быть `null` |
| `commercial_offer` | object/null | Данные предложения вместе с кодами его марки и локации |
| `brand_records[]` | array | Подготовленные записи для 1С — по одной на каждую уникальную марку интереса или предложения |
| `payment_method` | enum/null | Только `Кредит`, `Лизинг`, `Наличные / Безнал` или `null` |
| `comment` | string/null | Комментарий менеджера |

В `brand_records[]` каждую запись импортируйте в 1С отдельно. `source_key` — стабильный внешний ключ вида `<id РЛ>:<id марки>`; используйте его для идемпотентного создания/обновления и безопасного повтора после ошибки. Внутри записи `needs[]` уже отфильтрован по этой марке. Список `current_cars[]`, данные клиента, менеджера, оплата и комментарий относятся к карточке целиком и могут копироваться в каждую запись 1С.

Поля `organization_*` и `department_*` верхнего уровня содержат коды первой записи `brand_records[]`; старые одиночные `desired_*` и `current_car_*` отражают первый элемент соответствующего массива. Они оставлены только для совместимости. Для новых интеграций используйте `needs[]`, `current_cars[]` и `brand_records[]`.

Потребность с `brand_id: null` означает, что клиент ещё не выбрал марку. Она остаётся в общем `needs[]`, но не образует отдельную запись 1С без кода подразделения. Если в РЛ нет ни одной марки потребности и нет марки предложения, API возвращает `409 mapping_not_ready`.

## Алгоритм импорта и курсор

1. 1С запрашивает страницу с сохранённым `after_id`.
2. Для каждого элемента `items` импортируйте все `brand_records[]` идемпотентно по `source_key`. Не считайте карточку обработанной, пока не сохранены все её записи по маркам.
3. Сохраните `next_cursor` только после успешного импорта всех элементов страницы.
4. Если `has_more: true`, сразу запросите следующую страницу, передав сохранённый `next_cursor` как `after_id`.
5. Если `items` пуст, `next_cursor` останется прежним; повторите запрос позже.

При сетевой ошибке или ответе `5xx` не передвигайте курсор. Этот endpoint выдаёт новые РЛ по ID; изменения уже импортированных РЛ повторно не выгружаются.

## Сопоставление организации и подразделения

- Организация — локация, к которой привязана марка в базе.
- Подразделение — марка.
- Каждая марка из `needs[]` и марка предложения формируют отдельную запись в `brand_records[]`; совпадающие марки объединяются в одну запись.
- Для каждой записи организация — локация марки в базе, подразделение — сама марка.
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
