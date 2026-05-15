# O que é o Docker Compose

O Compose serve para:

* subir vários containers juntos
* conectar eles em rede
* criar volumes
* definir variáveis de ambiente
* controlar restart
* buildar imagens automaticamente

Em vez de rodar:

```bash id="u5e7ql"
docker run ...
docker run ...
docker run ...
```

você descreve tudo num:

```bash id="0htwmo"
docker-compose.yml
```

e sobe com:

```bash id="d7d94z"
docker compose up
```

---

# Estrutura básica

Exemplo:

```yaml id="97lnz6"
services:
  backend:
    build: .
    ports:
      - "3000:3000"

  postgres:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: 123456
```

---

# Comandos MAIS IMPORTANTES

# 1. Subir containers

```bash id="jlz7tw"
docker compose up
```

Isso:

* cria rede
* cria volumes
* builda imagem
* sobe containers
* mostra logs

---

# 2. Subir em background

```bash id="sq7e0y"
docker compose up -d
```

`-d` = detached mode

O terminal fica livre.

Esse é o mais usado em produção.

---

# 3. Derrubar tudo

```bash id="2fwq5h"
docker compose down
```

Para e remove:

* containers
* rede

Mas NÃO remove volumes.

---

# 4. Derrubar volumes também

```bash id="slqf6v"
docker compose down -v
```

`-v` remove volumes.

Isso APAGA dados do Postgres/MinIO/etc.

Muito cuidado.

---

# 5. Ver containers

```bash id="w0k7v9"
docker compose ps
```

Mostra:

* status
* portas
* nome

---

# 6. Ver logs

```bash id="p6g0my"
docker compose logs
```

---

# 7. Ver logs em tempo real

```bash id="wjlwmw"
docker compose logs -f
```

`-f` = follow

Igual `tail -f`.

---

# 8. Logs de um serviço específico

```bash id="7j9oyj"
docker compose logs backend
```

ou:

```bash id="rxlq4o"
docker compose logs -f postgres
```

---

# 9. Rebuildar imagens

```bash id="ix4qk7"
docker compose build
```

---

# 10. Buildar sem cache

```bash id="a8jzgi"
docker compose build --no-cache
```

Muito útil quando:

* dependências bugam
* Docker usa cache velho
* mudanças não aparecem

---

# 11. Subir rebuildando

```bash id="h9v66s"
docker compose up --build
```

ou:

```bash id="sd1m4j"
docker compose up -d --build
```

Muito comum no desenvolvimento.

---

# 12. Reiniciar containers

```bash id="pmffh2"
docker compose restart
```

Ou:

```bash id="l7q3p8"
docker compose restart backend
```

---

# 13. Parar sem remover

```bash id="c8qszn"
docker compose stop
```

Depois:

```bash id="y0g5kf"
docker compose start
```

---

# 14. Entrar dentro do container

MUITO importante.

```bash id="q0cvj4"
docker compose exec backend sh
```

ou:

```bash id="yv0f8l"
docker compose exec backend bash
```

Depende da imagem.

Exemplo:

```bash id="s6mjlwm"
docker compose exec postgres psql -U postgres
```

---

# 15. Ver imagens

```bash id="7s85ai"
docker images
```

---

# 16. Ver containers do Docker inteiro

```bash id="rzbxx1"
docker ps
```

Todos:

```bash id="6r6oy7"
docker ps -a
```

---

# 17. Remover tudo do Compose

```bash id="ubrv7g"
docker compose down --rmi all -v
```

Remove:

* containers
* imagens
* volumes

Quase um reset total.

---

# FLAGS IMPORTANTES

# `-d`

Background.

```bash id="m4z3je"
docker compose up -d
```

---

# `--build`

Força rebuild.

```bash id="j0hmv9"
docker compose up --build
```

---

# `--no-cache`

Ignora cache do Docker.

```bash id="r5b2yw"
docker compose build --no-cache
```

---

# `-f`

Escolher outro arquivo compose.

```bash id="j2llqz"
docker compose -f docker-compose.prod.yml up
```

Muito usado para:

* dev
* staging
* produção

---

# `--scale`

Escalar containers.

EXATAMENTE o que você vai usar no seu projeto.

```bash id="q3y2he"
docker compose up --scale backend=3
```

Cria:

* backend-1
* backend-2
* backend-3

Isso funciona MUITO bem com Nginx ou Traefik.

---

# `--remove-orphans`

Remove containers antigos esquecidos.

```bash id="fnd4z8"
docker compose up -d --remove-orphans
```

---

# Tutorial REALISTA

# Estrutura

```txt id="9kxf42"
projeto/
├── docker-compose.yml
├── backend/
│   └── Dockerfile
```

---

# docker-compose.yml

```yaml id="yqmrmt"
services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"

  postgres:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: 123456
```

---

# Subir

```bash id="3y4iv6"
docker compose up -d
```

---

# Ver status

```bash id="57z8x7"
docker compose ps
```

---

# Ver logs

```bash id="ms3y8k"
docker compose logs -f
```

---

# Entrar no backend

```bash id="6d2tyc"
docker compose exec backend sh
```

---

# Derrubar

```bash id="q1m1wr"
docker compose down
```

---

# Comandos que você vai usar TODO DIA

Provavelmente estes:

```bash id="rw6go8"
docker compose up -d
docker compose up -d --build
docker compose logs -f
docker compose ps
docker compose exec backend sh
docker compose restart
docker compose down
```

---

# Dica MUITO importante

Compose moderno NÃO usa mais:

```bash id="rjot1j"
version: '3'
```

Pode remover.

Hoje normalmente fica:

```yaml id="g0p8te"
services:
  ...
```

---

# Sobre nomes

Compose cria automaticamente:

* rede
* DNS interno
* hostname

Então no NestJS:

```env id="p5tp0i"
DATABASE_HOST=postgres
```

Porque o serviço se chama `postgres`.

Você NÃO usa `localhost` entre containers.

Isso é fundamental.
