export async function extractPdfImage(file) {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;
    const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport: viewport }).promise;
    return canvas.toDataURL().split(',')[1];
}

export async function callGeminiForAnalysis(base64ImageData) {
    // IMPORTANTE: Substitua pela sua chave de API válida e segura
    const apiKey = "SUA_CHAVE_API_DO_GEMINI_AQUI"; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    
    const prompt = `
        Analise a imagem desta Nota Fiscal (NFS-e de serviço de Curitiba ou DANFE de produtos) e extraia as seguintes informações em formato JSON. Seja extremamente preciso.
        1.  **cliente**: Encontre o nome/razão social do "TOMADOR DE SERVIÇOS" ou do "DESTINATÁRIO".
        2.  **dataEmissao**: Encontre a "Data de Emissão" e formate como AAAA-MM-DD.
        3.  **numeroNf**: Encontre o "Número da Nota".
        4.  **valorTotal**: Encontre o "Valor Líquido da Nota Fiscal" ou "VALOR TOTAL DA NOTA". Extraia apenas o número.
        5.  **os**: No campo de descrição/serviços, procure por "O.S" ou "Ordem de Serviço" e extraia o número que a acompanha. Se não encontrar, retorne null.
        6.  **pc**: No mesmo campo, procure por "PC" ou "Pedido de Compra" e extraia o código. Se não encontrar, retorne null.
        7.  **observacoes**: Faça um resumo de uma linha (máximo 15 palavras) da "DISCRIMINAÇÃO DOS SERVIÇOS".
    `;

    const payload = {
        contents: [{
            parts: [
                { text: prompt },
                { inline_data: { mime_type: "image/png", data: base64ImageData } }
            ]
        }],
        generationConfig: {
            responseMimeType: "application/json",
        }
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`A resposta da API de IA não foi bem-sucedida. Status: ${response.status}`);
    }

    const result = await response.json();
    const candidate = result.candidates?.[0];
    const jsonText = candidate?.content?.parts?.[0]?.text;
    
    if (jsonText) {
        return JSON.parse(jsonText);
    } else {
        throw new Error("A API de IA não retornou dados válidos.");
    }
}
