# Microserviço de Pagamentos — Sistema de Gestão Hoteleira

## 1. Sobre o projeto

Microserviço desenvolvido com **NestJS e TypeScript**, responsável pelo gerenciamento de pagamentos e faturas de reservas em um sistema de gestão hoteleira.

O projeto adota uma arquitetura de microserviços, na qual Pagamentos, Reservas e demais serviços são desenvolvidos de forma independente.

Na versão original, a integração HTTP com um **API Gateway** foi testada nas portas 3000 (Gateway) e 3001 (Pagamentos). No ambiente de integração atual, Pagamentos utiliza a porta 3004. A integração com Reservas e a validação do Gateway conjunto permanecem pendentes.

**Escopo acadêmico:** os pagamentos, cancelamentos e estornos são registrados ou simulados no banco de dados. Não existe integração com adquirentes, instituições bancárias ou gateways financeiros. Portanto, não ocorre movimentação real de dinheiro.

## 2. Tecnologias utilizadas

- Node.js
- NestJS 11
- TypeScript
- Prisma ORM 6
- MySQL
- RabbitMQ 4 (mensageria AMQP)
- Docker Desktop (RabbitMQ em contêiner)
- `@nestjs/microservices` 11, `amqplib` e `amqp-connection-manager`
- Swagger / OpenAPI 3.0 — documentação interativa da API
- Bruno — testes de endpoints
- Prisma Studio — inspeção dos registros
- Git e GitHub — controle de versionamento

## 3. Funcionalidades implementadas

### Pagamentos

- Cadastro e listagem de pagamentos.
- Geração automática de identificadores UUID.
- Associação lógica entre pagamento e reserva por meio de `reserva_id`.
- Validação dos campos recebidos por DTO.
- Validação dos tipos e métodos de pagamento.
- Restrição de cartão de crédito para pagamentos do tipo SINAL e TOTAL.
- Persistência dos registros no MySQL.
- Criação de pagamentos com status inicial `PENDENTE`.
- Aprovação simulada de pagamentos pendentes via API.
- Cancelamento de pagamentos pendentes sem estorno.
- Estorno simulado de pagamentos aprovados.
- Bloqueio de operações incompatíveis com o status atual.
- Tratamento de erros HTTP.

### Faturas

- Emissão de faturas para pagamentos dos tipos TOTAL ou SALDO com status `APROVADO`.
- Validação do UUID do pagamento e do valor opcional da reserva por DTO.
- Geração de UUID e código identificador da fatura.
- Associação da fatura ao pagamento.
- Registro do valor do pagamento.
- Apresentação do valor total da reserva na resposta de emissão, quando informado.
- Bloqueio de emissão duplicada para o mesmo pagamento.
- Cancelamento de faturas emitidas.
- Validação das regras de emissão e cancelamento.

**Observação:** o valor total da reserva é atualmente recebido na requisição e apresentado na resposta da API. Esse campo não é persistido na tabela `fatura`, devido às restrições de alteração da estrutura do banco MySQL disponibilizado para o projeto.

### Eventos de notificações (RabbitMQ)

- Publicação assíncrona de eventos após operações bem-sucedidas no MySQL.
- Eventos implementados: `pagamento.criado`, `pagamento.aprovado`, `pagamento.cancelado`, `pagamento.estornado`, `fatura.emitida` e `fatura.cancelada`.
- Fila durável `notificacoes_pagamentos`, publicação de novas mensagens persistentes e conexão AMQP por meio do `NotificacoesService`. A URL do broker é obtida da variável `RABBITMQ_URL`.
- Os eventos são publicados, mas **ainda não existe consumidor para enviar notificações a hóspedes ou outros destinatários**.

### Documentação

- Configuração do Swagger.
- Organização dos endpoints nas categorias Pagamentos e Faturas.
- Documentação dos parâmetros, exemplos de requisição e respostas HTTP.
- Possibilidade de testar os endpoints diretamente pela interface Swagger.

