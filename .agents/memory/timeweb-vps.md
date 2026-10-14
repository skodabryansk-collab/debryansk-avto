---
name: Timeweb VPS — reverse proxy + правила работы
description: Полный конфиг VPS, Nginx, SSL, DNS и правила работы с сервером.
---

# Timeweb VPS — reverse proxy для debryansk-auto.ru

## Параметры сервера
- **Провайдер**: Timeweb, Москва (российский контур — не блокируется)
- **IP**: 5.42.110.134
- **IPv6**: 2a03:6f00:a::2:a780
- **ОС**: Ubuntu 24.04.4 LTS
- **SSH**: `ssh root@5.42.110.134`
- **Хостнейм**: 8612907-xh819249.twc1.net
- **Диск**: 13.49 GB, загрузка ~27%
- **RAM**: ~47% из доступных

## Что установлено
- Nginx 1.24.0
- Certbot + python3-certbot-nginx
- SSL-сертификат Let's Encrypt для debryansk-auto.ru и www.debryansk-auto.ru
  - Путь: `/etc/letsencrypt/live/debryansk-auto.ru/`
  - Файлы: `fullchain.pem`, `privkey.pem`
  - Истекает: 2026-10-14 (авторенью через certbot настроен)

## Nginx конфиг (актуальный)
Файл: `/etc/nginx/sites-available/debryansk`
Активная копия: `/etc/nginx/sites-enabled/debryansk`

```nginx
server {
    listen 80;
    server_name debryansk-auto.ru www.debryansk-auto.ru;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name debryansk-auto.ru www.debryansk-auto.ru;
    ssl_certificate /etc/letsencrypt/live/debryansk-auto.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/debryansk-auto.ru/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_buffer_size 4k;
    location / {
        proxy_pass https://34.111.179.208;
        proxy_ssl_server_name on;
        proxy_ssl_name debryansk-auto.ru;
        proxy_set_header Host debryansk-auto.ru;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }
}
```

`server_tokens off;` включён в `/etc/nginx/nginx.conf`. Публичный `/api/send-email` ограничен отдельной зоной `limit_req` (10 запросов в минуту, burst 5, статус 429) в дополнение к общей защите VPS.

**Важно:** `sites-enabled/debryansk` — отдельный файл, не симлинк на `sites-available/debryansk`; при изменениях сверять и обновлять оба. В `sites-enabled/` нельзя оставлять резервные копии: Nginx включает все файлы по glob, а дубликат `limit_req_zone` ломает `nginx -t`.

**Why:** Активная конфигурация разошлась с `sites-available`; резервная копия в `sites-enabled` уже приводила к отказу проверки из-за повторного объявления зоны.

**How to apply:** Перед правкой сравнить оба файла, хранить резервные копии вне `sites-enabled`, затем проверять `nginx -t` и выполнять `systemctl reload nginx`.

**Почему ssl_buffer_size 4k:** без этого TLS-рукопожатие зависало у части клиентов (TCP соединялся, но ServerHello терялся из-за MTU). 4k уменьшает TLS-записи → пакеты проходят без фрагментации.

## DNS (reg.ru)
- `debryansk-auto.ru` → A → `5.42.110.134`
- `www.debryansk-auto.ru` → A → `5.42.110.134`

## Архитектура
```
Пользователь → 5.42.110.134:443 (Timeweb VPS, Nginx)
             → proxy_pass https://34.111.179.208 (Replit deployment IP)
             → debryansk-auto.ru (Replit обрабатывает запрос)
```
Replit IP скрыт. Пользователи в РФ видят только Timeweb IP.

---

# Правила работы с VPS

## Подключение
Секрет `VPS_SSH_PASSWORD` сохранён в Replit Secrets — я могу подключаться напрямую из bash без участия пользователя:

```bash
sshpass -p "$VPS_SSH_PASSWORD" ssh -o StrictHostKeyChecking=no root@5.42.110.134 "команда"
```

Для интерактивной сессии пользователь вводит: `ssh root@5.42.110.134`

## После изменения Nginx конфига — обязательно
```bash
nginx -t                    # проверить синтаксис
systemctl reload nginx      # применить без даунтайма
```
**Никогда не делать `systemctl restart nginx` без причины** — reload достаточен и не прерывает текущие соединения.

## Проверка работоспособности
```bash
# С VPS:
curl -I https://debryansk-auto.ru

# С Mac (должно возвращать HTTP 200):
curl -I https://debryansk-auto.ru

# Порты:
nc -zv 5.42.110.134 443
nc -zv 5.42.110.134 80
```

## Диагностика проблем HTTPS
1. `nc -zv 5.42.110.134 443` — если fail → порт заблокирован на уровне сети
2. `nc` OK + curl timeout → MTU/TLS проблема → проверить `ssl_buffer_size 4k` в конфиге
3. `curl -I http://debryansk-auto.ru` — если HTTP работает, а HTTPS нет → TLS конфиг Nginx
4. `systemctl status nginx` — статус сервиса
5. `tail -f /var/log/nginx/error.log` — ошибки Nginx в реальном времени

## SSL-сертификат: обновление
Certbot обновляет автоматически (cron/systemd timer). Для ручного обновления:
```bash
certbot renew --nginx
```

## ufw
**ufw выключен** (`ufw status` → Status: inactive). Nginx открыт напрямую через iptables/nftables. Не включать ufw без добавления правил для 22/80/443 — заблокируешь себя.

## Если Replit сменит deployment IP (34.111.179.208)
Нужно обновить `proxy_pass` в `/etc/nginx/sites-available/debryansk` и сделать `nginx -t && systemctl reload nginx`.
Текущий Replit IP: **34.111.179.208**

## Логи
- Nginx access: `/var/log/nginx/access.log`
- Nginx error: `/var/log/nginx/error.log`
