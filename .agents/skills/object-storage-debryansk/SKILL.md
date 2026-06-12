---
name: object-storage-debryansk
description: Работа с Replit Object Storage (GCS) для проекта Дебрянск Авто. Использовать при загрузке файлов из админки, обновлении логотипов брендов, или при любой работе с облачным хранилищем файлов.
---

# Object Storage для Дебрянск Авто

## Архитектура

```
Админ-панель (React)
  |
  | 1. POST /api/storage/uploads/request-url  → получить presigned URL
  | 2. PUT <GCS-presigned-URL>              → загрузить файл напрямую в GCS
  | 3. GET /api/storage/objects/<path>     → скачать файл
  |
  v
API Server (Express)
  |
  | ← Replit sidecar авторизация
  v
Google Cloud Storage
```

## Роуты

- `POST /api/storage/uploads/request-url` — запрос presigned URL для загрузки
- `GET /api/storage/objects/*` — скачивание загруженных файлов
- `GET /api/storage/public-objects/*` — публичные ассеты

## Клиентская загрузка (админка)

Функция `uploadFile` в `artifacts/admin-panel/src/lib/api.ts`:

```typescript
export async function uploadFile(file: File): Promise<string> {
  const token = getToken();
  // 1. Запрос presigned URL
  const metaRes = await fetch(`${API_BASE}/storage/uploads/request-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });
  const { uploadURL, objectPath } = await metaRes.json();

  // 2. Загрузка напрямую в GCS
  await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

  // 3. Вернуть URL для сохранения в БД
  return `${API_BASE}/storage${objectPath}`;
}
```

## Загрузка логотипа в бренд

Пример загрузки логотипа HAVAL и обновления бренда Haval City:

```bash
# 1. Получить токен администратора
TOKEN=$(curl -s -X POST http://localhost:8080/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"admin321"}' | python3 -c "
    import sys,json; d=json.load(sys.stdin); print(d.get('token',''))
")

# 2. Запросить presigned URL
FILE_SIZE=$(wc -c < /path/to/logo-haval.svg)
META=$(curl -s -X POST http://localhost:8080/api/storage/uploads/request-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"logo-haval.svg\",\"size\":$FILE_SIZE,\"contentType\":\"image/svg+xml\"}")
UPLOAD_URL=$(echo "$META" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('uploadURL',''))")
OBJECT_PATH=$(echo "$META" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('objectPath',''))")

# 3. Загрузить файл в GCS
curl -s -X PUT "$UPLOAD_URL" -H "Content-Type: image/svg+xml" --data-binary @/path/to/logo-haval.svg

# 4. Обновить бренд в БД
NEW_URL="/api/storage${OBJECT_PATH}"
curl -s -X PUT http://localhost:8080/api/admin/brands/3 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"logoUrl\":\"$NEW_URL\"}"
```

## Проверка файлов в хранилище

```bash
# Проверить конкретный файл
curl -s -I http://localhost:8080/api/storage/objects/uploads/<uuid>

# Должно вернуть HTTP 200 с Content-Type и Content-Length
```

## Важные пути

- `artifacts/api-server/src/routes/storage.ts` — роуты Object Storage
- `artifacts/api-server/src/lib/objectStorage.ts` — GCS клиент
- `artifacts/api-server/src/lib/objectAcl.ts` — ACL политики
- `artifacts/admin-panel/src/lib/api.ts` — клиентская загрузка

## Обработка ошибок

- `401 Unauthorized` — проверить токен администратора
- `404 Not Found` — файл не загружен или недоступен
- `500` — проверить настройку переменных окружения `PRIVATE_OBJECT_DIR`
