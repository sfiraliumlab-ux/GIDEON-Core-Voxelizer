/**
 * GIDEON-Core Математический модуль декомпозиции
 * ПОДЛИННАЯ ГЕОМЕТРИЯ СФИРАЛИ С ИНТЕРАКТИВНЫМ 3D-РАЗВЕРТЫВАНИЕМ
 */

const SfiralCore = {
    // Параметры масштабирования (пропорции автора)
    R_coil: 1.8,       
    Height_Coil: 1.2,  
    Height_S: 0.4,     

    /**
     * Генерирует точную точку Сфирали по параметру t от -1 до +1 с учетом 3D-поворота пользователя
     * @param {number} t - Параметр хода (-1 до 1)
     * @param {number} phase - Базовая фаза (авто-вращение)
     * @param {number} rotX - Пользовательский наклон по вертикали (в радианах)
     * @param {number} rotY - Пользовательский поворот по горизонтали (в радианах)
     */
    getVoxelPoint(t, phase, rotX = 0, rotY = 0) {
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

        // 1. Сначала применяем базовую фазу времени (авто-вращение вокруг Z)
        let x1 = x * Math.cos(phase) - y * Math.sin(phase);
        let y1 = x * Math.sin(phase) + y * Math.cos(phase);
        let z1 = z;

        // 2. Интерактивный поворот по горизонтали (вокруг оси Y)
        let x2 = x1 * Math.cos(rotY) + z1 * Math.sin(rotY);
        let y2 = y1;
        let z2 = -x1 * Math.sin(rotY) + z1 * Math.cos(rotY);

        // 3. Интерактивный поворот по вертикали (вокруг оси X)
        let x3 = x2;
        let y3 = y2 * Math.cos(rotX) - z2 * Math.sin(rotX);
        let z3 = y2 * Math.sin(rotX) + z2 * Math.cos(rotX);

        return {
            x: x3,
            y: y3,
            zOffset: z3, // Новая глубина с учетом 3D проекции
            isCenter: isCenter
        };
    },

    /**
     * Расчет фазового градиента цвета
     */
    getDemoColor(t) {
        const factor = (t + 1) / 2;
        const r = Math.round(31 + (214 - 31) * factor);
        const g = Math.round(119 + (39 - 119) * factor);
        const b = Math.round(180 + (40 - 180) * factor);
        const a = 0.6 + 0.4 * (1 - Math.abs(t)); 
        return { r, g, b, a };
    }
};
