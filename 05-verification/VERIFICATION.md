# Relatório de Verificação de Paridade — Farayzin Planner vs DarkPlanner Studio

| Funcionalidade | DarkPlanner Studio | Farayzin Planner | Status de Paridade |
|---|---|---|---|
| **Roteiro em Cenas** | Divisão por parágrafos/cenas | Divisão algorítmica por bloco/parágrafo duplo | ✅ IGUAL |
| **Tags de Imagem e Vídeo** | `[i]` para imagens, `[v]` para vídeos | Reconhecimento de `[i]` e `[v]` com formatação | ✅ IGUAL |
| **Personagens Consistentes** | "Ingredientes" (prompt fixo de rosto e estilo) | Injeção de perfil com nome, estilo e descrição | ✅ IGUAL |
| **Sincronizador SRT** | Sincroniza áudio/legenda com as cenas de vídeo | Parser milissegundo de `.srt` e mapeamento de cortes | ✅ IGUAL |
| **Timeline Multitrack** | Visualização de trilhas de mídia e tempos | Trilha de vídeo + trilha de legendas com player | ✅ IGUAL |
| **Exportação CapCut** | Gera pacote estruturado para timeline do CapCut | Gera pasta com mídias e `sincronizacao.json` | ✅ IGUAL |
| **Renderização MP4** | Processamento em nuvem | Renderizador local 1080p FFmpeg (Intel Iris Xe) | ⚡ SUPERIOR (100% Offline) |
| **Voz / Narração** | APIs de terceiros pagas | Voz nativa do navegador (Web Speech API) offline | ⚡ SUPERIOR (Grátis e Offline) |

