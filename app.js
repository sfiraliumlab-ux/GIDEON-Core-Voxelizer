/**
 * GIDEON Core Voxelize — Главный координатор приложения
 */

// Селекторы элементов DOM
const canvas = document.getElementById('viewportCanvas');
const gl = canvas.getContext('2d');
const bufferCanvas = document.getElementById('bufferCanvas');
const bCtx = bufferCanvas.getContext('2d');
const webcam = document.getElementById('webcam');

const btnCam = document.getElementById('btnCam');
const btnDemo = document.getElementById('btnDemo');
const fileLoad = document.getElementById('fileLoad');

const rngDensity = document.getElementById('rngDensity');
const rngSqueeze = document.getElementById('rngSqueeze');

// Состояние приложения
let currentMode = 'demo'; // demo, camera, file
let sTime = 0;
let loadedImgElement = null;

// Синхронизация размеров холста
function initViewport() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}
window.addEventListener('resize', initViewport);
initViewport();

// --- ОБРАБОТЧИКИ ПОТОКОВ ДАННЫХ ---

function setMode(modeName, labelText) {
    currentMode = modeName;
    document.getElementById('telMode').innerText = labelText.toUpperCase();
    document.querySelectorAll('.gideon-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('sysStatus').innerText = `СТАТУС: ПОТОК [${labelText.toUpperCase()}]`;
}

// Режим демонстрации
btnDemo.addEventListener('click', () => {
    setMode('demo', 'synthetic_pattern');
    btnDemo.classList.add('active');
    webcam.style.display = 'none';
    bufferCanvas.style.display = 'none';
    if (webcam.srcObject) {
        webcam.srcObject.getTracks().forEach(t => t.stop());
    }
});

// Режим веб-камеры
btnCam.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 } });
        webcam.srcObject = stream;
        webcam.style.display = 'block';
        bufferCanvas.style.display = 'none';
        setMode('camera', 'sensor_stream');
        btnCam.classList.add('active');
    } catch (err) {
        document.getElementById('sysStatus').innerText = "ОШИБКА: НЕТ ДОСТУПА К СЕНСОРУ";
    }
});

// Режим загрузки файла
fileLoad.addEventListener('change', (e) => {
    const file = e.target.files[0]; // Исправлено для корректного захвата одного файла
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            loadedImgElement = img;
            bufferCanvas.style.display = 'block';
            webcam.style.display = 'none';
            // Отрисовываем картинку во внутренний буфер
            bCtx.clearRect(0, 0, 160, 120);
            bCtx.drawImage(img, 0, 0, 160, 120);
            setMode('file', 'file_buffer');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// --- ГЛАВНЫЙ ЦИКЛ РЕНДЕРИНГА И ДЕКОМПОЗИЦИИ ---

function runPipeline() {
    // Очистка экрана перед новым кадром
    gl.clearRect(0, 0, canvas.width, canvas.height);
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const density = parseInt(rngDensity.value);
    const squeeze = parseInt(rngSqueeze.value) / 10;
    
    // Интеграция значений с ползунков управления
    document.getElementById('txtDensity').innerText = density;
    document.getElementById('txtSqueeze').innerText = squeeze.toFixed(1);

    // Вращение Сфирали по фазе времени
    sTime += 0.006;
    document.getElementById('telTime').innerText = sTime.toFixed(4);

    // Получение растровых данных из буферов ввода
    let pixelData = null;
    if (currentMode === 'camera' && webcam.readyState === webcam.HAVE_CURRENT_DATA) {
        bCtx.drawImage(webcam, 0, 0, 160, 120);
        pixelData = bCtx.getImageData(0, 0, 160, 120).data;
    } else if (currentMode === 'file' && loadedImgElement) {
        // Постоянно обновляем буфер кадра для стабильного считывания
        bCtx.drawImage(loadedImgElement, 0, 0, 160, 120);
        pixelData = bCtx.getImageData(0, 0, 160, 120).data;
    }

    let activeVoxels = 0;

    // Считываем радиус из математического ядра (по умолчанию 1.8)
    const currentR = SfiralCore.R_coil || 1.8;

    // Генерация дискретных пространственных вокселей Сфирали
    for (let i = 0; i < density; i++) {
        // Шаг t строго от -1.0 до +1.0 для корректной развертки
        let t = (i / (density - 1)) * 2 - 1;

        // Вызов подлинной сфиральной точки из математического ядра
        const voxel = SfiralCore.getVoxelPoint(t, sTime);

        // Проекционный коэффициент под габариты экрана
        const radiusScale = Math.min(canvas.width, canvas.height) / 3.8;
        const screenX = cx + voxel.x * radiusScale;
        const screenY = cy + voxel.y * radiusScale - (voxel.zOffset * squeeze * 32);

        let r, g, b, a;

        if (pixelData) {
            // Точный маппинг 3D координат сфирали на 2D растр пикселей ввода (160x120) с учетом R_coil
            // Сдвигаем координаты из диапазона [-R, +R] в [0, 2*R] и делим на общую ширину (2*R)
            let u = Math.floor(((voxel.x + currentR) / (currentR * 2)) * 160);
            let v = Math.floor(((voxel.y + currentR) / (currentR * 2)) * 120);
            
            // Жесткое ограничение индексов матрицы пикселей
            u = Math.max(0, Math.min(159, u));
            v = Math.max(0, Math.min(119, v));

            const idx = (v * 160 + u) * 4;
            r = pixelData[idx];
            g = pixelData[idx + 1];
            b = pixelData[idx + 2];
            
            // Физическая плотность: если пиксель абсолютно черный, воксель становится прозрачным
            const brightness = (r + g + b) / 3;
            a = brightness > 10 ? brightness / 255 : 0.05; 
        } else {
            // Применение канонического градиента
            const demoColor = SfiralCore.getDemoColor(t);
            r = demoColor.r; g = demoColor.g; b = demoColor.b; a = demoColor.a;
        }

        // Отрисовка скомпилированного вокселя
        if (a > 0.08) {
            gl.beginPath();
            let size = 3.5; 
            gl.arc(screenX, screenY, size, 0, 2 * Math.PI);
            gl.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
            gl.fill();

            // Энергетическое свечение
            gl.shadowBlur = 8;
            gl.shadowColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
            
            activeVoxels++;
        }
    }

    // Сброс тени
    gl.shadowBlur = 0;

    document.getElementById('telCount').innerText = activeVoxels;
    document.getElementById('sysStatus').innerText = "СТАТУС: СФИРАЛЬНАЯ АДРЕСАЦИЯ АКТИВНА";
    
    // Непрерывный конвейер вычислений
    requestAnimationFrame(runPipeline);
}

// Запуск топологического конвейера
runPipeline();
