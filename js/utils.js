export const formatCurrency = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+,)/g, '$1.')}`;

export const getGiroTotal = (l) => l.valorTotal ?? ((l.valorMaterial || 0) + (l.valorServico || 0));
// js/utils.js

export const formatCurrency = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+,)/g, '$1.')}`;

export const getGiroTotal = (l) => l.valorTotal ?? ((l.valorMaterial || 0) + (l.valorServico || 0));

// NOVA FUNÇÃO: Animação de contagem
export function animateCountUp(element, finalValue) {
    let startValue = 0;
    const duration = 1000; // Duração total da animação em milissegundos
    const steps = Math.min(finalValue, 100); // Limita o número de passos para não sobrecarregar
    if (steps === 0) {
        element.textContent = formatCurrency(finalValue);
        return;
    }

    const increment = finalValue / steps;
    const stepDuration = duration / steps;

    const timer = setInterval(() => {
        startValue += increment;
        if (startValue >= finalValue) {
            startValue = finalValue;
            clearInterval(timer);
        }
        element.textContent = formatCurrency(startValue);
    }, stepDuration);
}
