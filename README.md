# Task-repo

Монорепозиторий веб-приложения для работы с wiki-документами (TipTap), локальным хранением страниц и интеграцией с **MWS Fusion Tables**. Состоит из HTTP-бэкенда на Go и клиента на React (Vite).

## Состав

| Компонент          | Описание                                                                    |
|--------------------|-----------------------------------------------------------------------------|
| `backend/`         | REST API: wiki-страницы (JSON), прокси к MWS Tables, healthcheck            |
| `web/`             | SPA: редактор документа, таблицы записей, комментарии (локально в браузере) |
| `api/`             | OpenAPI-спецификации (`back-front.yaml` и др.)                              |
| `backend/internal/httpapi` | Доп. HTTP-хелперы (например контракт `back-front.yaml` для записей таблицы)   |

## Требования

- **Docker** и Docker Compose — для контейнерного запуска.
- Либо **Go** (модуль `backend`) и **Node.js** — для локальной разработки без Docker для выбранного слоя.

## Конфигурация

Файл `.env` в корне репозитория подхватывается процессом бэкенда и `docker compose` (при необходимости ищется также в родительских каталогах — см. код загрузки окружения).

### ПРИМЕР .env

MWS_TABLES_BASE_URL=https://tables.mws.ru
MWS_API_KEY=ВАШ_КЛЮЧ
MWS_TABLES_REQUEST_TIMEOUT=60s
ALLOW_ORIGINS=http://localhost:3000,http://localhost:5173
TABLE_PORT=8080

PAGE_PORT=8081
MWS_GPT_API_KEY=ВАШ_КЛЮЧ
MWS_GPT_BASE_URL=https://api.gpt.mws.ru

### Фронтенд (только `npm run dev`)

Если бэкенд слушает не `127.0.0.1:8080`, задайте цель прокси в `web/.env.development.local` (см. `web/.env.example`, переменная `VITE_API_PROXY_TARGET`).

## Запуск

### Полный стек в Docker

Из корня репозитория:

```shell
docker compose up --build
```

После старта: веб-интерфейс — `http://localhost:${FRONTEND_PORT:-3000}`, API бэкенда — `http://localhost:${BACKEND_PORT:-8080}` (проверка готовности: `GET /health`).

### Только бэкенд в Docker и Vite на хосте

1. Убедитесь, что в корне есть `.env` с `MWS_TABLES_BASE_URL` и `MWS_API_KEY` (при необходимости скорректируйте `HTTP_PORT` / `BACKEND_PORT`).
2. Запустите бэкенд и дождитесь успешного healthcheck:

   ```shell
   docker compose up -d --build backend
   ```

3. Проверьте: `http://127.0.0.1:8080/health` (или ваш `BACKEND_PORT`).
4. В отдельном терминале:

   ```shell
   cd web
   npm install
   npm run dev
   ```

Запросы с фронта к `/api` проксируются на `VITE_API_PROXY_TARGET` или на `http://127.0.0.1:8080` по умолчанию.

### Локальный запуск без Docker

1. Бэкенд (рабочая директория влияет на путь по умолчанию для данных wiki):

   ```shell
   cd backend
   go run ./cmd/task
   ```

2. Фронтенд:

   ```shell
   cd web
   npm install
   npm run dev
   ```

## API

### Wiki (документ TipTap)

| Метод | Путь                           | Описание                                                                |
|-------|--------------------------------|-------------------------------------------------------------------------|
| `GET` | `/api/v1/wiki/pages/{pageKey}` | JSON корня документа `{ "type": "doc", ... }`; `404`, если страницы нет |
| `PUT` | `/api/v1/wiki/pages/{pageKey}` | Сохранение того же JSON; ответ `204` при успехе                         |

`pageKey` — только символы `a-zA-Z0-9._-` (например `wiki-doc-main`).

### Таблицы MWS

Маршруты согласованы со спецификацией `api/back-front.yaml` (например `GET` / `PATCH` / `POST` / `DELETE` для `/api/v1/tables/{dstId}/records`). При ответах Fusion без поля `total` бэкенд может догружать страницы до заполнения ожидаемого размера страницы.

### Примечание по OpenAPI и MWS

В части схем для полей записей в спецификациях допускается обобщённый тип `object`. Для фактических вызовов MWS Tables тип тел запросов (в том числе `UpdateRecordsRequest`) приведён к ожидаемому контракту API Fusion.

## Сборка фронтенда

```shell
cd web
npm run build
```

Артефакты — в `web/dist`. Образ `web` в Compose собирает production-версию и отдаёт её через nginx.

Дополнительные контракты и примеры — в каталоге `api/`.
