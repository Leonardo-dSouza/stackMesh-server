# Docker Compose



## O que o Compose faz

O `docker compose` serve para definir e subir vários containers com um único arquivo.

Ele lê um arquivo YAML, normalmente chamado `docker-compose.yml`, e entende como cada serviço deve ser criado, iniciado, conectado e configurado.

Regra importante:

- `Dockerfile` define como montar uma imagem
- `docker-compose.yml` define como subir vários containers usando imagens

---

## Estrutura básica

```yaml
services:
  app:
    image: minha-imagem:1.0
```

Os blocos mais comuns são:

- `services` → lista os containers que o Compose vai criar
- `image` → imagem que será usada no serviço
- `build` → manda o Compose construir a imagem antes de subir o serviço

---

## `services`

`services` é o bloco principal.

Tudo que estiver dentro dele é um serviço, ou seja, um container ou um conjunto de containers criados a partir de uma mesma configuração.

Exemplo:

```yaml
services:
  backend:
    image: stackmesh-backend:test

  postgres:
    image: postgres:16

  minio:
    image: minio/minio
```

Aqui existem três serviços:

- `backend`
- `postgres`
- `minio`

---

## Nome do serviço

O nome que você escreve em `services` vira o nome lógico do serviço dentro do Compose.

Exemplo:

```yaml
services:
  backend-1:
    image: stackmesh-backend:test
```

Nesse caso, `backend-1` é o nome do serviço.

Esse nome também é útil para comunicação interna entre containers, porque o Compose cria uma rede própria e cada serviço pode ser acessado pelo nome.

---

## `image`

`image` diz qual imagem o serviço vai usar.

Exemplo:

```yaml
services:
  postgres:
    image: postgres:16
```

Isso significa:

- usar a imagem `postgres`
- na tag `16`

Se a imagem já existir, o Compose usa ela.
Se não existir, ele baixa do registry configurado, normalmente o Docker Hub.

---

## `build`

`build` diz para o Compose construir a imagem em vez de só baixar uma pronta.

Exemplo:

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
```

### `context`

`context` é a pasta base que o Docker vai usar como contexto do build.

Exemplo:

```yaml
context: .
```

O ponto significa a pasta atual.

### `dockerfile`

`dockerfile` diz qual arquivo será usado para construir a imagem.

Exemplo:

```yaml
dockerfile: Dockerfile
```

Se você não escrever isso, o Compose procura um arquivo chamado `Dockerfile` por padrão.

---

## `ports`

`ports` faz o mapeamento entre a porta do host e a porta do container.

Exemplo:

```yaml
services:
  backend-1:
    ports:
      - "5001:5000"
```

Isso quer dizer:

- `5001` no host
- `5000` dentro do container

Forma geral:

```yaml
host:container
```

Se você tiver 3 containers do backend na mesma EC2, pode fazer:

```yaml
backend-1:
  ports:
    - "5001:5000"

backend-2:
  ports:
    - "5002:5000"

backend-3:
  ports:
    - "5003:5000"
```

---

## `environment`

`environment` define variáveis de ambiente diretamente no Compose.

Exemplo:

```yaml
services:
  backend-1:
    environment:
      PORT: 5000
      INSTANCE_ID: backend-1
```

Isso é útil quando cada container precisa de valores diferentes.

No seu caso:

- todos podem usar `PORT=5000` internamente
- cada um recebe um `INSTANCE_ID` diferente

Você também pode passar valores do `.env`:

```yaml
environment:
  PORT: ${PORT}
```

---

## `env_file`

`env_file` carrega variáveis de um arquivo `.env` para dentro do serviço.

Exemplo:

```yaml
services:
  backend:
    env_file:
      - .env
```

Isso é útil para não repetir variáveis grandes dentro do YAML.

Diferença prática:

- `env_file` lê um arquivo inteiro
- `environment` define variáveis uma a uma

---

## `volumes`

`volumes` serve para persistir dados ou montar diretórios.

Exemplo de bind mount:

```yaml
services:
  backend:
    volumes:
      - .:/app
