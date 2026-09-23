const CATBOX_API = "https://catbox.moe/user/api.php";
const MAX_FILE_SIZE = 4 * 1024 * 1024;

function json(data, status = 200) {
    return Response.json(data, {
        status,
        headers: {
            "Cache-Control": "no-store"
        }
    });
}

export async function GET() {
    return json({
        success: true,
        message: "FileForge API funcionando"
    });
}

async function enviarCatbox(file, userhash) {

    const buffer = await file.arrayBuffer();

    const blob = new Blob(
        [buffer],
        {
            type:
                file.type ||
                "application/octet-stream"
        }
    );

    const form = new FormData();

    form.append(
        "reqtype",
        "fileupload"
    );

    if (userhash) {
        form.append(
            "userhash",
            userhash
        );
    }

    form.append(
        "fileToUpload",
        blob,
        file.name || "arquivo.bin"
    );

    const response = await fetch(
        CATBOX_API,
        {
            method: "POST",
            headers: {
                "User-Agent":
                    "Mozilla/5.0 FileForge"
            },
            body: form
        }
    );

    const text =
        (await response.text()).trim();

    return {
        status: response.status,
        text
    };
}

async function enviarLitterbox(file) {

    const buffer = await file.arrayBuffer();

    const blob = new Blob(
        [buffer],
        {
            type:
                file.type ||
                "application/octet-stream"
        }
    );

    const form = new FormData();

    form.append(
        "reqtype",
        "fileupload"
    );

    form.append(
        "time",
        "72h"
    );

    form.append(
        "fileToUpload",
        blob,
        file.name || "arquivo.bin"
    );

    const response = await fetch(
        CATBOX_API,
        {
            method: "POST",
            headers: {
                "User-Agent":
                    "Mozilla/5.0 FileForge"
            },
            body: form
        }
    );

    const text =
        (await response.text()).trim();

    return {
        status: response.status,
        text
    };
}

export async function POST(request) {

    try {

        const form =
            await request.formData();

        const file =
            form.get("file");

        const userhash =
            String(
                form.get("userhash") || ""
            ).trim();

        if (
            !file ||
            typeof file.arrayBuffer !== "function"
        ) {

            return json({
                success: false,
                error:
                    "Nenhum arquivo recebido."
            }, 400);

        }

        if (file.size <= 0) {

            return json({
                success: false,
                error:
                    "O arquivo está vazio."
            }, 400);

        }

        if (
            file.size >
            MAX_FILE_SIZE
        ) {

            return json({
                success: false,
                error:
                    "O arquivo ultrapassa 4 MB."
            }, 413);

        }

        /*
         * PRIMEIRA TENTATIVA:
         * Catbox permanente
         */

        const catbox =
            await enviarCatbox(
                file,
                userhash
            );

        const catboxURL =
            catbox.text;

        const linkCatbox =
            /^https:\/\/(?:files|litter)\.catbox\.moe\/[A-Za-z0-9._-]+$/;

        if (
            catbox.status === 200 &&
            linkCatbox.test(catboxURL)
        ) {

            return json({
                success: true,
                url: catboxURL,
                provider: "Catbox.moe",
                permanent: true,
                filename:
                    file.name
            });

        }

        /*
         * SEGUNDA TENTATIVA:
         * Litterbox
         */

        const litter =
            await enviarLitterbox(file);

        const litterURL =
            litter.text;

        if (
            litter.status === 200 &&
            linkCatbox.test(litterURL)
        ) {

            return json({
                success: true,
                url: litterURL,
                provider: "Litterbox",
                permanent: false,
                expires: "72h",
                filename:
                    file.name,
                warning:
                    "O Catbox permanente recusou o upload. Foi usado Litterbox por 72 horas."
            });

        }

        /*
         * Falhar somente depois
         * das duas tentativas.
         */

        return json({

            success: false,

            error:
                "Não foi possível enviar o arquivo.",

            catbox_status:
                catbox.status,

            catbox_response:
                catbox.text,

            litterbox_status:
                litter.status,

            litterbox_response:
                litter.text

        }, 502);

    } catch (error) {

        console.error(
            "FileForge:",
            error
        );

        return json({

            success: false,

            error:
                error?.message ||
                "Erro interno no servidor."

        }, 500);

    }
}