## 4. Regras de negócio

### Tipos de pagamento

| Tipo | Descrição |
|---|---|
| SINAL | Pagamento de 30% do valor da reserva |
| TOTAL | Pagamento integral da reserva |
| SALDO | Pagamento do valor restante no checkout |

### Métodos permitidos

| Tipo | Métodos |
|---|---|
| SINAL | CREDITO |
| TOTAL | CREDITO |
| SALDO | CREDITO, DEBITO, PIX, DINHEIRO |

A conferência do valor exato de 30%, 100% ou do saldo restante dependerá da integração com o microserviço de Reservas.

O mock de Reservas utilizado durante o desenvolvimento foi removido após revisão acadêmica.

### Aprovação, cancelamento e estorno

| Operação | Status exigido | Novo status |
|---|---|---|
| Aprovação simulada | PENDENTE | APROVADO |
| Cancelamento sem estorno | PENDENTE | CANCELADO |
| Estorno simulado | APROVADO | ESTORNADO |

As operações rejeitam pagamentos com status incompatível, inclusive tentativas repetidas.

O estorno não representa devolução financeira real.

### Emissão de faturas

Uma fatura somente pode ser emitida quando:

1. O pagamento existe.
2. O pagamento é do tipo `TOTAL` ou `SALDO`.
3. O pagamento possui status `APROVADO`.
4. Ainda não existe fatura associada ao pagamento.

A tentativa de emitir uma segunda fatura para o mesmo pagamento retorna **409 Conflict**.

### Cancelamento de faturas

O cancelamento é permitido para faturas com status `EMITIDA`, alterando seu status para `CANCELADA`.

## 5. Estrutura do microserviço

```text
src/
├── fatura/
│   ├── fatura.controller.ts
│   ├── fatura.module.ts
│   ├── fatura.service.ts
│   └── fatura-validator.service.ts
├── pagamento/
│   ├── dto/
│   │   └── create-pagamento.dto.ts
│   ├── pagamento.controller.ts
│   ├── pagamento.module.ts
│   ├── pagamento.service.ts
│   └── pagamento-validator.service.ts
├── notificacoes/
│   ├── notificacoes.module.ts
│   └── notificacoes.service.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── app.module.ts
└── main.ts
```

### Responsabilidades

- **PagamentoController:** disponibiliza os endpoints HTTP de pagamentos.
- **PagamentoService:** coordena as operações de pagamentos e a persistência.
- **PagamentoValidatorService:** centraliza as validações das regras de pagamento.
- **CreatePagamentoDto:** define e valida os dados de criação.
- **FaturaController:** disponibiliza os endpoints HTTP de faturas.
- **EmitirFaturaDto:** valida o UUID do pagamento e o valor opcional da reserva (positivo, numérico e com até duas casas decimais).
- **FaturaService:** coordena emissão, cancelamento e persistência das faturas.
- **FaturaValidatorService:** valida as regras de emissão e cancelamento.
- **PrismaService:** disponibiliza o acesso ao MySQL.
- **NotificacoesModule:** registra o cliente de transporte RabbitMQ e exporta o serviço de publicação.
- **NotificacoesService:** conecta ao broker e publica eventos de domínio na fila.

## 6. Endpoints disponíveis

### Pagamentos

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/pagamentos` | Lista os pagamentos cadastrados |
| POST | `/pagamentos` | Cadastra um pagamento |
| GET | `/pagamentos/reserva/:reserva_id` | Consulta pagamentos vinculados a uma reserva |
| PATCH | `/pagamentos/:id/aprovar` | Simula a aprovação de um pagamento pendente |
| PATCH | `/pagamentos/:id/cancelar` | Cancela um pagamento pendente |
| PATCH | `/pagamentos/:id/estornar` | Simula o estorno de um pagamento aprovado |

### Faturas

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/faturas` | Emite uma fatura |
| PATCH | `/faturas/:id/cancelar` | Cancela uma fatura emitida |

