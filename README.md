# Farayzin Planner Studio ⚡

> **Clone 100% Offline do DarkPlanner Studio** — Plataforma completa de automação, roteirização com tags, personagens consistentes, sincronização inteligente de legendas SRT com mídias e exportação para CapCut Desktop e renderização MP4 via FFmpeg.

---

## 🌟 Principais Recursos

1. **Dashboard de Projetos:**
   - Criação e salvamento de múltiplos projetos de canais dark categorizados por nichos.
2. **Editor de Roteiro com Tags Inteligentes:**
   - Divisão automática de texto em blocos de cena.
   - Suporte a tags:
     - `[i]` Cena de Imagem
     - `[v]` Cena de Vídeo
     - `[p:Nome]` Personagem Consistente
     - `[voz:Locutor]` Identificação de voz/diálogo
   - Geração de prompts em lote (batch prompts) prontos para colar em geradores como Google Veo, Leonardo ou Midjourney.
3. **Módulo de Personagens Consistentes (Ingredientes):**
   - Criação de perfis de personagens com características físicas, fisionomia e estilo artístico fixados.
   - Injeção automática das características em cada cena onde o personagem aparece.
4. **Sincronizador Automático SRT & Áudio:**
   - Importação de arquivos `.srt` e áudio `.mp3`/`.wav`.
   - Ajuste milissegundo a milissegundo das cenas com os blocos de legenda da fala.
   - Narração offline nativa (Web Speech API) sem precisar de internet ou chave de API.
   - Player com monitor de vídeo, visualizador de legendas e timeline multitrack interativa.
5. **Exportação & Renderização:**
   - **Export para CapCut Desktop:** Gera uma pasta estruturada com arquivos numerados e script `sincronizacao.json` para encaixe perfeito na linha do tempo.
   - **Renderizador MP4 Direto:** Renderiza o vídeo final Full HD 1080p localmente usando o motor FFmpeg com aceleração por hardware (Intel Iris Xe).

---

## 🚀 Como Executar

Dê um duplo clique no arquivo:
```
Iniciar Farayzin Planner.bat
```
Ele iniciará o servidor na porta **4050** e abrirá automaticamente seu navegador em `http://localhost:4050`.

Para encerrar o serviço:
```
Parar Farayzin Planner.bat
```

