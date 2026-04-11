# Что должно быть в переменных окружения

- MWS_TABLES_BASE_URL - базовая ссылка на MWS tables (https://tables.mws.ru/fusion/v1)
- MWS_API_KEY - ключ MWS tables для доступа к API
- FRONTEND_BASE_URL - ссылка, по которой можно обратиться к фронтенду
- BACKEND_BASE_URL - ссылка, по которой можно обратиться к бекенду
- HTTP_PORT - порт, на котором открывается backend server

# Запуск

## Docker

Из корня проекта воспользуйтесь командой

``` shell
docker-compose up --build
```

## Обычный запуск

Для обычного запуска положите `.env` файл в корень папки backend

Для запуска, находясь в корне проекта, воспользуйтесь командой

``` shell
go run backend/cmd/task/main.go
```