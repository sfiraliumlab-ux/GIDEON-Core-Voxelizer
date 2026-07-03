/**
 * GIDEON Core Voxelize — Главный координатор приложения c 3D-интерактивностью
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
let currentMode = 'demo'; 
let sTime = 0;
let loadedImgElement = null;

// ПЕРЕМЕННЫЕ ДЛЯ 3D ИНТЕРАКТИВА (МЫШЬ И ТАЧ)
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let userRotation = { x: 0.3, y: 0 }; // Стартовый угол наклона для красивого объема
let autoRotateSpeed = 0.006; // Скорость авто-вращения

// Синхронизация размеров холста
function initViewport() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}
window.addEventListener('resize', initViewport);
initViewport();

// --- СИСТЕМА УПРАВЛЕНИЯ КАДРОМ (MOUSE & TOUCH TRACKING) ---

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
    autoRotateSpeed = 0; // Останавливаем авто-вращение при ручном просмотре
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    // Переводим движение мыши в радианы поворота
    userRotation.y += deltaX * 0.01;
    userRotation.x += deltaY * 0.01;

    // Ограничиваем вертикальный переворот, чтобы голова не кружилась (в пределах 85 градусов)
    userRotation.x = Math.max(-1.4, Math.min(1.4, userRotation.x));

    previousMousePosition = { x: e.clientX, y: e.clientY };
});

// Поддержка мобильных экранов (тач-события)
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        autoRotateSpeed = 0;
    }
});

canvas.addEventListener('touchend', () => { isDragging = false; });

canvas.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - previousMousePosition.x;
    const deltaY = e.touches[0].clientY - previousMousePosition.y;
    userRotation.y += deltaX * 0.01;
    userRotation.x += deltaY * 0.01;
    userRotation.x = Math.max(-1.4, Math.min(1.4, userRotation.x));
    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
});


// --- ОБРАБОТЧИКИ ПОТОКОВ ДАННЫХ ---

function setMode(modeName, labelText) {
    currentMode = modeName;
    document.getElementById('telMode').innerText = labelText.toUpperCase();
    document.querySelectorAll('.gideon-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('sysStatus').innerText = `СТАТУС: ПОТОК [${labelText.toUpperCase()}]`;
    // Возвращаем легкое авто-вращение при переключении режимов
    autoRotateSpeed = 0.006;
}

btnDemo.addEventListener('click', () => {
    setMode('demo', 'synthetic_pattern');
    btnDemo.classList.add('active');
    webcam.style.display = 'none';
    bufferCanvas.style.display = 'none';
    if (webcam.srcObject) {
        webcam.srcObject.getTracks().forEach(t => t.stop());
    }
});

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

fileLoad.addEventListener('change', (e) => {
    const file = e.target.files[0]; 
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            loadedImgElement = img;
            bufferCanvas.style.display = 'block';
            webcam.style.display = 'none';
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
    gl.clearRect(0, 0, canvas.width, canvas.height);
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const density = parseInt(rngDensity.value);
    const squeeze = parseInt(rngSqueeze.value) / 10;
    
    document.getElementById('txtDensity').innerText = density;
    document.getElementById('txtSqueeze').innerText = squeeze.toFixed(1);

    // Прибавляем время только если включено авто-вращение
    sTime += autoRotateSpeed;
    document.getElementById('telTime').innerText = sTime.toFixed(4);

    let pixelData = null;
    if (currentMode === 'camera' && webcam.readyState === webcam.HAVE_CURRENT_DATA) {
        bCtx.drawImage(webcam, 0, 0, 160, 120);
        pixelData = bCtx.getImageData(0, 0, 160, 120).data;
    } else if (currentMode === 'file' && loadedImgElement) {
        bCtx.drawImage(loadedImgElement, 0, 0, 160, 120);
        pixelData = bCtx.getImageData(0, 0, 160, 120).data;
    }

    let activeVoxels = 0;
    const currentR = SfiralCore.R_coil || 1.8;

    // Генерируем массив точек
    for (let i = 0; i < density; i++) {
        let t = (i / (density - 1)) * 2 - 1;

        // ПЕРЕДАЕМ НАШИ КООРДИНАТЫ МЫШИ В ЯДРО ДЛЯ РАСЧЕТА СФИРАЛИ В 3D ПРОСТРАНСТВЕ
        const voxel = SfiralCore.getVoxelPoint(t, sTime, userRotation.x, userRotation.y);

        // Масштабирование и финальная проекция на экран
        const radiusScale = Math.min(canvas.width, canvas.height) / 3.8;
        const screenX = cx + voxel.x * radiusScale;
        
        // ВАЖНО: В этой версии ось высоты Z интегрирована внутрь матрицы ядра, 
        // поэтому squeeze применяется к исходной глубине, делая наклон физически корректным
        const screenY = cy + voxel.y * radiusScale - (t * squeeze * 32 * Math.cos(userRotation.x));

        let r, g, b, a;

        if (pixelData) {
            // Маппинг 3D-вокселей на 2D-растр
            let u = Math.floor(((voxel.x + currentR) / (currentR * 2)) * 160);
            let v = Math.floor(((voxel.y + currentR) / (currentR * 2)) * 120);
            
            u = Math.max(0, Math.min(159, u));
            v = Math.max(0, Math.min(119, v));

            const idx = (v * 160 + u) * 4;
            r = pixelData[idx];
            g = pixelData[idx + 1];
            b = pixelData[idx + 2];
            
            const brightness = (r + g + b) / 3;
            a = brightness > 10 ? brightness / 255 : 0.05; 
        } else {
            const demoColor = SfiralCore.getDemoColor(t);
            r = demoColor.r; g = demoColor.g; b = demoColor.b; a = demoColor.a;
        }

        if (a > 0.08) {
            gl.beginPath();
            let size = 3.5; 
            gl.arc(screenX, screenY, size, 0, 2 * Math.PI);
            gl.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
            gl.fill();

            gl.shadowBlur = 8;
            gl.shadowColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
            
            activeVoxels++;
        }
    }

    gl.shadowBlur = 0;
    document.getElementById('telCount').innerText = activeVoxels;
    document.getElementById('sysStatus').innerText = isDragging ? "СТАТУС: ИНТЕРАКТИВНЫЙ АНАЛИЗ МАТРИЦЫ" : "СТАТУС: СФИРАЛЬНАЯ АДРЕСАЦИЯ АКТИВНА";
    
    requestAnimationFrame(runPipeline);
}

runPipeline();
