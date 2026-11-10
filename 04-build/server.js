const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 4050;

// Pastas de dados
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
const EXPORT_DIR = path.join(DATA_DIR, 'exports');

[DATA_DIR, UPLOAD_DIR, PROJECTS_DIR, EXPORT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Caminho do FFmpeg
const FFMPEG_CANDIDATES = [
  path.join(__dirname, '..', '..', 'AutoEditor', 'ffmpeg.exe'),
  'C:\\Users\\ADILSON\\Desktop\\Aplicativos para uso de trabalho\\AutoEditor\\ffmpeg.exe',
  'ffmpeg'
];

let FFMPEG_PATH = 'ffmpeg';
for (const cand of FFMPEG_CANDIDATES) {
  if (cand !== 'ffmpeg' && fs.existsSync(cand)) {
    FFMPEG_PATH = cand;
    break;
  }
}

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/exports', express.static(EXPORT_DIR));

// Upload com Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, safeName);
  }
});
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 } });

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'DarkPlanner Studio',
    ffmpeg: FFMPEG_PATH,
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Listar Projetos
app.get('/api/projects', (req, res) => {
  try {
    const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
    const list = files.map(f => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf-8'));
        return {
          id: content.id || f.replace('.json', ''),
          name: content.name || 'Projeto sem nome',
          updatedAt: content.updatedAt || fs.statSync(path.join(PROJECTS_DIR, f)).mtime,
          sceneCount: content.scenes ? content.scenes.length : 0
        };
      } catch (err) {
        return null;
      }
    }).filter(Boolean);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Carregar Projeto
app.get('/api/projects/:id', (req, res) => {
  try {
    const filePath = path.join(PROJECTS_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Salvar Projeto
app.post('/api/projects', (req, res) => {
  try {
    const project = req.body;
    if (!project.id) {
      project.id = 'proj_' + Date.now();
    }
    project.updatedAt = new Date().toISOString();
    const filePath = path.join(PROJECTS_DIR, `${project.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8');
    res.json({ success: true, project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deletar Projeto
app.delete('/api/projects/:id', (req, res) => {
  try {
    const filePath = path.join(PROJECTS_DIR, `${req.params.id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload de Mídia ou SRT
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }
  res.json({
    url: `/uploads/${req.file.filename}`,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size
  });
});

// Parser de SRT
function parseSrt(text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.trim().split('\n\n');
  const items = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length >= 2) {
      const timeLineIndex = lines[0].includes('-->') ? 0 : 1;
      if (lines[timeLineIndex] && lines[timeLineIndex].includes('-->')) {
        const [startStr, endStr] = lines[timeLineIndex].split('-->').map(s => s.trim());
        const content = lines.slice(timeLineIndex + 1).join(' ').trim();

        function timeToSeconds(tStr) {
          const parts = tStr.replace(',', '.').split(':');
          if (parts.length === 3) {
            return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
          }
          return 0;
        }

        const start = timeToSeconds(startStr);
        const end = timeToSeconds(endStr);
        items.push({
          index: items.length + 1,
          start,
          end,
          duration: Math.max(0.1, end - start),
          text: content
        });
      }
    }
  }
  return items;
}

app.post('/api/parse-srt', (req, res) => {
  try {
    const { srtContent } = req.body;
    if (!srtContent) {
      return res.status(400).json({ error: 'Conteúdo SRT vazio' });
    }
    const parsed = parseSrt(srtContent);
    res.json({ success: true, count: parsed.length, items: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Exportar para CapCut
app.post('/api/export-capcut', (req, res) => {
  try {
    const { project } = req.body;
    if (!project || !project.scenes) {
      return res.status(400).json({ error: 'Dados do projeto inválidos' });
    }

    const folderName = `CapCut_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    const targetFolder = path.join(EXPORT_DIR, folderName);
    const mediaFolder = path.join(targetFolder, 'midias');
    fs.mkdirSync(mediaFolder, { recursive: true });

    const manifest = {
      project_name: project.name,
      exported_at: new Date().toISOString(),
      scenes: []
    };

    project.scenes.forEach((sc, i) => {
      const idx = String(i + 1).padStart(3, '0');
      let localMedia = null;
      if (sc.mediaUrl && sc.mediaUrl.startsWith('/uploads/')) {
        const srcPath = path.join(UPLOAD_DIR, path.basename(sc.mediaUrl));
        if (fs.existsSync(srcPath)) {
          const ext = path.extname(srcPath);
          const destName = `cena_${idx}${ext}`;
          fs.copyFileSync(srcPath, path.join(mediaFolder, destName));
          localMedia = `midias/${destName}`;
        }
      }

      manifest.scenes.push({
        cena: i + 1,
        inicio_segundos: sc.start || 0,
        fim_segundos: sc.end || 0,
        duracao: sc.duration || 5,
        tipo: sc.type || 'imagem',
        texto: sc.text || '',
        arquivo_midia: localMedia,
        prompt_ia: sc.prompt || ''
      });
    });

    const infoTxt = `=== INSTRUÇÕES PARA CAPCUT DESKTOP ===
Projeto: ${project.name}
Total de Cenas: ${project.scenes.length}

1. Abra o CapCut Desktop e crie um novo projeto.
2. Arraste todos os arquivos da pasta 'midias' para o CapCut.
3. Se você usou narração, adicione o áudio na timeline.
4. Arraste as mídias na ordem numérica.
`;
    fs.writeFileSync(path.join(targetFolder, 'LEIA-ME_CAPCUT.txt'), infoTxt, 'utf-8');
    fs.writeFileSync(path.join(targetFolder, 'sincronizacao.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    res.json({
      success: true,
      exportPath: targetFolder,
      folderName
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Renderizar MP4 direto com FFmpeg
app.post('/api/render-mp4', async (req, res) => {
  try {
    const { project } = req.body;
    if (!project || !project.scenes || project.scenes.length === 0) {
      return res.status(400).json({ error: 'Nenhuma cena para renderizar' });
    }

    const renderId = 'render_' + Date.now();
    const outputFile = path.join(EXPORT_DIR, `${renderId}.mp4`);
    const concatListFile = path.join(DATA_DIR, `${renderId}_concat.txt`);

    let concatLines = [];
    for (let i = 0; i < project.scenes.length; i++) {
      const sc = project.scenes[i];
      let mediaPath = null;
      if (sc.mediaUrl && sc.mediaUrl.startsWith('/uploads/')) {
        const cand = path.join(UPLOAD_DIR, path.basename(sc.mediaUrl));
        if (fs.existsSync(cand)) mediaPath = cand;
      }

      const dur = Math.max(1, parseFloat(sc.duration) || 4);
      if (mediaPath) {
        const safePath = mediaPath.replace(/\\/g, '/');
        concatLines.push(`file '${safePath}'`);
        concatLines.push(`duration ${dur}`);
      }
    }

    if (concatLines.length === 0) {
      return res.status(400).json({ error: 'Nenhuma mídia válida encontrada nas cenas' });
    }

    const lastFile = concatLines.find(l => l.startsWith('file '));
    if (lastFile) concatLines.push(lastFile);

    fs.writeFileSync(concatListFile, concatLines.join('\n'), 'utf-8');

    const ffmpegCmd = `"${FFMPEG_PATH}" -y -f concat -safe 0 -i "${concatListFile}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p" -c:v libx264 -preset fast -pix_fmt yuv420p "${outputFile}"`;

    exec(ffmpegCmd, (err, stdout, stderr) => {
      if (fs.existsSync(concatListFile)) fs.unlinkSync(concatListFile);

      if (err) {
        return res.status(500).json({ error: 'Falha ao renderizar MP4: ' + err.message });
      }

      res.json({
        success: true,
        downloadUrl: `/exports/${renderId}.mp4`,
        filename: `${renderId}.mp4`
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`✨ DarkPlanner Studio Ativo na porta ${PORT}!`);
  console.log(`👉 Acesse no navegador: http://localhost:${PORT}`);
  console.log(`🎬 Motor FFmpeg conectado: ${FFMPEG_PATH}`);
  console.log(`=======================================================`);
});

server.timeout = 0;
server.requestTimeout = 0;
server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;
