## Flags gerais

### `-d` — detached
Roda o container em background. Sem ele, o processo trava o terminal.
```bash
docker run -d nginx        # roda em background
docker run nginx           # trava o terminal, Ctrl+C mata o container
```

### `-t` — tag (no build)
Define o nome e versão da imagem:
```bash
docker build -t minha-api:1.0 .
#                         ^^^^ tag/versão — se omitir, vira :latest
#             ^^^^^^^^^ nome da imagem
```

### `-a` — all
Em vários comandos, mostra tudo incluindo o que está parado:
```bash
docker ps        # só containers rodando
docker ps -a     # todos, incluindo stopped/exited

docker images    # imagens ativas
docker images -a # inclui imagens intermediárias (layers órfãos)
```

---

## Portas — `-p`

```bash
docker run -p 3000:3000 minha-api
#              ^^^^  ^^^^
#              host  container
```

O container tem sua própria rede isolada. Sem `-p`, ninguém de fora acessa. A flag mapeia `porta-do-host:porta-do-container`.

```bash
docker run -p 8080:3000 minha-api
# sua máquina:8080 → container:3000
# acessa no browser: localhost:8080
```

Pode mapear múltiplas portas:
```bash
docker run -p 3000:3000 -p 9229:9229 minha-api
#                            ^^^^ porta de debug do Node
```

Ou expor em todas as interfaces de rede:
```bash
docker run -p 0.0.0.0:3000:3000 minha-api   # padrão implícito
docker run -p 127.0.0.1:3000:3000 minha-api # só localhost, não expõe na rede local
```

---

## Volumes — `-v`

Por padrão, tudo dentro do container é **efêmero** — morreu o container, sumiu o dado. Volume resolve isso.

### Bind mount — mapeia pasta do host
```bash
docker run -v /caminho/host:/caminho/container minha-api

# Exemplos práticos:
docker run -v $(pwd):/app minha-api          # código local dentro do container (hot reload)
docker run -v C:\minio\data:/data minio      # dados do MinIO persistindo no Windows
```

### Named volume — gerenciado pelo Docker
```bash
docker volume create meus-dados

docker run -v meus-dados:/app/data minha-api
# Docker controla onde fica no host — você não precisa saber o caminho
```

```bash
docker volume ls          # lista volumes
docker volume inspect meus-dados
docker volume rm meus-dados
```

### Read-only
```bash
docker run -v $(pwd)/config:/app/config:ro minha-api
#                                         ^^ container não pode escrever
```

---

## `-it` e `-ti`

São duas flags separadas que quase sempre andam juntas:

- `-i` → **interactive** — mantém o STDIN aberto (você pode digitar)
- `-t` → **tty** — aloca um pseudo-terminal (formata a saída, mostra prompt)

```bash
docker run -it node:20-alpine sh
#  sem -t: funciona mas sem prompt, output feio
#  sem -i: abre mas não aceita input, fecha imediatamente
#  -it ou -ti: mesma coisa, ordem não importa
```

Uso típico: entrar num container pra debugar ou testar algo.

```bash
docker run -it --rm node:20-alpine sh
# --rm remove o container quando você sair (ótimo pra testes rápidos)
```

---

## `exec` vs `attach`

São bem diferentes:

### `exec` — executa um novo processo dentro do container
```bash
docker exec -it minha-api sh
# abre um shell independente, container continua rodando normalmente
# sair do shell (exit) NÃO mata o container
```

```bash
# Outros usos úteis do exec:
docker exec minha-api env                        # ver variáveis de ambiente
docker exec minha-api cat /app/config.json       # ler arquivo
docker exec -it minha-api node --inspect src/    # rodar outro processo
```

### `attach` — conecta ao processo principal do container
```bash
docker attach minha-api
# você entra no stdout/stdin do PID 1 (o CMD do Dockerfile)
# Ctrl+C ou exit MATA o container
# Ctrl+P Ctrl+Q — sai sem matar (detach)
```

**Regra prática:** quase sempre use `exec`. O `attach` é útil só quando você quer ver o output do processo principal em tempo real e sabe o que está fazendo.

---

## Stop, kill, rm, pause

```bash
# Para o container graciosamente (envia SIGTERM, espera 10s, depois SIGKILL)
docker stop minha-api

# Mata na força (SIGKILL imediato)
docker kill minha-api

# Remove o container (precisa estar parado)
docker rm minha-api

# Para e remove de uma vez
docker rm -f minha-api

# Remove automaticamente ao parar (ótimo pra dev/teste)
docker run --rm minha-api

# Pausa/resume (congela os processos, mantém estado em memória)
docker pause minha-api
docker unpause minha-api
```

```bash
# Remover todos os containers parados de uma vez
docker container prune

# Remover imagens sem tag (dangling)
docker image prune

# Limpar tudo: containers parados, imagens não usadas, volumes, networks
docker system prune -a
#                   ^^ sem isso só remove dangling images
```

---

## Variáveis de ambiente — `-e`

```bash
docker run -e NODE_ENV=production -e PORT=3000 minha-api

# Ou via arquivo .env
docker run --env-file .env minha-api
```

---

## Naming e restart policy

```bash
# Nomear o container (sem isso Docker gera nome aleatório tipo "happy_hopper")
docker run --name minha-api minha-api:1.0

# Reiniciar automaticamente
docker run --restart always minha-api       # sempre reinicia
docker run --restart unless-stopped minha-api  # reinicia exceto se você parou manualmente
docker run --restart on-failure minha-api   # só se crashar
```

---

## Resumão visual

``` bash
docker run
  -d                    → background
  -p 8080:3000          → porta host:container
  -v $(pwd):/app        → volume bind mount
  -e NODE_ENV=prod      → variável de ambiente
  --name minha-api      → nome do container
  --rm                  → remove ao parar
  --restart always      → reinicia se cair
  -it                   → terminal interativo
  minha-api:1.0         → imagem:tag
```

``` bash
docker build  
  -t stackmesh-server-test → nome da imagem no formato(nome:tag)
  -f Dockerfile .          → qual arquivo dockerfile vai ser utilizado e o contexto do build "."



docker run
  --rm                  → remove ao parar
  -it                   → terminal interativo
  --name minha-api      → nome do container
  -p 8080:3000          → porta(publish) host:container 
  --env-file .env       → passar .env 
  stackmesh-server:test → nome da imagem:tag
```