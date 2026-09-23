import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false,
  },
};

const CATBOX_API = 'https://catbox.moe/user/api.php';
const MAX_FILE_SIZE = 4 * 1024 * 1024; // keep below common serverless request limits

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: MAX_FILE_SIZE,
      },
    });

    let fileInfo = null;
    let fileTooLarge = false;
    const chunks = [];
    let userhash = '';

    bb.on('field', (name, value) => {
      if (name === 'userhash') userhash = String(value || '').trim();
    });

    bb.on('file', (name, stream, info) => {
      const { filename, mimeType } = info;
      fileInfo = {
        filename: filename || 'arquivo.bin',
        mimeType: mimeType || 'application/octet-stream',
      };

      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('limit', () => {
        fileTooLarge = true;
      });
    });

    bb.on('error', reject);

    bb.on('finish', () => {
      if (fileTooLarge) {
        return reject(
          new Error(
            'Arquivo muito grande para esta hospedagem. Tente um arquivo menor ou use um backend com limite maior.'
          )
        );
      }

      if (!fileInfo || chunks.length === 0) {
        return reject(new Error('Nenhum arquivo foi recebido.'));
      }

      resolve({
        userhash,
        filename: fileInfo.filename,
        mimeType: fileInfo.mimeType,
        buffer: Buffer.concat(chunks),
      });
    });

    req.pipe(bb);
  });
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, {
      success: false,
      error: 'Método não permitido. Use POST.',
    });
  }

  try {
    const parsed = await parseMultipart(req);

    const form = new FormData();
    form.append('reqtype', 'fileupload');

    if (parsed.userhash) {
      form.append('userhash', parsed.userhash);
    }

    const blob = new Blob([parsed.buffer], {
      type: parsed.mimeType,
    });

    form.append('fileToUpload', blob, parsed.filename);

    const catboxResponse = await fetch(CATBOX_API, {
      method: 'POST',
      body: form,
    });

    const responseText = (await catboxResponse.text()).trim();

    if (!catboxResponse.ok) {
      return json(res, 502, {
        success: false,
        error: `Catbox respondeu HTTP ${catboxResponse.status}.`,
        details: responseText.slice(0, 500),
      });
    }

    const match = responseText.match(
      /^https:\/\/(?:files|litter)\.catbox\.moe\/[A-Za-z0-9._-]+$/
    );

    if (!match) {
      return json(res, 502, {
        success: false,
        error: responseText || 'O Catbox não retornou um link válido.',
      });
    }

    return json(res, 200, {
      success: true,
      url: match[0],
      provider: 'Catbox.moe',
      filename: parsed.filename,
    });
  } catch (error) {
    console.error('Catbox upload error:', error);

    return json(res, 500, {
      success: false,
      error: error?.message || 'Erro interno ao enviar para o Catbox.',
    });
  }
}
