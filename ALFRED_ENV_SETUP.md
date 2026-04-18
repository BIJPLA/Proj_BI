# Configuração das Variáveis de Ambiente — Alfred / Plataforma 360

## No Vercel (produção)

Vá em: **Vercel Dashboard → Seu Projeto → Settings → Environment Variables**

Adicione as variáveis abaixo. Os valores já estão em **base64** (ofuscação das credenciais):

| Variável | Valor (base64) | Representa |
|----------|----------------|------------|
| `_LH` | `MTYzLjE3Ni4yMzYuNTU=` | Host do servidor BI |
| `_LP` | `MzMwNw==` | Porta 3307 |
| `_LU` | *(gerar abaixo)* | Usuário do banco |
| `_LW` | *(gerar abaixo)* | Senha do banco |
| `_LD` | `bGFuZGFwcF9wcm9kdWN0aW9u` | landapp_production |
| `_LG` | *(gerar abaixo)* | Gemini API Key |

## Como gerar os valores base64

Abra o terminal e rode:

```bash
# Usuário
python3 -c "import base64; print(base64.b64encode(b'BIid9O5mqXff7Wmiqu').decode())"
# Resultado: QklpZDlPNW1xWGZmN1dtaXF1

# Senha
python3 -c "import base64; print(base64.b64encode('fB&dBU\",@oeP8\`\"v9r!ChdBx*vm6@w9B'.encode()).decode())"
# Resultado: ZkImZEJVIixAb2VQOGAidjlyIUNoZEJ4KnZtNkB3OUI=

# API Key Gemini (substitua pela chave COMPLETA)
python3 -c "import base64; print(base64.b64encode(b'SUA_CHAVE_GEMINI_COMPLETA_AQUI').decode())"
```

> ⚠️ **ATENÇÃO**: A API Key do Gemini no arquivo original está **truncada** (`AIzaSyDaQ5I`).
> Você precisa usar a chave **completa** (~39 caracteres), que começa com `AIzaSy...`
> Encontre a chave completa em: https://aistudio.google.com/app/apikey

## Para teste local

Crie um arquivo `.env` na raiz do projeto (nunca commite este arquivo):

```
_LH=MTYzLjE3Ni4yMzYuNTU=
_LP=MzMwNw==
_LU=QklpZDlPNW1xWGZmN1dtaXF1
_LW=ZkImZEJVIixAb2VQOGAidjlyIUNoZEJ4KnZtNkB3OUI=
_LD=bGFuZGFwcF9wcm9kdWN0aW9u
_LG=<base64_da_sua_chave_gemini_completa>
```

Depois rode localmente com: `vercel dev`
