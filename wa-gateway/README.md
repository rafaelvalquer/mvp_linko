# wa-gateway

Microservico privado para transporte do WhatsApp via `whatsapp-web.js`.

O `server` continua sendo o dono da regra de negocio. O `wa-gateway` cuida de:
- sessao do WhatsApp
- QR e reconexao
- envio de mensagens
- inbound forward para o `server`
- telemetria, eventos recentes e metricas basicas

## Requisitos
- Node.js LTS
- Google Chrome instalado

## Instalacao
```bash
cd wa-gateway
npm i
copy .env.example .env
```

## Variaveis principais
- `WA_ADMIN_API_KEY`: protege `/status`, `/metrics`, `/events/recent` e `/restart`
- `WA_SEND_API_KEY`: protege `/send`
- `WA_API_KEY`: fallback legacy para os dois casos acima
- `WA_SESSION_PATH`: pasta persistente do `LocalAuth`
- `WA_CHROME_PATH`: caminho do Chrome
- `SERVER_INTERNAL_WEBHOOK_URL`: base do `server`
- `SERVER_INTERNAL_WEBHOOK_KEY`: chave do webhook interno
- `WA_INBOUND_TYPING_ENABLED=true`: mostra "digitando" no inbound do agente
- `WA_SENSITIVE_IP_ALLOWLIST=loopback`: restringe acessos administrativos por IP
- `WA_QR_PUBLIC=false`: recomendado em producao

## Executar
```bash
npm start
```

## Scripts uteis
```bash
npm run lint
npm test
npm run smoke
```

`npm run smoke` usa:
- `WA_SMOKE_BASE_URL` opcional, default `http://127.0.0.1:3010`
- `WA_SMOKE_ADMIN_KEY` opcional, com fallback para `WA_ADMIN_API_KEY` ou `WA_API_KEY`

## Endpoints
- `GET /health`
- `GET /status`
- `GET /metrics`
- `GET /events/recent`
- `GET /qr`
- `POST /restart`
- `POST /send`

## /send
Exemplo basico:
```bash
curl -X POST http://localhost:3010/send ^
  -H "content-type: application/json" ^
  -H "x-api-key: change-me" ^
  -d "{ \"to\":\"11999999999\", \"message\":\"Pagamento confirmado\" }"
```

Tambem aceita midia opcional:
- `mediaBase64`
- `mediaMimeType`
- `mediaFileName`

## Observabilidade
- `/status` expoe:
  - estado atual
  - `waSessionState`
  - reconexao
  - latencia de forward inbound
  - watchdog
  - dedupe em memoria
  - telemetria agregada
- `/events/recent` retorna o buffer curto de eventos estruturados
- `/metrics` retorna metricas simples em formato texto

## Runbooks
### QR nao aparece
- confira `/status`
- valide `chromePathResolved` e `chromePathExists`
- se o estado ficar `CHROME_MISSING`, ajuste `WA_CHROME_PATH`
- se estiver em producao, cheque se `/qr` esta privado e se o IP esta liberado

### READY mas nao envia
- confira se `/send` esta usando `WA_SEND_API_KEY`
- valide `waReady=true` em `/status`
- veja `/events/recent` para `send_failed` ou `message_ack`

### LID unresolved
- verifique `/events/recent` para `inbound_lid_lookup_failed`
- confira se o contato esta acessivel no WhatsApp pareado
- se o numero nao resolver, o inbound sera descartado antes do forward

### timeout no inbound
- confira `forwardDegraded` e `lastForwardError` em `/status`
- veja a latencia de `wa_inbound_forward_duration`
- valide `SERVER_INTERNAL_WEBHOOK_URL`, chave interna e disponibilidade do `server`

### sessao corrompida
- use `POST /restart`
- se necessario, limpe a pasta `WA_SESSION_PATH` e refaca o pareamento
- mantenha a sessao fora do repositorio e fora de pastas sincronizadas

## Observacoes
- Em producao, prefira `WA_QR_PUBLIC=false`.
- O gateway continua privado; nao exponha publicamente sem proxy/TLS e restricoes.
- O indicador de digitacao vale apenas para o inbound do agente.
