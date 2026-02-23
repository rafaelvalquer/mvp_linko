# wa-gateway (MVP)

Microserviço local (sem Docker) para envio de notificações via WhatsApp usando `whatsapp-web.js`.

## Requisitos
- Node.js LTS
- Google Chrome/Chromium instalado (ou deixar o Puppeteer baixar o Chromium)

## Instalação
```bash
cd wa-gateway
npm i
cp .env.example .env
```

Edite `.env` e defina pelo menos:
- `WA_API_KEY` (obrigatório para proteger /status e /send)
- `WA_PORT` (default 3010)
- `WA_SESSION_PATH` (default `./wa-session`)

## Executar
```bash
npm run dev
```

Ao iniciar:
- O QR Code aparece no console.
- Escaneie no WhatsApp: **Dispositivos conectados**.
- Após conectar, verá: `WhatsApp READY: <numero>`.

## Testar status
```bash
curl -H "x-api-key: change-me" http://localhost:3010/status
```

## Enviar mensagem
```bash
curl -X POST http://localhost:3010/send \
  -H "content-type: application/json" \
  -H "x-api-key: change-me" \
  -d '{ "to":"11999999999", "message":"Pagamento confirmado ✅" }'
```

## Observações
- A sessão é persistida em `WA_SESSION_PATH` via `LocalAuth` (não apague `wa-session/`).
- **Não exponha** esse serviço publicamente (MVP local).
- Em Windows, se houver erros do Puppeteer, tente:
  - rodar terminal como Admin
  - definir `WA_PUPPETEER_EXECUTABLE_PATH` apontando para o Chrome instalado
