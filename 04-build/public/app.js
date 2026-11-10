/**
 * Farayzin Planner Studio — Frontend Core Engine
 * Automação, Roteiro com Tags, Personagens Consistentes e SRT Sync
 */

// ESTADO GLOBAL DA APLICAÇÃO
const state = {
  currentProject: {
    id: 'proj_default',
    name: 'Mistérios da Meia-Noite #01',
    niche: 'curiosidades',
    rawScript: '',
    scenes: [],
    characters: [
      {
        id: 'char_1',
        name: 'Detetive Viktor',
        desc: 'Homem de 40 anos, sobretudo de couro escuro, chapéu fedora clássico, olhos atentos, semblante sério e fumaça de cigarro ao redor',
        style: 'Dark noir aesthetic, cinematic lighting, hyperdetailed 8k, moody photorealistic'
      }
    ],
    audioUrl: null,
    audioDuration: 0,
    srtItems: []
  },
  projectsList: [],
  voices: []
};

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupEventListeners();
  checkServerHealth();
  initTTSVoices();
  loadProjectsFromStorage();
  renderProjectUI();
});

// NAVEGAÇÃO POR ABAS
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
      });
      const activePane = document.getElementById(`tab-${targetTab}`);
      if (activePane) activePane.classList.add('active');

      if (targetTab === 'srtsync') {
        renderTimeline();
      }
    });
  });
}

// CONFIGURAR EVENT LISTENERS
function setupEventListeners() {
  // Roteiro
  document.getElementById('btnProcessScript').addEventListener('click', processScriptIntoScenes);
  document.getElementById('btnGenerateBatchPrompts').addEventListener('click', copyAllPrompts);

  // Projetos
  document.getElementById('btnSaveProject').addEventListener('click', saveActiveProject);
  document.getElementById('btnNewProjectModal').addEventListener('click', openNewProjectModal);
  document.getElementById('btnConfirmCreateProject').addEventListener('click', createNewProject);

  // Personagens
  document.getElementById('btnSaveCharacter').addEventListener('click', saveNewCharacter);

  // SRT & Áudio Sync
  document.getElementById('srtFileInput').addEventListener('change', handleSrtUpload);
  document.getElementById('audioFileInput').addEventListener('change', handleAudioUpload);
  document.getElementById('btnAutoSync').addEventListener('click', autoSyncScenesWithSrt);

  // Player de Áudio & Timeline
  const audioPlayer = document.getElementById('globalAudioPlayer');
  const playBtn = document.getElementById('btnPlayPause');
  const seekBar = document.getElementById('seekBar');

  playBtn.addEventListener('click', () => {
    if (audioPlayer.paused) {
      audioPlayer.play();
      playBtn.textContent = '⏸';
    } else {
      audioPlayer.pause();
      playBtn.textContent = '▶';
    }
  });

  audioPlayer.addEventListener('timeupdate', () => {
    if (audioPlayer.duration) {
      seekBar.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
      updateTimeDisplay(audioPlayer.currentTime, audioPlayer.duration);
      updateSubtitleOverlay(audioPlayer.currentTime);
    }
  });

  seekBar.addEventListener('input', () => {
    if (audioPlayer.duration) {
      audioPlayer.currentTime = (seekBar.value / 100) * audioPlayer.duration;
    }
  });

  // TTS Offline
  document.getElementById('btnGenerateOfflineTTS').addEventListener('click', narrateOfflineTTS);

  // Exportação
  document.getElementById('btnExportCapCut').addEventListener('click', exportToCapCut);
  document.getElementById('btnRenderMP4').addEventListener('click', renderMP4Video);
}

// VERIFICAÇÃO DO SERVIDOR LOCAL
async function checkServerHealth() {
  const indicator = document.getElementById('serverStatusIndicator');
  const statusText = document.getElementById('serverStatusText');
  const ffmpegText = document.getElementById('ffmpegStatusText');

  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      indicator.className = 'status-indicator online';
      statusText.textContent = 'Conectado (Porta ' + data.port + ')';
      ffmpegText.textContent = 'FFmpeg Pronto';
    } else {
      throw new Error('Falha');
    }
  } catch (err) {
    indicator.className = 'status-indicator';
    statusText.textContent = 'Modo Local Offline';
    ffmpegText.textContent = 'Sem Servidor Node';
  }
}

