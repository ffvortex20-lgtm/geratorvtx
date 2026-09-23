const Busboy = require('busboy');

const CATBOX_API = 'https://catbox.moe/user/api.php';
const MAX_FILE_SIZE = 4 * 1024 * 1024;

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    let bb;
    try {
      bb = Busboy({
        headers: req.headers,
        limits: { files: 1, fileSize: MAX_FILE_SIZE }
      });
    } catch (err) {
      return reject(err);
    }

    let receivedFile = false;
    let tooLarge = false;
    let filename = 'arquivo.bin';
    let mimeType = 'application/octet-stream';
    let userhash = '';
    const chunks = [];

    bb.on('field', (name, value) => {
      if (name === 'userhash') userhash = String(value || '').trim();
    });

    bb.on('file', (name, stream, info) => {
      if (receivedFile) {
        stream.resume();
        return;
      }

      receivedFile = true;
      filename = info.filename || filename;
      mimeType = info.mimeType || mimeType;

      stream.on('data', chunk => chunks.push(chunk));
      stream.on('limit', () => { tooLarge = true; });
    });

    bb.on('error', reject);

    bb.on('finish', () => {
      if (tooLarge) return reject(new Error('O arquivo é maior que o limite de 4 MB.'));
      if (!receivedFile || chunks.length === 0) return reject(new Error('Nenhum arquivo foi recebido.'));

      resolve({
        filename,
        mimeType,
        userhash,
        buffer: Buffer.concat(chunks)
      });
    });

    req.pipe(bb);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, {
      success: false,
      error: 'Método não permitido. Use POST.'
    });
  }

  try {
    const data = await parseMultipart(req);

    const form = new FormData();
    form.append('reqtype', 'fileupload');

    if (data.userhash) {
      form.append('userhash', data.userhash);
    }

    form.append(
      'fileToUpload',
      new Blob([data.buffer], { type: data.mimeType }),
      data.filename
    );

    const response = await fetch(CATBOX_API, {
      method: 'POST',
      body: form
    });

    const result = (await response.text()).trim();

    if (!response.ok) {
      return json(res, 502, {
        success: false,
        error: `Catbox respondeu HTTP ${response.status}.`,
        details: result.slice(0, 500)
      });
    }

    const validCatbox = /^https:\/\/(files|litter)\.catbox\.moe\/[A-Za-z0-9._-]+$/;

    if (!validCatbox.test(result)) {
      return json(res, 502, {
        success: false,
        error: result || 'O Catbox não retornou um link válido.'
      });
    }

    return json(res, 200, {
      success: true,
      url: result,
      provider: 'Catbox.moe',
      filename: data.filename
    });
  } catch (err) {
    console.error('FileForge upload error:', err);
    return json(res, 500, {
      success: false,
      error: err && err.message ? err.message : 'Erro interno no servidor.'
    });
  }
};