O parâmetro `:id` representa o UUID do registro correspondente.

### Exemplo — Criar pagamento

**POST `/pagamentos`**

```json
{
  "reserva_id": "550e8400-e29b-41d4-a716-446655440002",
  "valor": 600,
  "tipo": "SINAL",
  "metodo": "CREDITO"
}
```

**Resposta esperada: 201 Created**

```json
{
  "id": "6693dbce-fd12-4dea-ad8f-c3dc3b87516a",
  "reserva_id": "550e8400-e29b-41d4-a716-446655440002",
  "valor": "600",
  "tipo": "SINAL",
  "metodo": "CREDITO",
  "status": "PENDENTE",
  "data_pagamento": "2026-11-06T20:39:09.000Z"
}
```

### Exemplo — Emitir fatura

**POST `/faturas`**

```json
{
  "pagamento_id": "c747b217-051c-4148-9eb8-67d1d7ff6221",
  "valor_total_reserva": 1000
}
```

**Resposta observada: 201 Created**

```json
{
  "id": "11fdcea1-6c61-4ad0-b430-2f01be6ac51c",
  "codigo": "63614643-af1b-402d-bf76-d0c6bbd2f067",
  "pagamento_id": "c747b217-051c-4148-9eb8-67d1d7ff6221",
  "valor": "700",
  "status": "EMITIDA",
  "data_emissao": "2026-11-16T00:58:28.000Z",
  "valor_total_reserva": 1000
}
```

Nesse exemplo:

- Valor total da reserva: **R$ 1.000,00**.
- Valor do pagamento SALDO: **R$ 700,00**.
- Status da fatura: **EMITIDA**.

O campo `valor_total_reserva` é apresentado na resposta, mas não armazenado na tabela de faturas.

### Respostas HTTP

| Código | Significado |
|---|---|
| 200 OK | Consulta, aprovação, cancelamento ou estorno realizado com sucesso |
| 201 Created | Pagamento ou fatura criado com sucesso |
| 400 Bad Request | Dados inválidos ou operação não permitida |
| 404 Not Found | Pagamento ou fatura não encontrado |
| 409 Conflict | Já existe uma fatura para o pagamento informado |

## 7. Status dos registros

### Pagamentos

| Status | Significado |
|---|---|
| PENDENTE | Pagamento registrado e aguardando processamento |
| APROVADO | Pagamento aprovado |
| RECUSADO | Pagamento recusado |
| CANCELADO | Pagamento cancelado sem estorno |
| ESTORNADO | Estorno registrado de forma simulada |

Novos pagamentos são criados com status `PENDENTE`.

A aprovação simulada é realizada via `PATCH /pagamentos/:id/aprovar`, sem necessidade de alterar registros manualmente no Prisma Studio. A aprovação automática e a integração com um provedor financeiro ainda não foram implementadas. O endpoint de simulação deve permanecer restrito ao ambiente acadêmico ou interno autorizado.

### Faturas

| Status | Significado |
|---|---|
| EMITIDA | Fatura emitida |
| CANCELADA | Fatura cancelada |

## 8. Instalação e execução

### Pré-requisitos

- Node.js e npm instalados (Node.js 22 utilizado nesta etapa).
- Acesso a um banco MySQL compatível.
- Variáveis de ambiente configuradas.
- RabbitMQ acessível (para inicialização do cliente de notificações).

### Instalar dependências

```bash
npm install
```

### Configurar o banco de dados

Crie um arquivo `.env` na raiz do projeto e configure as variáveis:

```env
PORT=3004
DATABASE_URL="mysql://USUARIO:SENHA@HOST:3306/NOME_DO_BANCO"
RABBITMQ_URL="amqp://USUARIO_RMQ:SENHA_RMQ@localhost:5672"
```

Substitua os valores de exemplo pelas credenciais do ambiente. Para desenvolvimento local, `localhost:5672` é a porta AMQP do RabbitMQ. Se o NestJS também executar dentro de um contêiner, ajuste o host para o endereço alcançável a partir desse contêiner.

