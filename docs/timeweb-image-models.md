# Модели изображений в ИИ-центре

Каталог сверён с Timeweb Cloud API и проверен реальными генерациями в октябре 2026 года. `/v1/models` шлюза не содержит всех работающих моделей: FLUX и Runway доступны по идентификатору, хотя отсутствуют в этом ответе.

| Модель | С нуля | С исходным фото | Способ передачи фото |
|---|---|---|---|
| Gemini 3.1 Flash Image Preview | Да | Да | `/chat/completions`, `image_url` |
| Gemini 3 Pro Image Preview | Да | Да | `/chat/completions`, `image_url` |
| GPT Image 2 | Да | Да | `/images/edits`, multipart |
| GPT Image 2.5 Flare | Да | Да | `/images/edits`, multipart |
| GPT Image 2.5 Sunburst | Да | Да | `/images/edits`, multipart |
| FLUX.2 Max | Да | Да | `/images/edits`, `image`, `image_2`, … |
| FLUX.2 Pro | Да | Да | `/images/edits`, `image`, `image_2`, … |
| FLUX.2 Klein 9B | Да | Да | `/images/edits`, `image`, `image_2`, … |
| Runway Gen-4 Image | Да | Да | `/images/generations`, `referenceImages` |
| Runway Gen-4 Image Turbo | Нет | Да | `/images/generations`, `referenceImages` |
| Seedream 5 Pro | Да | Да | `/images/generations`, `referenceImages` без `tag` |
| Seedream 5 Lite | Да | Да | `/images/generations`, `referenceImages` без `tag` |

## Особенности

- Runway/Seedream отмечены Timeweb как deprecated, но фактически отвечают и возвращают изображения. В интерфейсе это показано предупреждением, а не скрытым запретом.
- Gen-4 Turbo требует исходное фото. Gen-4 принимает максимум 3 фото; для остальных моделей ИИ-центр ограничивает количество вложений пятью.
- Seedream Lite требует минимум 3 686 400 пикселей: квадратный формат преобразуется в 2048×2048, вертикальный — 1440×2560, горизонтальный — 2560×1440.
- Для остальных Runway-моделей вертикальный/горизонтальный формат преобразуется в 1080×1920/1920×1080.
- GPT принимает качество в обоих режимах. Несколько изображений передаются повторяющимся multipart-полем `image`; шлюз принимает такой запрос.
- Ошибка image-to-image не заменяется генерацией без фото. Невозможность скачать предыдущее изображение тоже показывается как ошибка.
- «С нуля» (`skip_auto_ref`) действительно отключает использование предыдущего результата сессии.
- Backend является единственным источником списка моделей и их возможностей. Админка получает каталог через защищённый `GET /api/admin/ai-images/models`.

## Проверки

Без расхода API-кредитов:

```bash
pnpm --dir scripts exec tsx --test ../artifacts/api-server/src/lib/timeweb-images.test.ts
```

Платная проверка выбранных моделей через реальные адаптеры ИИ-центра:

```bash
pnpm --dir scripts exec tsx ../scripts/timeweb-image-probe.mjs \
  openai/gpt-image-2.5-flare runway/seedream5_lite
```

Скрипт сохраняет исходную картинку, полученные изображения и отчёт в отдельную папку `/tmp/timeweb-image-probes/`. Каждый выбранный режим делает один платный запрос. Проверять нужно не только статус API, но и сохранение исходных элементов в полученной картинке.