```

Isso significa:

- pasta atual do host
- montada dentro do container em `/app`

Exemplo de volume nomeado:

```yaml
services:
  postgres:
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```

Aqui os dados do banco ficam persistidos mesmo se o container morrer.

---

## `depends_on`

`depends_on` diz que um serviço depende do outro para iniciar.

Exemplo:

```yaml
services:
  backend:
    depends_on:
      - postgres
      - minio
```

Isso ajuda a organizar a ordem de subida.

Mas atenção: `depends_on` não garante que o serviço já esteja pronto para aceitar conexão, só que ele foi iniciado.

---

## `restart`

`restart` define a política de reinício do container.

Exemplo:

```yaml
services:
  backend:
    restart: unless-stopped
```

Valores comuns:

- `no` → não reinicia
- `always` → reinicia sempre
- `unless-stopped` → reinicia, exceto se você parar manualmente
- `on-failure` → reinicia se o processo falhar

---

## `command`

`command` sobrescreve o comando padrão da imagem.

Exemplo:

```yaml
services:
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
```

Nesse caso, você está dizendo exatamente como o container deve iniciar.

---

## `container_name`

`container_name` força um nome fixo para o container.

Exemplo:

```yaml
services:
  backend:
    container_name: stackmesh-backend-1
```

Funciona, mas em geral não é o mais flexível se você quiser escalar ou subir múltiplas réplicas.

---

## `networks`

`networks` permite organizar a rede dos serviços.

Exemplo:

```yaml
services:
  backend:
    networks:
      - stackmesh-net

networks:
  stackmesh-net:
```

Isso é útil quando você quer separar ou controlar melhor a comunicação entre os containers.

Na prática, o Compose já cria uma rede padrão para os serviços do arquivo.

---

## `healthcheck`

`healthcheck` define uma verificação de saúde do container.

Exemplo:

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

Isso ajuda a saber se o container está realmente saudável.

---

## Variáveis com `.env`

O Compose pode ler variáveis de ambiente do arquivo `.env` do mesmo diretório.

Exemplo:

```dotenv
PORT=5000
INSTANCE_ID=backend-1
```

No YAML:

```yaml
services:
  backend:
    environment:
      PORT: ${PORT}
      INSTANCE_ID: ${INSTANCE_ID}
```

---

## Exemplo de leitura do arquivo

```yaml
services:
  backend-1:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      PORT: 5000
      INSTANCE_ID: backend-1
    ports:
      - "5001:5000"

  backend-2:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      PORT: 5000
      INSTANCE_ID: backend-2
    ports:
      - "5002:5000"

  backend-3:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      PORT: 5000
      INSTANCE_ID: backend-3
    ports:
      - "5003:5000"