**Segurança:** não versione o arquivo `.env` nem compartilhe credenciais de acesso.

### Gerar o Prisma Client

```bash
npx prisma generate
```

Para um banco local exclusivo de testes, utilize `npx prisma validate` e `npx prisma db push` para conferir e sincronizar o esquema. Não execute alterações de esquema no banco compartilhado sem autorização.

### Compilar o projeto

```bash
npm run build
```

### Iniciar em desenvolvimento

```bash
npm run start:dev
```

Nos testes de integração local, o microserviço está disponível em:

`http://localhost:3004`

A porta é definida por `PORT`. O Gateway conjunto ainda será configurado.

### Acessar o Swagger

Abra no navegador:

`http://localhost:3004/api`

A interface permite consultar a documentação e executar requisições de teste.

### Acessar o Prisma Studio

```bash
npx prisma studio
```

Alterações realizadas no Prisma Studio afetam diretamente o banco configurado.

**Atenção:** o usuário do banco MySQL acadêmico possui restrições para comandos de alteração de tabelas. Tentativas de modificar o esquema podem resultar em erros de permissão.

## 9. Testes realizados

Na versão original, os endpoints foram testados utilizando Bruno e Swagger. Os resultados históricos abaixo foram preservados; os testes adicionais desta versão foram executados diretamente via PowerShell e painel RabbitMQ.

| Cenário | Resultado observado |
|---|---|
| Listagem de pagamentos | 200 OK |
| Criação de pagamento válido | 201 Created |
| Tentativa de SINAL com PIX | 400 Bad Request |
| Consulta de registros persistidos | 200 OK |
| Cancelamento de pagamento PENDENTE | 200 OK |
| Segunda tentativa de cancelamento | 400 Bad Request |
| Estorno de pagamento PENDENTE | 400 Bad Request |
| Estorno simulado de pagamento APROVADO | 200 OK |
| Segunda tentativa de estorno | 400 Bad Request |
| Emissão de fatura para SALDO aprovado | 201 Created |
| Emissão duplicada de fatura | 409 Conflict |
| Listagem de pagamentos pelo Swagger | 200 OK |
| Compilação do projeto | Sem erros |
| Criação de pagamento via API Gateway | 201 Created |
| Cancelamento de pagamento via API Gateway | 200 OK |
| Estorno de pagamento via API Gateway | 200 OK |
| Emissão de fatura via API Gateway | 201 Created |
| Cancelamento de fatura via API Gateway | 200 OK |
| Conexão NestJS → RabbitMQ | Confirmada nos logs e painel de administração |
| Publicação `pagamento.criado` | Confirmada por log e mensagens na fila |
| Publicação `pagamento.cancelado` | Payload confirmado no RabbitMQ |
| Publicação `pagamento.estornado` | Confirmada por log |
| Publicação `fatura.emitida` | Confirmada por log |
| Publicação `fatura.cancelada` | Payload confirmado no RabbitMQ |
| Aprovação simulada de pagamento | 200 OK |
| Aprovação duplicada | 400 Bad Request |
| Emissão de fatura para TOTAL aprovado | 201 Created |
| Cancelamento duplicado de fatura | 400 Bad Request |
| UUID inválido e valor negativo na emissão | 400 Bad Request |
| Publicação `pagamento.aprovado` | Payload confirmado no RabbitMQ |
| Inspeção dos seis tipos de eventos | Payloads confirmados no RabbitMQ |
| Publicação de nova mensagem persistente | delivery_mode: 2 |

Também foram documentados os códigos HTTP dos endpoints de faturas e pagamentos no Swagger.

Os testes realizados não representam transações financeiras reais.

## 10. Refatoração e melhorias realizadas

Durante o desenvolvimento, o projeto passou pelas seguintes melhorias:

