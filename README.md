# Alfred conectado ao banco `landapp_production` 🕵🏼

Projeto pronto para rodar a plataforma com um backend Node.js que:

- conecta no MySQL `163.176.236.55:3307`
- lê o esquema do banco automaticamente
- transforma perguntas em SQL com IA
- executa a consulta com segurança (somente SELECT)
- devolve a resposta em português no Alfred da própria tela

## O que foi adicionado

- `server.js` → sobe frontend + API no mesmo projeto
- `backend/` → conexão MySQL, leitura de schema, geração segura de SQL e resposta com IA
- `alfred.js` → frontend atualizado para chamar o backend
- `.env.example` e `.env` → configuração centralizada
- `package.json` → dependências e scripts de execução

## Como rodar

### 1) Instalar dependências

```bash
npm install
```

### 2) Preencher o `.env`

Os campos abaixo já vieram pré-configurados:

- `DB_HOST=163.176.236.55`
- `DB_PORT=3307`
- `DB_NAME=landapp_production`

Você só precisa completar:

- `DB_USER`
- `DB_PASSWORD`
- `GEMINI_API_KEY`

### 3) Iniciar

```bash
npm start
```

Abrir no navegador:

```txt
http://localhost:3000
```

## Endpoint principal

### `POST /api/alfred/ask`

Payload:

```json
{
  "question": "qual o principal destino no mês de janeiro?",
  "portalContext": {}
}
```

## Endpoint de saúde

### `GET /api/health`

Retorna se o backend está de pé, se o banco conectou e quais variáveis ainda faltam.

## Comportamento do Alfred

Exemplos de perguntas:

- Qual o principal destino no mês de janeiro?
- Qual cliente teve mais viagens no último mês?
- Qual obra teve maior volume esse mês?
- Me traz os 10 principais destinos por quantidade.
- Qual transportadora mais apareceu em fevereiro?

## Segurança aplicada

- bloqueia comandos que não sejam `SELECT` / `WITH ... SELECT`
- bloqueia múltiplas instruções
- bloqueia palavras perigosas como `DROP`, `DELETE`, `UPDATE`, `ALTER`
- limita o total de linhas retornadas
- usa schema real do banco para reduzir alucinação

## Observação importante

Eu não consegui validar a conexão real daqui porque faltam as credenciais finais do banco (`DB_USER` e `DB_PASSWORD`) e a chave da IA (`GEMINI_API_KEY`). A estrutura já está pronta — é literalmente preencher isso e ligar o motor 😎
