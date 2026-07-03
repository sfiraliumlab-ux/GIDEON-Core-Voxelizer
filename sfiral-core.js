/**
 * GIDEON-Core Математический модуль декомпозиции
 * ГРАДИЕНТНЫЙ ФАЗОВЫЙ ПЕРЕХОД ПОДЛИННОЙ СФИРАЛИ
 */

const SfiralCore = {
    // Параметры масштабирования (пропорции автора)
    R_coil: 1.8,       
    Height_Coil: 1.2,  
    Height_S: 0.4,     

    /**
     * Генерирует точную точку Сфирали по параметру t от -1 до +1
     */
    getVoxelPoint(t, phase) {
        const isLeft = t < 0;
        const absT = Math.abs(t); 
        
        let x = 0; let y = 0; let z = 0;
        let isCenter = false;

        const R_arc = this.R_coil / 2.0;
        const sArcRatio = 0.3; // 30% диапазона на S-дугу

        if (absT <= sArcRatio) {
            // --- ЧАСТЬ 1: ПОЛУОКРУЖНОСТЬ (S-Дуга) ---
            isCenter = true;
            const localT = absT / sArcRatio; 
            const phi = Math.PI * (1 - localT);

            x = R_arc + R_arc * Math.cos(phi);
            y = -R_arc * Math.sin(phi);
            z = (this.Height_S / 2) * localT;
        } else {
            // --- ЧАСТЬ 2: ОСНОВНОЙ ВИТОК ---
            const localT = (absT - sArcRatio) / (1.0 - sArcRatio); 
            const theta = 2 * Math.PI * localT; 

            x = this.R_coil * Math.cos(theta);
            y = this.R_coil * Math.sin(theta);
            z = (this.Height_S / 2) + (this.Height_Coil * localT);
        }

        // --- АНТИСИММЕТРИЯ: P_left = -P_right ---
        if (isLeft) {
            x = -x; y = -y; z = -z;
        }

        // Вращение
        const rotatedX = x * Math.cos(phase) - y * Math.sin(phase);
        const rotatedY = x * Math.sin(phase) + y * Math.cos(phase);

        return {
            x: rotatedX, y: rotatedY, zOffset: z,
            isCenter: isCenter
        };
    },

    /**
     * Динамический расчет цвета: Плавный градиент фазового перехода
     * От Синего (-1) через Фиолетовый к Красному (+1)
     * @param {number} t - Параметр от -1 до +1
     */
    getDemoColor(t) {
        // Нормализуем t из диапазона [-1, 1] в диапазон [0, 1] для цветового ползунка
        // При t = -1 (начало синего витка) factor = 0
        // При t = 0 (центр S-петли) factor = 0.5
        // При t = 1 (конец красного витка) factor = 1
        const factor = (t + 1) / 2;

        // Линейная интерполяция между Синим (31, 119, 180) и Красным (214, 39, 40)
        const r = Math.round(31 + (214 - 31) * factor);
        const g = Math.round(119 + (39 - 119) * factor);
        const b = Math.round(180 + (40 - 180) * factor);

        // Повышаем прозрачность ближе к краям, делая фокус на центре инверсии
        const a = 0.6 + 0.4 * (1 - Math.abs(t)); 

        return { r, g, b, a };
    }
};
