export const formatCurrency = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+,)/g, '$1.')}`;

export const getGiroTotal = (l) => l.valorTotal ?? ((l.valorMaterial || 0) + (l.valorServico || 0));

export function animateCountUp(element, finalValue) {
    // Se o valor for 0, apenas exibe e não anima.
    if (finalValue === 0) {
        element.textContent = formatCurrency(0);
        return;
    }
    
    // Para valores negativos, exibe diretamente sem animação de contagem
    if (finalValue < 0) {
        element.textContent = formatCurrency(finalValue);
        return;
    }

    let startValue = 0;
    const duration = 1000; // 1 segundo de animação
    let startTime = null;

    function animationStep(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
        // Calcula o valor atual baseado no progresso da animação
        startValue = progress * finalValue;
        element.textContent = formatCurrency(startValue);

        // Continua a animação até que o progresso seja 1 (100%)
        if (progress < 1) {
            requestAnimationFrame(animationStep);
        } else {
            // Ao final, garante que o valor final exato seja exibido
            element.textContent = formatCurrency(finalValue);
        }
    }
    // Inicia o primeiro passo da animação
    requestAnimationFrame(animationStep);
}