1. Separação das responsabilidades entre Controller, Service e Validator.
2. Remoção do `ReservaMockService` após revisão acadêmica.
3. Criação do `PagamentoValidatorService`.
4. Implementação das operações de cancelamento e estorno simulado.
5. Criação do módulo de faturas.
6. Implementação do `FaturaValidatorService`.
7. Implementação da emissão e do cancelamento de faturas.
8. Inclusão do valor total da reserva na resposta da emissão de fatura.
9. Configuração do Swagger com `@nestjs/swagger` compatível com NestJS 11.
10. Documentação dos endpoints, parâmetros e respostas HTTP.
11. Realização de testes positivos e negativos com Bruno e Swagger.
12. Integração HTTP dos endpoints com o API Gateway.
13. Criação do `NotificacoesModule` e do `NotificacoesService`.
14. Publicação dos cinco eventos de Pagamentos e Faturas no RabbitMQ.
15. Validação das publicações com logs do NestJS e painel RabbitMQ.
16. Implementação da aprovação simulada e do sexto evento (`pagamento.aprovado`).
17. Ampliação da emissão de faturas para TOTAL e SALDO.
18. Validação do DTO de faturamento e atualização do Swagger.
19. Configuração do RabbitMQ por variável de ambiente e publicação de mensagens persistentes.

## 11. Integrações e funcionalidades pendentes

### API Gateway e Reservas

O Gateway da versão original foi testado com Pagamentos e Faturas. No ambiente atual, ainda será validado o Gateway conjunto. A integração com Reservas deverá incluir o consumo do evento `pagamento.aprovado` e a atualização da reserva conforme suas regras de negócio. Mensagens antigas de teste não devem confirmar reservas indevidamente.

Após a definição do contrato de Reservas, o microserviço de Pagamentos deverá obter os dados necessários para validar os valores de SINAL, TOTAL e SALDO.

### Funcionalidades pendentes (não necessariamente serão implementadas)

- Integração com o microserviço de Reservas.
- Validação dos valores de pagamento com base nos dados reais da reserva.
- Integração com serviços extras.
- Processamento e aprovação ou recusa automática de pagamentos.
- Integração com provedores financeiros.
- Execução de estornos reais mediante confirmação do provedor.
- Prevenção de cobranças duplicadas.
- Obtenção automática do valor total da reserva para emissão da fatura.
- Persistência do valor total da reserva, caso seja necessária e autorizada uma alteração do banco.
- Implementação do consumidor de eventos RabbitMQ e do envio efetivo de notificações.
- Estratégia de retry, dead-letter queue, idempotência e confirmação de processamento das mensagens.
- Tratamento de consistência entre a gravação no MySQL e a publicação de eventos (por exemplo, padrão Outbox).
- Revisão das vulnerabilidades apontadas pelo `npm audit` antes de uso em produção.



## 12. Containerização com Docker

### Objetivo

O microserviço de Pagamentos foi preparado para execução em contêiner Docker, permitindo sua implantação de maneira padronizada e independente dos demais microserviços do Sistema de Gestão Hoteleira.

Cada microserviço do projeto possui seu próprio `Dockerfile` e `docker-compose.yml`. A integração entre os serviços será configurada posteriormente pela equipe.

### Tecnologias utilizadas

- Docker — execução da aplicação em contêiner.
- Docker Compose — configuração e gerenciamento do contêiner.
- Node.js 22 Alpine — imagem base.
- NestJS — framework da aplicação.
- Prisma ORM — acesso ao banco de dados.
- MySQL externo — persistência dos dados.

### Arquivos de configuração

| Arquivo | Finalidade |
|---|---|
| `Dockerfile` | Define como construir a imagem da aplicação. |
| `docker-compose.yml` | Configura o serviço, a porta e as variáveis de ambiente. |
| `.dockerignore` | Exclui arquivos desnecessários e sensíveis da imagem. |
| `.env` | Armazena as configurações de conexão com o banco de dados. |
| `package.json` | Define os scripts de compilação e execução. |

### Pré-requisitos