```

Leitura desse exemplo:

- `services` define os 3 containers
- `build` manda construir a imagem localmente
- `environment` passa o `PORT` e o `INSTANCE_ID`
- `ports` expõe cada container em uma porta diferente no host

---

## Regra prática para o seu projeto

Se você for montar o backend com 3 instâncias, normalmente vai usar:

- `services`
- `build`
- `environment`
- `ports`
- `depends_on`
- `restart`
- `env_file` ou `.env`
- `volumes` para persistência, se precisar

---

## Resumo final

O `docker-compose.yml` é o arquivo que descreve os containers e a forma de subir eles.

Ele não substitui o `Dockerfile`. Os dois trabalham juntos:

- `Dockerfile` = como construir a imagem
- `docker-compose.yml` = como subir e conectar os containers

Se quiser, eu posso fazer o próximo passo e te montar um `docker-compose.yml` comentado linha por linha, no mesmo estilo desse documento, para você ir construindo sozinho.
# Docker Compose

Este projeto vai usar `docker-compose` apenas na EC2 do backend.

O objetivo é subir, na mesma máquina:

- 3 instâncias do backend NestJS
- o Postgres, se você decidir manter o banco nessa EC2
- o MinIO, se você decidir manter o storage nessa EC2

Se o Postgres e o MinIO ficarem em EC2 separadas, o compose da EC2 do backend sobe apenas as 3 instâncias do backend.

---

## O que o Compose faz

O `docker-compose.yml` serve para definir vários containers e subir tudo com um único comando.

Ele não distribui serviços entre máquinas diferentes. Cada `compose` atua só na máquina onde ele está rodando.

Então, no seu cenário:

- uma EC2 para o front
- uma EC2 para o Postgres
- uma EC2 para o MinIO
- uma EC2 para o backend, com `docker compose`
- uma EC2 ou serviço para o load balancer

O Compose entra só na EC2 do backend.

---

## Exemplo de estrutura

```yaml
services:
  backend-1:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      PORT: 5000
      INSTANCE_ID: backend-1
    ports:
      - "5001:5000"

  backend-2:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      PORT: 5000
      INSTANCE_ID: backend-2
    ports:
      - "5002:5000"

  backend-3:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      PORT: 5000
      INSTANCE_ID: backend-3
    ports:
      - "5003:5000"
```

Nesse modelo:

- cada container escuta na porta interna `5000`
- no host, cada um recebe uma porta diferente
- o backend continua vendo `PORT=5000`
- o `INSTANCE_ID` muda por container

---

## Quando o banco e o MinIO ficam na mesma EC2

Se você quiser colocar o Postgres e o MinIO junto da EC2 do backend, o compose pode ter também:

- `postgres`
- `minio`

Nesse caso, o backend aponta para os nomes dos serviços na rede do Compose.

Exemplo:

```dotenv
DATABASE_URL=postgresql://postgres:kali@postgres:5432/stackmesh
AWS_S3_ENDPOINT=http://minio:9000
```

---

## Quando o banco e o MinIO ficam em outras EC2

Se eles estiverem em máquinas separadas, o backend usa o DNS ou IP dessas máquinas.

Exemplo:

```dotenv
DATABASE_URL=postgresql://postgres:kali@10.0.1.20:5432/stackmesh
AWS_S3_ENDPOINT=http://10.0.1.30:9000
```

---

## Sobre o load balancer

Você perguntou se não bastaria configurar o load balancer para distribuir entre as portas `5001`, `5002` e `5003` da EC2 do backend.

Sim, isso pode funcionar. Um load balancer pode apontar para a mesma EC2 em portas diferentes, desde que você registre cada par `instância + porta` como um target válido.

Ou seja:

- target 1: EC2 do backend na porta `5001`
- target 2: EC2 do backend na porta `5002`
- target 3: EC2 do backend na porta `5003`

Nesse caso, o proxy não é obrigatório.

---

## Então quando o proxy faz sentido

Um proxy local, como Nginx ou Traefik, faz sentido quando você quer simplificar a frente do backend.

Com proxy:

- o load balancer aponta para uma única porta da EC2
- o proxy distribui para os 3 containers internamente
- você evita expor várias portas do host
- fica mais fácil trocar containers sem mexer no LB

Sem proxy:

- o load balancer precisa conhecer as 3 portas
- você gerencia mais regras no balanceador
- funciona, mas fica mais verboso de manter

---

## Regra prática

Use **sem proxy** se:

- você quer algo direto
- aceita registrar `5001`, `5002` e `5003` no LB
- não se importa em expor várias portas na EC2 do backend

Use **com proxy** se:

- você quer um ponto único de entrada na EC2 do backend
- quer reduzir configuração no load balancer
- pretende trocar as instâncias internas com frequência

---

## Resumo final

No seu cenário, o Compose sobe 3 containers do backend na mesma EC2.

O load balancer pode:

- distribuir direto para as 3 portas da EC2, sem proxy
- ou apontar para um proxy único, que distribui internamente

O proxy não é obrigatório, mas costuma deixar a arquitetura mais simples de operar.