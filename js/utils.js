// js/utils.js

export const formatCurrency = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+,)/g, '$1.')}`;

export const getGiroTotal = (l) => l.valorTotal ?? ((l.valorMaterial || 0) + (l.valorServico || 0));

// Função de animação de contagem
export function animateCountUp(element, finalValue) {
    let startValue = 0;
    const duration = 1000; // Duração total da animação em milissegundos
    
    // Evita divisão por zero e garante que animações para valores pequenos funcionem
    const steps = Math.min(Math.floor(finalValue), 100) || 1;
    
    const increment = finalValue / steps;
    const stepDuration = duration / steps;

    // Garante que o elemento comece em 0 formatado
    element.textContent = formatCurrency(0);

    if (finalValue === 0) return;

    const timer = setInterval(() => {
        startValue += increment;
        if (startValue >= finalValue) {
            startValue = finalValue;
            clearInterval(timer);
        }
        element.textContent = formatCurrency(startValue);
    }, stepDuration);
}