- Docker Desktop instalado e em execução, ou Docker Engine com Docker Compose.
- Acesso à rede do servidor MySQL.
- Arquivo `.env` configurado na raiz do projeto.
- Porta externa definida no `docker-compose.yml` disponível; no ambiente integrado atual, Pagamentos utiliza 3004 quando executado diretamente no host. O mapeamento do Compose ainda precisa ser revisado.

### Como executar com Docker

**1.** Acessar a pasta do microserviço.

**2.** Configurar o arquivo `.env` com as variáveis `DATABASE_URL`, `RABBITMQ_URL` e `PORT`, compatíveis com a rede e o mapeamento de portas do contêiner.

**3.** Construir a imagem e iniciar o contêiner:

```bash
docker compose up --build -d
```

**4.** Verificar se o contêiner está em execução:

```bash
docker compose ps
```

**5.** Consultar os logs da aplicação:

```bash
docker compose logs -f pagamentos
```

**6.** Acessar a documentação Swagger:

Acesse `http://localhost:PORTA_EXTERNA/api`, substituindo `PORTA_EXTERNA` pela porta publicada no `docker-compose.yml`.

**Nota:** a configuração de Docker Compose da aplicação ainda precisa ser revisada para acesso ao RabbitMQ a partir de contêineres.

### Comandos úteis

| Comando | Finalidade |
|---|---|
| `docker compose up --build -d` | Construir e iniciar o contêiner. |
| `docker compose up -d` | Iniciar utilizando a imagem existente. |
| `docker compose ps` | Verificar o estado do serviço. |
| `docker compose logs -f pagamentos` | Acompanhar os logs. |
| `docker compose restart pagamentos` | Reiniciar o serviço. |
| `docker compose down` | Parar e remover os contêineres do projeto. |

### Banco de dados

O microserviço utiliza um servidor MySQL externo. Por esse motivo, o Docker Compose não cria um contêiner de banco de dados.

A conexão é realizada por meio da variável de ambiente `DATABASE_URL`, configurada no arquivo `.env`.

O servidor deverá estar acessível pela rede utilizada na execução do contêiner.

### Situação da implementação

A configuração dos arquivos Docker foi preparada, e a aplicação NestJS foi compilada e executada com sucesso localmente em modo de produção.

**A construção da imagem e a execução do contêiner ainda não foram validadas.** Esses testes serão realizados no ambiente da faculdade, quando o Docker estiver disponível.

A integração HTTP com o API Gateway foi testada localmente. A orquestração conjunta de API Gateway, microserviço, RabbitMQ e demais serviços em Docker Compose ainda não foi validada.

## 13. Mensageria e notificações com RabbitMQ

### Arquitetura validada nesta etapa

```text
Cliente / PowerShell / Swagger
      | HTTP
      v
Microserviço de Pagamentos (localhost:3004)
      |-- Prisma ORM --> MySQL externo
      |
      `-- NotificacoesService --> RabbitMQ (localhost:5672)
                                    |
                                    `-- fila: notificacoes_pagamentos
                                         |
                                         `-- Consumidor de notificações (PENDENTE)
