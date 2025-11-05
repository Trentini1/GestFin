export const formatCurrency = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+,)/g, '$1.')}`;

export const getGiroTotal = (l) => l.valorTotal ?? ((l.valorMaterial || 0) + (l.valorServico || 0));

export function animateCountUp(element, finalValue) {
    console.log(`--- AnimateCountUp chamado para o valor: ${finalValue} ---`); // NOVO CHECKPOINT
    
    if (Math.abs(finalValue) < 0.01) {
        element.textContent = formatCurrency(finalValue);
        return;
    }

    let startValue = 0;
    const duration = 1000;
    let startTime = null;

    function animationStep(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
        startValue = progress * finalValue;
        element.textContent = formatCurrency(startValue);

        if (progress < 1) {
            requestAnimationFrame(animationStep);
        } else {
            element.textContent = formatCurrency(finalValue);
        }
    }
    requestAnimationFrame(animationStep);
}

export function exportToCSV(data, filename, headers) {
    const csvContent = [headers.join(','), ...data.map(row => Object.values(row).map(value => `"${value}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
