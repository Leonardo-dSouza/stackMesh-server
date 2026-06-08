# StackMesh — Guia de Referência Completo

> Documento de referência gerado após a implementação completa do projeto. Cobre comandos, conceitos, flags e decisões de arquitetura.

---

## Índice

1. [Arquitetura Geral](#arquitetura-geral)
2. [SSH e Acesso Remoto](#ssh-e-acesso-remoto)
3. [OpenVPN e Rede](#openvpn-e-rede)
4. [Docker e Docker Compose](#docker-e-docker-compose)
5. [Nginx](#nginx)
6. [AWS e Security Groups](#aws-e-security-groups)
7. [Prisma e Banco de Dados](#prisma-e-banco-de-dados)
8. [Diagnóstico e Debugging](#diagnóstico-e-debugging)
9. [Conceitos Importantes](#conceitos-importantes)

---

## Arquitetura Geral

```
[Você - Fedora]
      |
      | VPN (UDP 1194)
      v
[EC2 VPN - 10.8.0.1]          ← único ponto de entrada (Bastion Host)
      |
      | MASQUERADE (NAT)
      | roteia para rede interna da VPC (172.31.0.0/16)
      v
[EC2 Frontend - 172.31.x.x]   ← React estático + Nginx proxy reverso
      |
      | /api/* → porta 8080
      v
[EC2 Load Balancer - 172.31.x.x]  ← Nginx distribuindo requisições
      |
      | round-robin
      ↙      ↓      ↘
  [:5001] [:5002] [:5003]      ← 3 containers NestJS na mesma EC2
      |
      v
[EC2 DB - 172.31.x.x]         ← PostgreSQL (:5432) + MinIO (:9000/:9001)
```

**Regra de ouro:** Nenhuma EC2 além da VPN e da VPN têm porta aberta para `0.0.0.0/0`. Todo acesso passa pelo túnel.

---

## SSH e Acesso Remoto

### Conectar em uma EC2 diretamente

```bash
ssh -i stackmesh.pem ubuntu@IP_PUBLICO
```

- `-i` → especifica o arquivo de chave privada `.pem`
- `ubuntu` → usuário padrão das AMIs Ubuntu na AWS

### Conectar via Bastion Host (forma correta e segura)

O Bastion Host é a EC2 da VPN — o único ponto de entrada na infraestrutura. Todas as outras EC2 só aceitam conexões vindas de dentro da VPC.

```bash
# Passo 1 — inicia o ssh-agent e adiciona a chave
eval $(ssh-agent)
ssh-add ~/vpn-stackmesh/stackmesh.pem

# Passo 2 — conecta na VPN com Agent Forwarding (-A)
ssh -A -i ~/vpn-stackmesh/stackmesh.pem ubuntu@10.8.0.1

# Passo 3 — de dentro da VPN, pula para qualquer EC2 interna
ssh ubuntu@172.31.x.x
```

### O que é a flag `-A` (Agent Forwarding)?

Sem `-A`, a chave `.pem` precisaria estar copiada dentro da EC2 da VPN para conseguir pular para outras EC2 — o que é um risco de segurança.

Com `-A`, o SSH usa um protocolo de forwarding:

```
Fedora → pede autenticação → VPN
VPN → "preciso da chave" → pergunta pro Fedora
Fedora → assina com .pem → resposta volta para VPN → EC2 interna aceita
```

A chave **nunca sai da sua máquina**. A EC2 da VPN apenas encaminha o pedido de autenticação.

### Evitar que o SSH congele por inatividade

Cria ou edita `~/.ssh/config` no Fedora:

```
Host *
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

Isso manda um "ping" a cada 30 segundos para manter a conexão viva.

### Sair de uma conexão SSH travada

```
~.
```

Til seguido de ponto — escape sequence do SSH para forçar o fechamento.

### Copiar arquivos entre máquinas (scp)

```bash
# baixa arquivo/pasta da EC2 para sua máquina
scp -i chave.pem -r ubuntu@IP:/caminho/remoto /caminho/local

# envia arquivo da sua máquina para a EC2
scp -i chave.pem arquivo.txt ubuntu@IP:/caminho/remoto
```

- `-r` → recursivo (para pastas)
- O `.` no destino significa "aqui onde estou"

---

## OpenVPN e Rede

### Conectar na VPN (Fedora)

```bash
sudo openvpn --config ~/vpn-stackmesh/leo.ovpn
```

Quando aparecer `Initialization Sequence Completed`, está conectado.

### Verificar se o túnel está ativo

```bash
ip addr show tun0
```

Deve mostrar o IP `10.8.0.2/24`.

### Verificar rotas de rede

```bash
ip route show
ip route show | grep 172.31   # filtra rotas para a VPC
ip route show | grep tun      # filtra rotas pelo túnel
```

### Adicionar rota manualmente

```bash
sudo ip route add 172.31.0.0/16 via 10.8.0.1
```

Isso força o tráfego para `172.31.x.x` (rede interna da AWS) a passar pelo túnel VPN via `10.8.0.1` (servidor VPN).

### Remover rota

```bash
sudo ip route del 172.31.0.0/16 via 10.8.0.1
```

### O que é Split Tunnel?

No `leo.ovpn`:

```ovpn
route-nopull                        # não aceita rotas do servidor automaticamente
route 10.8.0.0 255.255.255.0        # só roteia a rede VPN pelo túnel
```

Com isso, apenas tráfego para `10.8.0.x` passa pelo túnel. A internet normal continua saindo pela sua conexão direta — sem VPN no meio.

Sem `route-nopull`, todo o tráfego passaria pelo servidor VPN, o que seria mais lento e desnecessário.

### Estrutura de arquivos do OpenVPN (servidor)

```
/etc/openvpn/
├── server.conf     ← configuração principal do servidor
├── ca.crt          ← certificado da Autoridade Certificadora
├── server.crt      ← certificado do servidor
├── server.key      ← chave privada do servidor
├── dh.pem          ← parâmetros Diffie-Hellman
├── ipp.txt         ← IPs persistentes dos clientes
├── up.sh           ← script executado quando o túnel sobe
└── easy-rsa/       ← infraestrutura de certificados (PKI)
    └── pki/
        ├── ca.crt
        ├── issued/
        │   ├── server.crt
        │   └── client1.crt
        └── private/
            ├── server.key
            └── client1.key
```

### Gerenciar o serviço OpenVPN

```bash
sudo systemctl start openvpn@server    # inicia
sudo systemctl stop openvpn@server     # para
sudo systemctl restart openvpn@server  # reinicia
sudo systemctl status openvpn@server   # verifica status
sudo systemctl enable openvpn@server   # habilita no boot
```

### O que é o MASQUERADE (NAT)?

O MASQUERADE é uma regra do `iptables` que faz NAT — tradução de endereços de rede.

**Problema sem MASQUERADE:**

```
Fedora (10.8.0.2) → envia pacote para EC2 Frontend (172.31.25.86)
EC2 Frontend recebe o pacote com origem 10.8.0.2
EC2 Frontend tenta responder para 10.8.0.2... mas não tem rota para essa rede!
Resposta se perde.
```

**Solução com MASQUERADE:**

```
Fedora (10.8.0.2) → pacote chega na EC2 da VPN
EC2 da VPN substitui a origem: 10.8.0.2 → 172.31.19.226 (seu IP na VPC)
EC2 Frontend recebe pacote com origem 172.31.19.226
EC2 Frontend responde para 172.31.19.226 → EC2 da VPN recebe
EC2 da VPN restaura: 172.31.19.226 → 10.8.0.2
Fedora recebe a resposta.
```

### Adicionar MASQUERADE manualmente

```bash
sudo iptables -t nat -A POSTROUTING -s 10.8.0.0/24 -o ens5 -j MASQUERADE
```

- `-t nat` → tabela NAT
- `-A POSTROUTING` → aplica após o roteamento (na saída)
- `-s 10.8.0.0/24` → só para tráfego que vem da rede VPN
- `-o ens5` → interface de saída (ens5 é o padrão em EC2 AWS modernas, não eth0!)
- `-j MASQUERADE` → substitui o IP de origem pelo IP da interface

### Verificar regras NAT

```bash
sudo iptables -t nat -L POSTROUTING -n
```

### Habilitar IP Forwarding

Sem isso, o kernel descarta pacotes que não são destinados à própria máquina:

```bash
# temporário (some ao reiniciar)
sudo sysctl -w net.ipv4.ip_forward=1

# permanente
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sudo sysctl -p

# verificar
cat /proc/sys/net/ipv4/ip_forward   # deve retornar 1
```

### Gerar certificado de cliente

```bash
cd /etc/openvpn/easy-rsa
sudo ./easyrsa --batch gen-req client1 nopass
sudo ./easyrsa --batch sign-req client client1

# copiar para a home
sudo mkdir /home/ubuntu/client
sudo cp pki/ca.crt /home/ubuntu/client/
sudo cp pki/issued/client1.crt /home/ubuntu/client/
sudo cp pki/private/client1.key /home/ubuntu/client/
sudo chown -R ubuntu:ubuntu /home/ubuntu/client
```

---

## Docker e Docker Compose

### Comandos básicos

```bash
# ver containers rodando
docker ps

# ver todos os containers (incluindo parados)
docker ps -a

# ver com formatação personalizada
docker ps --format "table {{.Names}}\t{{.Ports}}"

# subir containers em background
docker compose up -d

# parar e remover containers
docker compose down

# reiniciar um container específico
docker compose restart nome-do-servico

# ver logs de um container
docker logs nome-do-container
docker logs nome-do-container --tail 50   # últimas 50 linhas
docker logs nome-do-container -f          # em tempo real (follow)
```

### docker exec — executar comandos dentro de containers

```bash
# executar um comando pontual
docker exec nome-do-container comando

# abrir um shell interativo (bash ou sh)
docker exec -it nome-do-container bash
docker exec -it nome-do-container sh    # para imagens Alpine (sem bash)

# exemplos práticos
docker exec -it stackmesh-postgres psql -U admin -d stackmesh
docker exec stackmesh-minio mc mb local/stackmesh-archives
docker exec -it backend-1 sh
```

- `-i` → mantém o input aberto (interativo)
- `-t` → abre um terminal (TTY)
- Sempre use `-it` juntos quando quiser um shell interativo

### Ver variáveis de ambiente de um container

```bash
docker exec nome-do-container env
docker exec nome-do-container env | grep DATABASE   # filtra
```

### Buildar e publicar imagem

```bash
docker build -t usuario/nome-da-imagem:tag .
docker push usuario/nome-da-imagem:tag
```

### Estrutura do docker-compose.yml

```yaml
services:
  nome-do-servico:
    image: usuario/imagem:tag     # imagem do Docker Hub
    # ou
    build:
      context: .                  # pasta com o Dockerfile
      args:
        - VARIAVEL=${VARIAVEL}    # passa variáveis de build
    restart: unless-stopped       # reinicia sempre, exceto se parado manualmente
    env_file:
      - .env                      # carrega variáveis do arquivo .env
    environment:
      VARIAVEL: valor             # sobrescreve ou adiciona variáveis
    ports:
      - "8080:80"                 # porta_host:porta_container
    volumes:
      - ./local:/container        # monta arquivo/pasta do host no container
      - nome_volume:/caminho      # volume gerenciado pelo Docker (persistente)
    depends_on:
      - outro-servico             # aguarda esse serviço subir primeiro

volumes:
  nome_volume:                    # declara volumes nomeados
```

### Volumes: montagem vs cópia

| | `COPY` (Dockerfile) | `volumes` (Compose) |
|---|---|---|
| Quando acontece | No build da imagem | Quando o container sobe |
| Tipo | Cópia real | Montagem (link) |
| Mudanças no host refletem no container? | Não | Sim, em tempo real |
| Usado para | Código e arquivos estáticos | Configs, dados persistentes |

---

## Nginx

### Anatomia de um arquivo de configuração

```nginx
# bloco server — define um servidor virtual
server {
    listen 80;              # porta que o Nginx escuta
    server_name dominio;    # domínio ou IP (opcional)
    root /var/www/html;     # pasta com arquivos estáticos
    index index.html;       # arquivo padrão

    # bloco location — define o que fazer com cada URL
    location / {
        # try_files — tenta encontrar o arquivo, se não achar serve o index.html
        # necessário para SPAs (React, Vue, etc.)
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        # proxy_pass — repassa a requisição para outro servidor
        proxy_pass http://172.31.x.x:8080;

        # preserva informações do cliente original
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
}

# upstream — define um grupo de servidores para load balancing
upstream backend {
    server 172.31.x.x:5001;   # round-robin por padrão
    server 172.31.x.x:5002;
    server 172.31.x.x:5003;
}
```

### Como o `location` funciona

O Nginx usa o bloco `location` mais específico que casar com a URL:

```
GET /login         → bate em location /
GET /api/files     → bate em location /api/
GET /api/auth      → bate em location /api/
```

### Testar e recarregar configuração

```bash
sudo nginx -t              # testa sem aplicar
sudo nginx -s reload       # recarrega sem derrubar
sudo systemctl restart nginx  # reinicia completamente
```

Sempre rodar `nginx -t` antes de `reload` — se tiver erro, o Nginx avisa sem derrubar o serviço.

### Gerenciar o serviço Nginx

```bash
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl restart nginx
sudo systemctl status nginx
sudo systemctl enable nginx   # habilita no boot
```

### envsubst — substituição de variáveis em arquivos

O Nginx não lê variáveis de ambiente nativamente. O `envsubst` substitui `${VARIAVEL}` pelo valor real antes de o Nginx iniciar.

A imagem oficial `nginx:alpine` suporta isso nativamente via pasta `/etc/nginx/templates/`:

```yaml
# docker-compose.yml
proxy:
  image: nginx:alpine
  environment:
    - LOAD_BALANCER_IP=${LOAD_BALANCER_IP}
  volumes:
    # arquivo .template → o Nginx roda envsubst automaticamente
    # e salva em /etc/nginx/conf.d/proxy_reverso.conf
    - ./nginx/proxy_reverso.conf.template:/etc/nginx/templates/proxy_reverso.conf.template
```

No arquivo `.template`:

```nginx
proxy_pass http://${LOAD_BALANCER_IP};
```

O Nginx substitui `${LOAD_BALANCER_IP}` pelo valor da variável de ambiente antes de iniciar.

### Arquivos de configuração — onde ficam

```
/etc/nginx/
├── nginx.conf                  ← configuração principal (não editar)
├── conf.d/                     ← configs adicionais (carregadas automaticamente)
│   └── load_balancer.conf
└── sites-available/            ← configs disponíveis (Ubuntu)
    └── proxy_reverso.conf
        ↑ linkado em sites-enabled/ para ativar
```

---

## AWS e Security Groups

### Conceito de Security Group

Security Group é um firewall virtual que controla o tráfego de entrada (inbound) e saída (outbound) de uma EC2. Funciona com regras de **permissão** — tudo que não está explicitamente permitido é bloqueado.

### Regras de entrada do projeto

| EC2 | Porta | Protocolo | Origem | Motivo |
|---|---|---|---|---|
| VPN | 1194 | UDP | 0.0.0.0/0 | Clientes VPN de qualquer lugar |
| VPN | 22 | TCP | 0.0.0.0/0 | SSH direto (único acesso externo) |
| Frontend | 80 | TCP | 10.8.0.0/24 | Só quem está na VPN acessa |
| Frontend | 22 | TCP | 172.31.0.0/16 | SSH via bastion (rede interna da VPC) |
| Load Balancer | 8080 | TCP | 172.31.0.0/16 | Só o proxy reverso bate aqui |
| Load Balancer | 22 | TCP | 172.31.0.0/16 | SSH via bastion |
| Backend | 5001-5003 | TCP | 172.31.0.0/16 | Só o load balancer bate aqui |
| Backend | 22 | TCP | 172.31.0.0/16 | SSH via bastion |
| DB | 5432 | TCP | 172.31.0.0/16 | PostgreSQL — só o backend acessa |
| DB | 9000 | TCP | 172.31.0.0/16 | MinIO API — backend e presigned URLs |
| DB | 9001 | TCP | 172.31.0.0/16 | MinIO console admin |
| DB | 22 | TCP | 172.31.0.0/16 | SSH via bastion |

### Por que `172.31.0.0/16` e não o IP específico?

No AWS Academy, os IPs privados (`172.31.x.x`) mudam quando a sessão reseta. Usar `/16` cobre toda a rede interna da VPC sem depender de IPs fixos.

### IP Elástico vs IP Privado

| | IP Elástico (público) | IP Privado |
|---|---|---|
| Fixo após reset? | ✅ Sim | ❌ Pode mudar |
| Acessível da internet? | ✅ Sim | ❌ Só dentro da VPC |
| Passa pelo túnel VPN? | ❌ Não | ✅ Com MASQUERADE + rota |
| Usado para | VPN (endpoint fixo) | Comunicação interna entre EC2s |

### User Data

Script que roda automaticamente no **primeiro boot** da EC2. Usado para automatizar a configuração inicial.

```bash
#!/bin/bash
# sempre começa com isso

# redireciona toda a saída para um log
exec > /var/log/meu-setup.log 2>&1

# seus comandos aqui...
```

Para verificar se rodou:

```bash
cat /var/log/cloud-init-output.log  # log geral do cloud-init
cat /var/log/meu-setup.log          # seu log personalizado
```

---

## Prisma e Banco de Dados

### Rodar migrations

```bash
# entra no container do backend
sudo docker exec -it stackmesh-backend-1-1 sh

# vai para a pasta raiz do app
cd /app

# roda as migrations pendentes
npx prisma migrate deploy
```

**Importante:** rodar sempre de `/app`, nunca de `/app/prisma`. O Prisma precisa encontrar o `prisma.config.ts` na raiz.

### Rodar seed

```bash
cd /app
npx prisma db seed
```

### Verificar conexão com o banco

```bash
# dentro do container do postgres
sudo docker exec -it stackmesh-postgres psql -U admin -d stackmesh

# comandos úteis dentro do psql
\dt              # lista tabelas
\d nome_tabela   # descreve uma tabela
\q               # sai
```

### DATABASE_URL — formato

```
postgresql://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO
```

Exemplo:
```
postgresql://admin:admin123@@172.31.10.174:5432/stackmesh
```

**Atenção:** O `@` na senha precisa ser escapado — por isso aparece `admin123@@` (dois arrobas).

---

## Diagnóstico e Debugging

### Verificar se uma porta está escutando

```bash
sudo ss -tlnp | grep 80      # porta 80
sudo ss -tlnp | grep 5432    # PostgreSQL
```

- `ss` é o substituto moderno do `netstat`
- `-t` → TCP
- `-l` → só portas em escuta (listening)
- `-n` → mostra números em vez de nomes
- `-p` → mostra o processo

### Testar conectividade HTTP

```bash
curl http://172.31.25.86           # simples
curl -v http://172.31.25.86        # verbose (mostra cabeçalhos)
curl http://localhost:8080/api/health
```

### Monitorar tráfego de rede

```bash
sudo tcpdump -i any port 80        # captura tráfego na porta 80
sudo tcpdump -i tun0               # captura tráfego no túnel VPN
```

### Ver regras do iptables

```bash
sudo iptables -L FORWARD -n          # regras de forward
sudo iptables -L DOCKER -n           # regras do Docker
sudo iptables -t nat -L POSTROUTING -n  # regras NAT
```

### Logs úteis

```bash
# User Data
cat /var/log/cloud-init-output.log
cat /var/log/vpn-setup.log
cat /var/log/db-setup.log

# OpenVPN
sudo journalctl -u openvpn@server -f

# Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Docker
docker logs nome-do-container -f
```

### Ping e conectividade

```bash
ping 10.8.0.1          # testa se o servidor VPN responde pelo túnel
ping 172.31.25.86      # testa conectividade com EC2 interna

# se o Security Group não tem regra ICMP, o ping não funciona
# mas isso não significa que o serviço está fora do ar
# use curl para testar serviços HTTP
```

---

## Conceitos Importantes

### Bastion Host (Jump Server)

A EC2 da VPN funciona como Bastion Host — o único servidor exposto na internet. Todas as outras EC2 ficam em rede privada, acessíveis apenas via jump:

```
internet → Bastion (EC2 VPN) → EC2s internas
```

Isso reduz drasticamente a superfície de ataque. Se todas as EC2 tivessem IP público, cada uma seria um alvo em potencial.

### Split Tunnel vs Full Tunnel

| | Split Tunnel | Full Tunnel |
|---|---|---|
| Tráfego VPN | Só rede privada (10.8.0.0/24) | Todo o tráfego |
| Internet | Sai direto, sem VPN | Passa pelo servidor VPN |
| Velocidade | Mais rápido | Mais lento |
| Uso | Acesso a recursos internos | Privacidade total |
| Configuração | `route-nopull` + rotas específicas | `push "redirect-gateway def1"` |

No projeto foi usado Split Tunnel — apenas o tráfego para a rede interna passa pelo túnel.

### Proxy Reverso vs Load Balancer

Ambos usam Nginx, mas com responsabilidades diferentes:

| | Proxy Reverso | Load Balancer |
|---|---|---|
| Onde fica | EC2 do Frontend | EC2 isolada |
| Função | Rotear `/` e `/api/` | Distribuir entre backends |
| Esconde | IP do load balancer | IPs dos backends |
| Config | `proxy_pass` simples | `upstream` + `proxy_pass` |

### Round-Robin

O algoritmo padrão do Nginx para distribuir requisições entre servidores do `upstream`:

```
Requisição 1 → backend:5001
Requisição 2 → backend:5002
Requisição 3 → backend:5003
Requisição 4 → backend:5001  ← volta ao início
...
```

Cada servidor recebe o mesmo número de requisições ao longo do tempo.

### Presigned URL (MinIO/S3)

Em vez de o backend receber o arquivo, fazer upload para o S3 e devolver a resposta (3 viagens), com presigned URL:

```
1. Frontend → "quero fazer upload de arquivo.pdf"
2. Backend → valida, gera URL assinada com expiração → devolve URL
3. Frontend → faz PUT direto no MinIO usando a URL
4. Frontend → notifica backend que o upload foi concluído
5. Backend → registra metadados no PostgreSQL
```

A URL assinada contém as credenciais e permissões embutidas, com validade de X segundos. Após expirar, ninguém mais pode usá-la.

### Variáveis de ambiente: build-time vs runtime

| | Build-time (`VITE_*`) | Runtime (Nginx `envsubst`) |
|---|---|---|
| Quando é resolvida | Durante `npm run build` | Quando o container sobe |
| Como passar | `ARG` + `ENV` no Dockerfile | `environment` no Compose |
| Fica onde | Dentro do JS compilado | No arquivo `.conf` processado |
| Exemplo | `VITE_API_BASE_URL=/api` | `LOAD_BALANCER_IP=172.31.x.x` |

### `ens5` vs `eth0`

Instâncias EC2 AWS modernas usam `ens5` como interface de rede principal, não `eth0` (que era o padrão antigo). Isso impacta regras de iptables, configurações de rede e scripts de setup.

Para sempre descobrir a interface correta:

```bash
ip link show
# ou
ip route | grep default
```

---

*Gerado como referência do projeto StackMesh — Redes de Computadores*