```

Nesta etapa, as requisições HTTP foram enviadas diretamente ao microserviço. Após operações persistidas com sucesso, os serviços de Pagamentos e Faturas chamam o `NotificacoesService` para publicar um evento. O RabbitMQ recebe a mensagem na fila durável `notificacoes_pagamentos`.

### Eventos publicados

| Evento | Origem | Quando é publicado |
|---|---|---|
| `pagamento.criado` | `PagamentoService.criarPagamento()` | Após criar o pagamento |
| `pagamento.aprovado` | `PagamentoService.aprovarPagamento()` | Após aprovar um pagamento pendente |
| `pagamento.cancelado` | `PagamentoService.cancelarPagamento()` | Após cancelar um pagamento pendente |
| `pagamento.estornado` | `PagamentoService.estornarPagamento()` | Após registrar o estorno simulado |
| `fatura.emitida` | `FaturaService.emitirFatura()` | Após emitir uma fatura válida |
| `fatura.cancelada` | `FaturaService.cancelarFatura()` | Após cancelar a fatura |

As validações de negócio permanecem nos respectivos `PagamentoValidatorService` e `FaturaValidatorService`. O módulo de notificações não determina se uma operação é permitida.

### Formato da mensagem

O método `publicarEvento(evento, dados)` envia um objeto com o nome do evento, os dados da operação e a data/hora da publicação. O transporte NestJS encapsula esse objeto nos campos `pattern` e `data`. Exemplo ilustrativo:

```json
{
  "pattern": "pagamento.criado",
  "data": {
    "evento": "pagamento.criado",
    "dados": {
      "pagamento_id": "550e8400-e29b-41d4-a716-446655440011",
      "reserva_id": "550e8400-e29b-41d4-a716-446655440010",
      "valor": "300",
      "tipo": "SINAL",
      "metodo": "CREDITO",
      "status": "PENDENTE"
    },
    "data_hora": "2026-11-22T22:00:00.000Z"
  }
}
```

Os identificadores e o horário acima são ilustrativos. Os valores reais são gerados durante a execução.

### Executar RabbitMQ localmente

É necessário ter Docker Desktop em execução. O exemplo abaixo cria um broker local e publica as portas somente na interface de loopback:

```bash
docker run -d --name rabbitmq-pagamentos -p 127.0.0.1:5672:5672 -p 127.0.0.1:15672:15672 -e RABBITMQ_DEFAULT_USER=pagamentos -e RABBITMQ_DEFAULT_PASS=SENHA_LOCAL_FORTE -v rabbitmq_pagamentos_data:/var/lib/rabbitmq rabbitmq:4-management
```

Defina no `.env` a variável `RABBITMQ_URL` com as credenciais escolhidas. Evite credenciais fixas no código-fonte. Para contêiner já criado, utilize `docker start rabbitmq-pagamentos` em vez de executar novamente `docker run`.

- **AMQP:** `localhost:5672`
- **Painel RabbitMQ Management:** `http://localhost:15672`
- **Fila:** `notificacoes_pagamentos`
- **Tipo:** classic; declaração durável (`durable: true`)
- **Novas mensagens:** persistentes (`persistent: true`, `delivery_mode: 2`).

A durabilidade da fila e a publicação persistente foram configuradas. A propriedade de persistência foi confirmada no painel, mas a recuperação após reinicialização do broker ainda não foi testada. Tratamento de falhas e confirmações de consumo permanecem pendentes.

### Verificar publicações

1. Inicie o RabbitMQ e o microserviço com `npm run start:dev`.
2. Confira o log `Conectado ao RabbitMQ com sucesso!`.
3. Execute uma operação válida diretamente na API (porta 3004), via PowerShell, Bruno ou Swagger.
4. Confira o log `Evento publicado: <nome-do-evento>`.
5. No painel RabbitMQ, acesse **Queues and Streams → notificacoes_pagamentos** para verificar mensagens aguardando consumo.

Os payloads dos seis tipos de eventos foram inspecionados no painel. Uma nova mensagem apresentou `delivery_mode: 2`. Para inspeção sem remoção, utilize Get messages com `Nack message requeue true`. Ainda não há consumidor integrado.

### Limitações e próximos passos

- **Não há consumidor implementado:** mensagens ficam na fila, mas não geram e-mail, WhatsApp ou notificação ao hóspede.
- **Consistência:** uma falha na publicação pode ocorrer depois da persistência no MySQL. O retorno HTTP pode indicar erro mesmo que a operação tenha sido gravada; considerar Outbox e tratamento de reprocessamento.
- **Confiabilidade:** implementar consumidor com confirmação manual (ack), retentativas, DLQ e idempotência.
- **Segurança:** utilizar credenciais de ambiente e restringir o acesso ao painel e ao broker.
- **Implantação:** validar a conectividade entre contêineres e revisar as URLs ao executar a aplicação via Docker Compose.


