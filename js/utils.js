export const formatCurrency = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+,)/g, '$1.')}`;

export const getGiroTotal = (l) => l.valorTotal ?? ((l.valorMaterial || 0) + (l.valorServico || 0));

export function animateCountUp(element, finalValue) {
    console.log(`--- AnimateCountUp chamado para o valor: ${finalValue} ---`); // NOVO CHECKPOINT
    
    if (finalValue <= 0) {
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
