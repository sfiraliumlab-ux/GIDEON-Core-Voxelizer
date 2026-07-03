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
    const file = e.target.files;
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            loadedImgElement = img;
            bufferCanvas.style.display = 'block';
            webcam.style.display = 'none';
            bCtx.drawImage(img, 0, 0, 160, 120);
            setMode('file', 'file_buffer');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// --- ГЛАВНЫЙ ЦИКЛ РЕНДЕРИНГА И ДЕКОМПОЗИЦИИ ---

function runPipeline() {
    // Очистка экрана
    gl.clearRect(0, 0, canvas.width, canvas.height);
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const density = parseInt(rngDensity.value);
    const squeeze = parseInt(rngSqueeze.value) / 10;
    
    // Обновление интерфейса управления
    document.getElementById('txtDensity').innerText = density;
    document.getElementById('txtSqueeze').innerText = squeeze.toFixed(1);

    sTime += 0.006;
    document.getElementById('telTime').innerText = sTime.toFixed(4);

    // Извлечение пикселей из буфера при наличии медиапотока
    let pixelData = null;
    if (currentMode === 'camera' && webcam.readyState === webcam.HAVE_CURRENT_DATA) {
        bCtx.drawImage(webcam, 0, 0, 160, 120);
        pixelData = bCtx.getImageData(0, 0, 160, 120).data;
    } else if (currentMode === 'file' && loadedImgElement) {
        pixelData = bCtx.getImageData(0, 0, 160, 120).data;
    }

    let activeVoxels = 0;

    // Цикл пространственного распределения по сфирали
    for (let i = 0; i < density; i++) {
        // Шаг t строго от -1.0 до +1.0 для корректной развертки
        let t = (i / (density - 1)) * 2 - 1;

        // Получение точной 3D точки Сфирали из обновленного математического ядра автора
        const voxel = SfiralCore.getVoxelPoint(t, sTime);

        // Проекция 3D -> 2D экрана
        const radiusScale = Math.min(canvas.width, canvas.height) / 3.4;
        const screenX = cx + voxel.x * radiusScale;
        const screenY = cy + voxel.y * radiusScale - (voxel.zOffset * squeeze * 28);

        // Определение цвета вокселя
        let r, g, b, a;

        if (pixelData) {
            // Маппинг 3D координат сфирали на 2D сетку пикселей буфера (160x120)
            let u = Math.floor(((voxel.x + 1.5) / 3) * 160);
            let v = Math.floor(((voxel.y + 1.5) / 3) * 120);
            
            u = Math.max(0, Math.min(159, u));
            v = Math.max(0, Math.min(119, v));

            const idx = (v * 160 + u) * 4;
            r = pixelData[idx];
            g = pixelData[idx + 1];
            b = pixelData[idx + 2];
            
            // Альфа-канал зависит от спектральной яркости пикселя
            const brightness = (r + g + b) / 3;
            a = brightness / 255;
        } else {
            // Цвета по умолчанию из демо-каркаса
            const demoColor = SfiralCore.getDemoColor(t);
            r = demoColor.r; g = demoColor.g; b = demoColor.b; a = demoColor.a;
        }

        // Рендеринг активного вокселя
        if (a > 0.08) {
            gl.beginPath();
            let size = voxel.isCenter ? 5.5 : 3.5;
            gl.arc(screenX, screenY, size, 0, 2 * Math.PI);
            gl.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
            gl.fill();

            // Эффект свечения для S-узла (центра инверсии)
            if (voxel.isCenter) {
                gl.shadowBlur = 12;
                gl.shadowColor = "rgba(0, 255, 204, 0.7)";
            } else {
                gl.shadowBlur = 0;
            }
            activeVoxels++;
        }
    }

    document.getElementById('telCount').innerText = activeVoxels;
    document.getElementById('sysStatus').innerText = "СТАТУС: СФИРАЛЬНАЯ АДРЕСАЦИЯ АКТИВНА";
    
    requestAnimationFrame(runPipeline);
}

// Старт конвейера
runPipeline();
