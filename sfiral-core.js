/**
 * GIDEON-Core Математический модуль декомпозиции
 * ПОДЛИННАЯ ГЕОМЕТРИЯ СФИРАЛИ: ДВА АНТИСИММЕТРИЧНЫХ ВИТКА И S-ПЕТЛЯ
 */

const SfiralCore = {
    // Параметры масштабирования (строго по пропорциям автора)
    R_coil: 1.8,       // Радиус основного витка
    Height_Coil: 1.2,  // Высота витковой части
    Height_S: 0.4,     // Высота S-перехода

    /**
     * Генерирует точную точку Сфирали по параметру t от -1 до +1
     * @param {number} t - Нормализованный параметр хода (от -1 до +1)
     * @param {number} phase - Динамический сдвиг для анимации вращения
     * @returns {Object} {x, y, zOffset, isCenter}
     */
    getVoxelPoint(t, phase) {
        // Фиксируем знак для зеркальной антисимметрии
        const isLeft = t < 0;
        const absT = Math.abs(t); 
        
        let x = 0;
        let y = 0;
        let z = 0;
        let isCenter = false;

        const R_arc = this.R_coil / 2.0;
        const sArcRatio = 0.3; // 30% точек выделено под S-дугу

        if (absT <= sArcRatio) {
            // --- ЧАСТЬ 1: ПОЛУОКРУЖНОСТЬ (S-Дуга) ---
            isCenter = true;
            const localT = absT / sArcRatio; // Локальный проход от 0 до 1
            const phi = Math.PI * (1 - localT);

            x = R_arc + R_arc * Math.cos(phi);
            y = -R_arc * Math.sin(phi);
            z = (this.Height_S / 2) * localT;
        } else {
            // --- ЧАСТЬ 2: ОСНОВНОЙ ВИТОК (СТРОГО ОДИН ВИТОК) ---
            const localT = (absT - sArcRatio) / (1.0 - sArcRatio); // Локальный проход от 0 до 1
            
            // Угол витка жестко ограничен диапазоном от 0 до 2*PI (ровно 1 оборот)
            const theta = 2 * Math.PI * localT; 

            x = this.R_coil * Math.cos(theta);
            y = this.R_coil * Math.sin(theta);
            z = (this.Height_S / 2) + (this.Height_Coil * localT);
        }

        // --- ФУНДАМЕНТАЛЬНАЯ АНТИСИММЕТРИЯ: P_left = -P_right ---
        if (isLeft) {
            x = -x;
            y = -y;
            z = -z;
        }

        // Динамическая трансформация вращения всей Сфирали вокруг оси Z
        const rotatedX = x * Math.cos(phase) - y * Math.sin(phase);
        const rotatedY = x * Math.sin(phase) + y * Math.cos(phase);

        return {
            x: rotatedX,
            y: rotatedY,
            zOffset: z,
            isCenter: isCenter
        };
    },

    /**
     * Спектральный анализ цвета для демо-режима
     */
    getDemoColor(t) {
        if (Math.abs(t) < 0.12) {
            return { r: 0, g: 255, b: 204, a: 1 }; // Сфиральный S-узел (Яркий Неон)
        } else if (t < 0) {
            return { r: 31, g: 119, b: 180, a: 0.85 }; // Левый виток V- (Синий)
        } else {
            return { r: 214, g: 39, b: 40, a: 0.85 };  // Правый виток V+ (Красный)
        }
    }
};
