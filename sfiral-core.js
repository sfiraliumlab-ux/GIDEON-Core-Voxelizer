/**
 * GIDEON-Core Математический модуль декомпозиции
 * Архитектура "Сфирали Времени" на базе золотого сечения
 */

const SfiralCore = {
    // Константа золотого сечения
    PHI: (1 + Math.sqrt(5)) / 2,

    /**
     * Вычисляет пространственные координаты 3D вокселя на основе шага s
     * @param {number} s - Сфиральное время (шаг по оси)
     * @param {number} time - Динамическое смещение фазы (анимация)
     * @returns {Object} {x, y, zOffset, isCenter}
     */
    getVoxelPoint(s, time) {
        // 1. Функция S-перехода (веса распределения витков)
        // Логистическая функция сглаживания перехода через ноль
        const psi = (1 / (1 + Math.exp(-3 * s))) * (Math.PI / 2);
        const alpha = Math.cos(psi); // Вес витка V-
        const beta = Math.sin(psi);  // Вес витка V+

        // 2. Ветви правого и левого свития, модулированные золотым сечением (s * PHI)
        const r_minus_x = Math.cos(2 * Math.PI * s * this.PHI + time);
        const r_minus_y = Math.sin(2 * Math.PI * s * this.PHI + time);

        const r_plus_x = Math.cos(2 * Math.PI * s * this.PHI - time);
        const r_plus_y = -Math.sin(2 * Math.PI * s * this.PHI - time);

        // 3. Интерполяция встречных траекторий ядра
        // Сфиральное расширение радиуса по мере удаления от центра (|s| * 0.18)
        const expansion = 1 + 0.18 * Math.abs(s);
        const x = (alpha * r_minus_x + beta * r_plus_x) * expansion;
        const y = (alpha * r_minus_y + beta * r_plus_y) * expansion;

        // Флаг нахождения в критической точке инверсии (S-узел)
        const isCenter = Math.abs(s) < 0.15;

        return { x, y, zOffset: s, isCenter };
    },

    /**
     * Вычисляет базовое цветовое кодирование каркаса для демо-режима
     */
    getDemoColor(s) {
        if (Math.abs(s) < 0.15) {
            return { r: 0, g: 255, b: 204, a: 1 }; // Неоновый S-узел
        } else if (s < 0) {
            return { r: 31, g: 119, b: 180, a: 0.4 + (s / 10) }; // Виток V- (Синий)
        } else {
            return { r: 214, g: 39, b: 40, a: 0.4 - (s / 10) };  // Виток V+ (Красный)
        }
    }
};
