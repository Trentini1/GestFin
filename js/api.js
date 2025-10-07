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
    const apiKey = "AIzaSyDY9w9c17tQygvDlUwALFSc6YOPdiAJfNM"; // ATENÇÃO: Substitua pela sua chave segura
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    
    const prompt = `
        Analise a imagem desta Nota Fiscal (NFS-e de serviço de Curitiba ou DANFE de produtos) e extraia as seguintes informações em formato JSON. Seja extremamente preciso:
        1.  **cliente**: Encontre o nome/razão social do "TOMADOR DE SERVIÇOS" (em NFS-e) ou do "DESTINATÁRIO" (em DANFE).
        2.  **dataEmissao**: Encontre a "Data e Hora de Emissão" ou "Data de Emissão" e formate como AAAA-MM-DD.
        3.  **numeroNf**: Encontre o "Número da Nota".
        4.  **valorTotal**: Encontre o "Valor Líquido da Nota Fiscal", "VALOR TOTAL DOS SERVIÇOS" ou "VALOR TOTAL DA NOTA". Extraia apenas o número.
        5.  **os**: Dentro do quadro "DISCRIMINAÇÃO DOS SERVIÇOS" ou "DADOS ADICIONAIS / Informações Complementares", procure por "O.S", "O.S." ou "Ordem de Serviço" e extraia o número que a acompanha. Se não encontrar, deixe em branco.
        6.  **pc**: Dentro dos mesmos campos do item anterior, procure por "PC" ou "Pedido de Compra" e extraia o código que o acompanha (ex: PC172315). Se não encontrar, deixe em branco.
        7.  **observacoes**: Faça um resumo de uma linha (máximo 15 palavras) da "DISCRIMINAÇÃO DOS SERVIÇOS" ou "Natureza da Operação". Ignore listas de peças.
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
            responseSchema: {
                type: "OBJECT",
                properties: { "dataEmissao": { "type": "STRING" }, "cliente": { "type": "STRING" }, "numeroNf": { "type": "STRING" }, "os": { "type": "STRING" }, "pc": { "type": "STRING" }, "valorTotal": { "type": "NUMBER" }, "observacoes": { "type": "STRING" } }
            }
        }
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error("A resposta da API de IA não foi bem-sucedida.");
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
