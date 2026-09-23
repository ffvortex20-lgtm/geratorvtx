const CATBOX_API = "https://catbox.moe/user/api.php";

const MAX_FILE_SIZE = 4 * 1024 * 1024;

function resposta(data, status = 200) {
    return Response.json(data, {
        status,
        headers: {
            "Cache-Control": "no-store"
        }
    });
}

// Teste da API
export async function GET() {
    return resposta({
        success: true,
        message: "FileForge API funcionando",
        endpoint: "/api/upload",
        method: "POST"
    });
}

// Upload
export async function POST(request) {

    try {

        const contentType =
            request.headers.get("content-type") || "";

        if (
            !contentType
                .toLowerCase()
                .includes("multipart/form-data")
        ) {

            return resposta({
                success: false,
                error:
                    "A requisição precisa ser multipart/form-data."
            }, 400);

        }

        const formData =
            await request.formData();

        const file =
            formData.get("file");

        const userhash =
            String(
                formData.get("userhash") || ""
            ).trim();

        // Verifica arquivo
        if (
            !file ||
            typeof file.arrayBuffer !== "function"
        ) {

            return resposta({
                success: false,
                error:
                    "Nenhum arquivo foi recebido."
            }, 400);

        }

        // Verifica tamanho
        if (
            file.size <= 0
        ) {

            return resposta({
                success: false,
                error:
                    "O arquivo está vazio."
            }, 400);

        }

        if (
            file.size > MAX_FILE_SIZE
        ) {

            return resposta({
                success: false,
                error:
                    "O arquivo é maior que 4 MB."
            }, 413);

        }

        /*
         * Converte o arquivo recebido
         * para um Blob novo.
         */
        const arquivoBuffer =
            await file.arrayBuffer();

        const arquivoBlob =
            new Blob(
                [arquivoBuffer],
                {
                    type:
                        file.type ||
                        "application/octet-stream"
                }
            );

        /*
         * Monta a requisição para o Catbox.
         */
        const catboxForm =
            new FormData();

        catboxForm.append(
            "reqtype",
            "fileupload"
        );

        if (userhash) {

            catboxForm.append(
                "userhash",
                userhash
            );

        }

        catboxForm.append(
            "fileToUpload",
            arquivoBlob,
            file.name ||
            "arquivo.bin"
        );

        /*
         * Envia para o Catbox.
         */
        const catboxResponse =
            await fetch(
                CATBOX_API,
                {
                    method: "POST",

                    headers: {
                        "User-Agent":
                            "FileForge/1.0"
                    },

                    body:
                        catboxForm
                }
            );

        const catboxText =
            (
                await catboxResponse.text()
            ).trim();

        /*
         * Se Catbox devolver erro,
         * mostra a resposta real.
         */
        if (!catboxResponse.ok) {

            console.error(
                "CATBOX STATUS:",
                catboxResponse.status
            );

            console.error(
                "CATBOX RESPONSE:",
                catboxText
            );

            return resposta({

                success: false,

                error:
                    "Catbox respondeu HTTP " +
                    catboxResponse.status,

                catbox_response:
                    catboxText ||
                    "Catbox não enviou detalhes.",

                status:
                    catboxResponse.status

            }, 502);

        }

        /*
         * Verifica o link.
         */
        const linkValido =
            /^https:\/\/(?:files|litter)\.catbox\.moe\/[A-Za-z0-9._-]+$/;

        if (
            !linkValido.test(
                catboxText
            )
        ) {

            return resposta({

                success: false,

                error:
                    "O Catbox não retornou um link válido.",

                catbox_response:
                    catboxText

            }, 502);

        }

        /*
         * SUCESSO
         */
        return resposta({

            success: true,

            url:
                catboxText,

            provider:
                "Catbox.moe",

            filename:
                file.name ||
                "arquivo.bin"

        }, 200);

    } catch (error) {

        console.error(
            "FILEFORGE ERROR:",
            error
        );

        return resposta({

            success: false,

            error:
                error?.message ||
                "Erro interno no servidor."

        }, 500);

    }

}