## 14. Considerações finais

O microserviço disponibiliza cadastro, listagem, aprovação simulada, cancelamento e estorno simulado de pagamentos, além de emissão e cancelamento de faturas. Os seis tipos de eventos foram validados no RabbitMQ. A integração com Reservas e a validação do Gateway conjunto permanecem pendentes.

A documentação interativa foi disponibilizada por meio do Swagger, permitindo consultar e testar os endpoints HTTP.

A separação entre Controllers, Services, Validators e NotificacoesService facilita a manutenção, a organização das regras de negócio e a comunicação assíncrona com outros componentes do sistema hoteleiro.

O projeto permanece em desenvolvimento acadêmico e **não realiza transações financeiras reais**.

## 15. Autoria e contribuições

Este microserviço foi desenvolvido no contexto da disciplina Projeto Integrador V, como parte de um sistema de reservas para hotelaria baseado em uma arquitetura de microsserviços.

### Desenvolvimento original

- Responsável: Eliakim (`eliakim-ads`).
- Repositório original: https://github.com/eliakim-ads/microservico_pagamentos
- Branch de referência: `branch_11202026`.

### Adaptação e integração

Responsável: Nilo (`NHyde1977`).

Principais contribuições realizadas durante a etapa de integração:

- Configuração de credenciais por meio de variáveis de ambiente.
- Implementação do endpoint de aprovação simulada de pagamentos.
- Revisão das validações de pagamentos e faturas.
- Configuração de filas duráveis e mensagens persistentes no RabbitMQ.
- Distribuição de eventos entre as filas `notificacoes_pagamentos` e `reservas_pagamentos`.
- Integração com o microserviço de Reservas.
- Execução de testes funcionais de integração.
- Revisão e atualização da documentação técnica.

### Histórico do repositório

Este repositório constitui uma cópia independente, destinada à integração acadêmica dos microsserviços. O histórico original não foi incorporado por razões de segurança, preservando-se os créditos do desenvolvimento original.

O repositório original permanece inalterado.

## 16. Atualização da integração — 24/11/2026

A integração entre Pagamentos e Reservas foi implementada utilizando comunicação síncrona via HTTP e assíncrona via RabbitMQ.

### Filas de mensageria

| Fila | Finalidade |
|---|---|
| `notificacoes_pagamentos` | Recebimento dos eventos de pagamentos e faturas. |
| `reservas_pagamentos` | Recebimento dos eventos de aprovação de pagamentos destinados a Reservas. |
| `reservas_pagamentos_dlq` | Armazenamento de mensagens rejeitadas pelo consumidor de Reservas. |

### Cenários de integração validados

- Confirmação automática de reservas mediante pagamento TOTAL (100%).
- Confirmação automática mediante pagamento SINAL (30%).
- Bloqueio de aprovações duplicadas.
- Tratamento de eventos duplicados pelo consumidor.
- Rejeição de pagamentos com valores incompatíveis.
- Proteção contra eventos de aprovação desatualizados.
- Armazenamento de mensagens durante a indisponibilidade do consumidor.
- Persistência de mensagem após reinicialização do RabbitMQ.
- Tratamento de mensagens inválidas e encaminhamento para DLQ.
- Reprocessamento manual de mensagens.

### Limitações atuais

- Ausência de integração com instituições financeiras reais.
- Ausência de consumidor integrado para a fila de Notificações.
- Ausência de retentativas automáticas de mensagens rejeitadas.
- Ausência do padrão Transactional Outbox.
- Cobertura limitada de testes unitários específicos de Pagamentos.
- Necessidade de validação financeira na origem do pagamento.
- Ausência de reconciliação automática de reservas confirmadas após estorno.
- Integração com o API Gateway ainda pendente.

Esta atualização substitui as informações anteriores sobre o estágio da integração com Reservas e RabbitMQ. Os testes de regressão após a centralização da confirmação financeira permanecem em andamento.
