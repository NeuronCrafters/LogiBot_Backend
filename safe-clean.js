const fs = require('fs');
const path = require('path');

// --- CONFIGURAÇÕES ---
const directoryPath = path.join(__dirname, 'src'); // Pasta onde está seu código
const extensions = ['.ts', '.js']; // Extensões que serão analisadas

// --- REGEX DE ALVO ---
// Captura: new AppError, new Error, console.log/warn/error
// Importante: Só captura se abrir com aspas simples (') ou duplas (")
// Ignora crase (`) propositalmente para não quebrar variáveis ${...}
const targetRegex = /(new AppError|new Error|console\.(?:log|warn|error))\s*\(\s*(['"])([\s\S]*?)\2/g;

// --- REGEX DE EMOJIS ---
const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Verifica se o arquivo tem algo que nos interessa antes de processar
  if (!content.match(/AppError|Error|console\./)) return;

  const newContent = content.replace(targetRegex, (match, command, quote, text) => {
    // match:   new AppError("Acesso Negado.",
    // command: new AppError
    // quote:   "
    // text:    Acesso Negado.

    // 1. Remove Emojis
    let cleanText = text.replace(emojiRegex, '');

    // 2. Converte para minúsculo
    cleanText = cleanText.toLowerCase();

    // 3. Remove espaços extras nas pontas (trim)
    cleanText = cleanText.trim();

    // Reconstrói o comando preservando as aspas originais
    return `${command}(${quote}${cleanText}${quote}`;
  });

  // Só salva se houve alteração real
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ Ajustado: ${path.basename(filePath)}`);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`Diretório não encontrado: ${dir}`);
    return;
  }

  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        walkDir(filePath);
      }
    } else if (extensions.includes(path.extname(file))) {
      processFile(filePath);
    }
  });
}

console.log('🛡️  Iniciando limpeza segura (Apenas Strings Estáticas)...');
walkDir(directoryPath);
console.log('🏁 Concluído!');