// INICIALIZAR VOZES OFFLINE DO NAVEGADOR (WEB SPEECH API)
function initTTSVoices() {
  const voiceSelect = document.getElementById('ttsVoiceSelect');
  function populate() {
    if (!('speechSynthesis' in window)) return;
    state.voices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('pt') || v.lang.startsWith('en'));
    voiceSelect.innerHTML = '';
    state.voices.forEach((v, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${v.name} (${v.lang})`;
      voiceSelect.appendChild(opt);
    });
  }
  populate();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populate;
  }
}

// CARREGAR E RENDERIZAR PROJETO
function renderProjectUI() {
  document.getElementById('activeProjectTitle').textContent = state.currentProject.name;
  document.getElementById('scriptInput').value = state.currentProject.rawScript || '';
  renderScenesCards();
  renderCharactersList();
  renderSyncSummary();
}

// PROCESSAR ROTEIRO EM CENAS COM TAGS
function processScriptIntoScenes() {
  const text = document.getElementById('scriptInput').value.trim();
  if (!text) {
    alert('Digite ou cole um roteiro antes de dividir em cenas!');
    return;
  }
  state.currentProject.rawScript = text;

  // Dividir por parágrafos duplos ou linhas que começam com tags
  const rawBlocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const newScenes = [];

  rawBlocks.forEach((block, idx) => {
    let type = 'imagem'; // padrão
    if (block.includes('[v]')) type = 'video';
    if (block.includes('[i]')) type = 'imagem';

    // Extrair personagem [p:Nome]
    let characterName = null;
    const charMatch = block.match(/\[p:([^\]]+)\]/i);
    if (charMatch) {
      characterName = charMatch[1].trim();
    }

    // Extrair locutor [voz:Nome]
    let voiceActor = 'Narrador Principal';
    const voiceMatch = block.match(/\[voz:([^\]]+)\]/i);
    if (voiceMatch) {
      voiceActor = voiceMatch[1].trim();
    }

    // Limpar tags do texto da cena
    const cleanText = block.replace(/\[i\]/gi, '')
                           .replace(/\[v\]/gi, '')
                           .replace(/\[p:[^\]]+\]/gi, '')
                           .replace(/\[voz:[^\]]+\]/gi, '')
                           .trim();

    // Montar prompt otimizado para IA
    let promptIa = `${type === 'video' ? 'Cinematic video shot of' : 'Detailed cinematic photo of'}: ${cleanText}`;
    
    // Injetar consistência de personagem se houver
    if (characterName) {
      const foundChar = state.currentProject.characters.find(c => c.name.toLowerCase() === characterName.toLowerCase());
      if (foundChar) {
        promptIa += ` | Character: ${foundChar.name}, ${foundChar.desc} | Style: ${foundChar.style}`;
      } else {
        promptIa += ` | Character: ${characterName}`;
      }
    }

    newScenes.push({
      id: 'sc_' + (idx + 1),
      index: idx + 1,
      type,
      text: cleanText,
      character: characterName,
      voiceActor,
      prompt: promptIa,
      duration: 4, // duração padrão 4s antes do SRT
      start: idx * 4,
      end: (idx + 1) * 4,
      mediaUrl: null
    });
  });

  state.currentProject.scenes = newScenes;
  renderScenesCards();
  renderTimeline();
  renderSyncSummary();
  saveActiveProject();
}

// RENDERIZAR CARDS DE CENAS
function renderScenesCards() {
  const container = document.getElementById('scenesCardsContainer');
  const countLabel = document.getElementById('sceneCountLabel');
  container.innerHTML = '';
  countLabel.textContent = state.currentProject.scenes.length;

  if (state.currentProject.scenes.length === 0) {
    container.innerHTML = '<div class="empty-state">Escreva um roteiro e clique em "Dividir em Cenas" para gerar a estrutura.</div>';
    return;
  }

  state.currentProject.scenes.forEach(sc => {
    const card = document.createElement('div');
    card.className = 'scene-card-item';
    card.innerHTML = `
      <div class="scene-card-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="scene-index-badge">#${sc.index}</span>
          <span class="scene-type-tag ${sc.type === 'video' ? 'video' : 'image'}">${sc.type.toUpperCase()}</span>
          ${sc.character ? `<span class="tag-pill">👤 ${sc.character}</span>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <small style="color:var(--text-dim);">${sc.duration.toFixed(1)}s</small>
          <label class="btn-sm btn-secondary" style="cursor:pointer;">
            🖼️ Mídia
            <input type="file" accept="image/*,video/*" style="display:none;" onchange="uploadSceneMedia('${sc.id}', this)">
          </label>
        </div>
      </div>
      <div class="scene-text-content">${sc.text}</div>
      <div class="scene-prompt-box">
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:85%;">${sc.prompt}</span>
        <button class="btn-copy-prompt" onclick="copyText('${escapeQuotes(sc.prompt)}')">Copiar</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// INSERIR TAGS NO EDITOR
function insertTag(tag) {
  const textarea = document.getElementById('scriptInput');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  textarea.value = text.substring(0, start) + tag + ' ' + text.substring(end);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + tag.length + 1;
}

// COPIAR TODOS OS PROMPTS EM LOTE
function copyAllPrompts() {
  if (state.currentProject.scenes.length === 0) {
    alert('Nenhuma cena gerada para copiar prompts!');
    return;
  }
  const allPrompts = state.currentProject.scenes.map(s => `[Cena ${s.index} - ${s.type.toUpperCase()}]\n${s.prompt}\n`).join('\n');
  navigator.clipboard.writeText(allPrompts).then(() => {
    alert('✅ Todos os prompts foram copiados para a área de transferência!');
  });
}

// UPLOAD DE MÍDIA DA CENA
async function uploadSceneMedia(sceneId, input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      const sc = state.currentProject.scenes.find(s => s.id === sceneId);
      if (sc) {
        sc.mediaUrl = data.url;
        alert(`Mídia enviada com sucesso para a Cena ${sc.index}!`);
        renderScenesCards();
        renderTimeline();
        saveActiveProject();
      }
    } else {
      // Fallback local caso offline sem servidor
      const localUrl = URL.createObjectURL(file);
      const sc = state.currentProject.scenes.find(s => s.id === sceneId);
      if (sc) {
        sc.mediaUrl = localUrl;
        renderScenesCards();
        renderTimeline();
      }
    }
  } catch (err) {
    const localUrl = URL.createObjectURL(file);
    const sc = state.currentProject.scenes.find(s => s.id === sceneId);
    if (sc) {
      sc.mediaUrl = localUrl;
      renderScenesCards();
      renderTimeline();
    }
  }
}

// GERENCIADOR DE PERSONAGENS
function renderCharactersList() {
  const container = document.getElementById('charactersListContainer');
  container.innerHTML = '';
  state.currentProject.characters.forEach(char => {
    const card = document.createElement('div');
    card.className = 'character-card';
    card.innerHTML = `
      <h3>🎭 ${char.name}</h3>
      <p class="char-desc">${char.desc}</p>
      <div class="char-style">Estilo: ${char.style}</div>
      <button class="btn btn-secondary btn-sm" onclick="deleteCharacter('${char.id}')">Excluir</button>
    `;
    container.appendChild(card);
  });
}

function openNewCharacterModal() {
  document.getElementById('modalNewCharacter').classList.add('active');
}

function saveNewCharacter() {
  const name = document.getElementById('charNameInput').value.trim();
  const desc = document.getElementById('charPromptInput').value.trim();
  const style = document.getElementById('charStyleInput').value.trim();

  if (!name || !desc) {
    alert('Preencha pelo menos o nome e a descrição do personagem!');
    return;
  }

  state.currentProject.characters.push({
    id: 'char_' + Date.now(),
    name,
    desc,
    style: style || 'Cinematic, 8k, photorealistic'
  });

  closeModal('modalNewCharacter');
  renderCharactersList();
  saveActiveProject();
}

function deleteCharacter(id) {
  state.currentProject.characters = state.currentProject.characters.filter(c => c.id !== id);
  renderCharactersList();
  saveActiveProject();
}

// UPLOAD E PARSER DE SRT
function handleSrtUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    const text = evt.target.result;
    // Tentar via API do servidor
    try {
      const res = await fetch('/api/parse-srt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ srtContent: text })
      });
      if (res.ok) {
        const data = await res.json();
        state.currentProject.srtItems = data.items;
      } else {
        parseSrtClientSide(text);
      }
    } catch (err) {
      parseSrtClientSide(text);
    }
    renderSyncSummary();
    renderTimeline();
    alert(`Arquivo SRT importado! Total de ${state.currentProject.srtItems.length} blocos de legenda.`);
  };
  reader.readAsText(file);
}

// PARSER SRT NO NAVEGADOR (OFFLINE FALLBACK)
function parseSrtClientSide(text) {
  const blocks = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n\n');
  const items = [];
  blocks.forEach(block => {
    const lines = block.split('\n');
    const timeIdx = lines[0].includes('-->') ? 0 : 1;
    if (lines[timeIdx] && lines[timeIdx].includes('-->')) {
      const [startStr, endStr] = lines[timeIdx].split('-->').map(s => s.trim());
      const content = lines.slice(timeIdx + 1).join(' ').trim();
      function toSec(s) {
        const parts = s.replace(',', '.').split(':');
        return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
      }
      const start = toSec(startStr);
      const end = toSec(endStr);
      items.push({
        index: items.length + 1,
        start,
        end,
        duration: Math.max(0.1, end - start),
        text: content
      });
    }
  });
  state.currentProject.srtItems = items;
}

// UPLOAD DE ÁUDIO
function handleAudioUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const audioUrl = URL.createObjectURL(file);
  state.currentProject.audioUrl = audioUrl;

  const audioPlayer = document.getElementById('globalAudioPlayer');
  audioPlayer.src = audioUrl;
  audioPlayer.onloadedmetadata = () => {
    state.currentProject.audioDuration = audioPlayer.duration;
    renderSyncSummary();
    renderTimeline();
  };
}

// SINCRONIZADOR AUTOMÁTICO (SRT SYNC ENGINE)
function autoSyncScenesWithSrt() {
  if (state.currentProject.scenes.length === 0) {
    alert('Divida seu roteiro em cenas primeiro!');
    return;
  }
  if (!state.currentProject.srtItems || state.currentProject.srtItems.length === 0) {
    alert('Importe um arquivo .SRT para realizar a sincronização automática!');
    return;
  }

  const srtCount = state.currentProject.srtItems.length;
  const sceneCount = state.currentProject.scenes.length;

  // Se o número for idêntico, 1 para 1
  if (srtCount === sceneCount) {
    state.currentProject.scenes.forEach((sc, i) => {
      const srt = state.currentProject.srtItems[i];
      sc.start = srt.start;
      sc.end = srt.end;
      sc.duration = srt.duration;
    });
  } else {
    // Agrupar blocos SRT proporcionalmente às cenas
    const ratio = srtCount / sceneCount;
    state.currentProject.scenes.forEach((sc, i) => {
      const startIdx = Math.floor(i * ratio);
      const endIdx = Math.min(srtCount - 1, Math.floor((i + 1) * ratio) - 1);
      const startSrt = state.currentProject.srtItems[startIdx];
      const endSrt = state.currentProject.srtItems[Math.max(startIdx, endIdx)];

      sc.start = startSrt.start;
      sc.end = endSrt.end;
      sc.duration = Math.max(0.5, endSrt.end - startSrt.start);
    });
  }

  renderScenesCards();
  renderTimeline();
  renderSyncSummary();
  saveActiveProject();
  alert('⚡ Sincronização concluída com sucesso! Os cortes foram ajustados aos tempos exatos da fala.');
}

// RENDERIZAR TIMELINE
function renderTimeline() {
  const videoTrack = document.getElementById('timelineVideoTrack');
  const subTrack = document.getElementById('timelineSubtitleTrack');
  videoTrack.innerHTML = '';
  subTrack.innerHTML = '';

  const scenes = state.currentProject.scenes;
  if (scenes.length === 0) return;

  // Calcular largura proporcional
  const totalDuration = scenes.reduce((acc, s) => acc + s.duration, 0) || 30;

  scenes.forEach(sc => {
    const widthPct = Math.max(2, (sc.duration / totalDuration) * 100);
    const block = document.createElement('div');
    block.className = 'timeline-block';
    block.style.width = `${widthPct}%`;
    block.innerHTML = `<span>#${sc.index} ${sc.character || sc.type}</span><small>${sc.duration.toFixed(1)}s</small>`;
    block.onclick = () => previewScene(sc);
    videoTrack.appendChild(block);
  });

  // Blocos SRT
  if (state.currentProject.srtItems && state.currentProject.srtItems.length > 0) {
    state.currentProject.srtItems.forEach(item => {
      const widthPct = Math.max(1, (item.duration / totalDuration) * 100);
      const block = document.createElement('div');
      block.className = 'timeline-block srt-block';
      block.style.width = `${widthPct}%`;
      block.innerHTML = `<span>${item.text}</span>`;
      subTrack.appendChild(block);
    });
  }
}

// PREVIEW DA CENA
function previewScene(sc) {
  const placeholder = document.getElementById('previewPlaceholder');
  const previewImg = document.getElementById('previewImage');
  const overlay = document.getElementById('previewSubtitleOverlay');

  if (sc.mediaUrl) {
    placeholder.style.display = 'none';
    previewImg.style.display = 'block';
    previewImg.src = sc.mediaUrl;
  } else {
    placeholder.style.display = 'flex';
    previewImg.style.display = 'none';
  }
  overlay.style.display = 'block';
  overlay.textContent = sc.text;
}

// ATUALIZAR LEGENDA NO PLAYER
function updateSubtitleOverlay(currentTime) {
  const overlay = document.getElementById('previewSubtitleOverlay');
  if (!state.currentProject.srtItems) return;
  const currentSub = state.currentProject.srtItems.find(s => currentTime >= s.start && currentTime <= s.end);
  if (currentSub) {
    overlay.style.display = 'block';
    overlay.textContent = currentSub.text;
  } else {
    overlay.style.display = 'none';
  }
}

// NARRAR COM VOZ OFFLINE (WEB SPEECH)
function narrateOfflineTTS() {
  if (!('speechSynthesis' in window)) {
    alert('Seu navegador não suporta síntese de voz nativa.');
    return;
  }
  if (state.currentProject.scenes.length === 0) {
    alert('Nenhuma cena para narrar!');
    return;
  }

  const voiceSelect = document.getElementById('ttsVoiceSelect');
  const selectedVoice = state.voices[voiceSelect.value];

  window.speechSynthesis.cancel();
  state.currentProject.scenes.forEach(sc => {
    const utterance = new SpeechSynthesisUtterance(sc.text);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  });
  alert('🎙️ Narrando o roteiro com a voz nativa selecionada!');
}

// EXPORTAR PARA CAPCUT
async function exportToCapCut() {
  if (state.currentProject.scenes.length === 0) {
    alert('Crie e sincronize as cenas do seu projeto antes de exportar!');
    return;
  }

  try {
    const res = await fetch('/api/export-capcut', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: state.currentProject })
    });
    const data = await res.json();
    if (data.success) {
      alert(`🎉 Pacote para CapCut Desktop gerado com sucesso!\nPasta: ${data.exportPath}`);
    } else {
      alert('Erro ao exportar para CapCut: ' + data.error);
    }
  } catch (err) {
    // Fallback: download de json no navegador
    const blob = new Blob([JSON.stringify(state.currentProject, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CapCut_${state.currentProject.name}.json`;
    a.click();
    alert('Exportado arquivo de sincronização para CapCut via navegador!');
  }
}

// RENDERIZAR VÍDEO MP4 COM FFMPEG
async function renderMP4Video() {
  if (state.currentProject.scenes.length === 0) {
    alert('Adicione cenas e mídias antes de renderizar!');
    return;
  }

  const progressArea = document.getElementById('renderProgressArea');
  const progressBar = document.getElementById('renderProgressBar');
  const statusMsg = document.getElementById('renderStatusMessage');
  const downloadBox = document.getElementById('renderDownloadBox');
  const downloadBtn = document.getElementById('renderDownloadBtn');

  progressArea.style.display = 'block';
  downloadBox.style.display = 'none';
  progressBar.style.width = '20%';
  statusMsg.textContent = 'Enviando instruções para o motor FFmpeg...';

  try {
    progressBar.style.width = '50%';
    statusMsg.textContent = 'Renderizando vídeo em 1080p Full HD com aceleração Intel QSV...';

    const res = await fetch('/api/render-mp4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: state.currentProject })
    });

    const data = await res.json();
    if (data.success) {
      progressBar.style.width = '100%';
      statusMsg.textContent = '✅ Vídeo MP4 renderizado com sucesso!';
      downloadBox.style.display = 'block';
      downloadBtn.href = data.downloadUrl;
    } else {
      statusMsg.textContent = '❌ Erro na renderização: ' + data.error;
    }
  } catch (err) {
    statusMsg.textContent = '❌ Falha ao conectar ao servidor de renderização FFmpeg.';
  }
}

// PROJETOS (PERSISTÊNCIA & MODAL)
function openNewProjectModal() {
  document.getElementById('modalNewProject').classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function createNewProject() {
  const name = document.getElementById('newProjectName').value.trim();
  const niche = document.getElementById('newProjectNiche').value;
  if (!name) {
    alert('Digite um nome para o projeto!');
    return;
  }

  state.currentProject = {
    id: 'proj_' + Date.now(),
    name,
    niche,
    rawScript: '',
    scenes: [],
    characters: [...state.currentProject.characters],
    audioUrl: null,
    audioDuration: 0,
    srtItems: []
  };

  closeModal('modalNewProject');
  renderProjectUI();
  saveActiveProject();
}

function saveActiveProject() {
  localStorage.setItem('farayzin_active_project', JSON.stringify(state.currentProject));
  fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state.currentProject)
  }).catch(() => {});
}

function loadProjectsFromStorage() {
  const saved = localStorage.getItem('farayzin_active_project');
  if (saved) {
    try {
      state.currentProject = JSON.parse(saved);
    } catch (e) {}
  }
}

function renderSyncSummary() {
  const scenes = state.currentProject.scenes || [];
  const totalSec = scenes.reduce((acc, s) => acc + (s.duration || 0), 0);
  document.getElementById('summaryDuration').textContent = `${totalSec.toFixed(1)} segundos`;
  document.getElementById('summarySceneCount').textContent = scenes.length;
  document.getElementById('summaryAudioStatus').textContent = state.currentProject.audioUrl ? 'Carregado' : 'Nenhum';
  document.getElementById('summarySrtStatus').textContent = (state.currentProject.srtItems && state.currentProject.srtItems.length) ? `${state.currentProject.srtItems.length} blocos` : 'Nenhum';
}

function updateTimeDisplay(current, duration) {
  function fmt(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  document.getElementById('timeDisplay').textContent = `${fmt(current)} / ${fmt(duration)}`;
}

function escapeQuotes(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function copyText(str) {
  navigator.clipboard.writeText(str).then(() => {
    alert('Copiado para a área de transferência!');
  });
}

