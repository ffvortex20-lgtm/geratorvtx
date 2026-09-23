const Busboy = require("busboy");

const CATBOX_API = "https://catbox.moe/user/api.php";
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

function sendJSON(res, status, data) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    res.end(JSON.stringify(data));
}

function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const bb = Busboy({
            headers: req.headers,
            limits: {
                files: 1,
                fileSize: MAX_FILE_SIZE
            }
        });

        let file = null;
        let userhash = "";
        let tooLarge = false;
        let chunks = [];

        bb.on("field", (name, value) => {
            if (name === "userhash") {
                userhash = String(value || "").trim();
            }
        });

        bb.on("file", (name, stream, info) => {
            const filename = info.filename || "arquivo.bin";
            const mimeType =
                info.mimeType || "application/octet-stream";

            file = {
                filename,
                mimeType
            };

            stream.on("data", chunk => {
                chunks.push(chunk);
            });

            stream.on("limit", () => {
                tooLarge = true;
            });
        });

        bb.on("error", err => {
            reject(err);
        });

        bb.on("finish", () => {
            if (tooLarge) {
                return reject(
                    new Error(
                        "O arquivo é maior que o limite de 4 MB."
                    )
                );
            }

            if (!file || chunks.length === 0) {
                return reject(
                    new Error("Nenhum arquivo foi recebido.")
                );
            }

            resolve({
                filename: file.filename,
                mimeType: file.mimeType,
                userhash,
                buffer: Buffer.concat(chunks)
            });
        });

        req.pipe(bb);
    });
}

module.exports = async function handler(req, res) {

    // Permite somente POST
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");

        return sendJSON(res, 405, {
            success: false,
            error: "Método não permitido. Use POST."
        });
    }

    try {

        const data = await parseMultipart(req);

        const form = new FormData();

        form.append("reqtype", "fileupload");

        if (data.userhash) {
            form.append("userhash", data.userhash);
        }

        const blob = new Blob(
            [data.buffer],
            {
                type: data.mimeType
            }
        );

        form.append(
            "fileToUpload",
            blob,
            data.filename
        );

        const response = await fetch(
            CATBOX_API,
            {
                method: "POST",
                body: form
            }
        );

        const text = (
            await response.text()
        ).trim();

        if (!response.ok) {

            return sendJSON(res, 502, {
                success: false,
                error:
                    "Catbox respondeu HTTP " +
                    response.status,
                details: text.substring(0, 500)
            });

        }

        // Verifica se realmente recebemos um link Catbox
        const validURL =
            /^https:\/\/(files|litter)\.catbox\.moe\/[A-Za-z0-9._-]+$/;

        if (!validURL.test(text)) {

            return sendJSON(res, 502, {
                success: false,
                error:
                    text ||
                    "O Catbox não retornou um link válido."
            });

        }

        return sendJSON(res, 200, {
            success: true,
            url: text,
            provider: "Catbox.moe",
            filename: data.filename
        });

    } catch (error) {

        console.error(
            "Erro no upload:",
            error
        );

        return sendJSON(res, 500, {
            success: false,
            error:
                error.message ||
                "Erro interno no servidor."
        });

    }
};
