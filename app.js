/**
 * GIDEON Core Voxelize — Главный координатор приложения c 3D-интерактивностью и экспортом
 */

// Селекторы элементов DOM
const canvas = document.getElementById('viewportCanvas');
const gl = canvas.getContext('2d');
const bufferCanvas = document.getElementById('bufferCanvas');
const bCtx = bufferCanvas.getContext('2d');
const webcam = document.getElementById('webcam');

const btnCam = document.getElementById('btnCam');
const btnSnap = document.getElementById('btnSnap');
const btnDemo = document.getElementById('btnDemo');
const fileLoad = document.getElementById('fileLoad');
const btnExport = document.getElementById('btnExport');

const rngDensity = document.getElementById('rngDensity');
const rngSqueeze = document.getElementById('rngSqueeze');

// Состояние приложения
let currentMode = 'demo'; 
let sTime = 0;
let loadedImgElement = null;

// ПЕРЕМЕННЫЕ ДЛЯ 3D ИНТЕРАКТИВА
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let userRotation = { x: 0.3, y: 0 }; 
let autoRotateSpeed = 0.006; 

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
    autoRotateSpeed = 0; 
});

window.addEventListener('mouseup', () => { isDragging = false; });

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    userRotation.y += deltaX * 0.01;
    userRotation.x += deltaY * 0.01;
    userRotation.x = Math.max(-1.4, Math.min(1.4, userRotation.x));
    previousMousePosition = { x: e.clientX, y: e.clientY };
});

// --- ОБРАБОТЧИКИ ПОТОКОВ ДАННЫХ ---

function setMode(modeName, labelText) {
    currentMode = modeName;
    document.getElementById('telMode').innerText = labelText.toUpperCase();
    document.querySelectorAll('.gideon-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('sysStatus').innerText = `СТАТУС: ПОТОК [${labelText.toUpperCase()}]`;
    autoRotateSpeed = 0.006;
}

btnDemo.addEventListener('click', () => {
    setMode('demo', 'synthetic_pattern');
    btnDemo.classList.add('active');
    webcam.style.display = 'none';
    bufferCanvas.style.display = 'none';
    btnSnap.style.display = 'none';
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
        btnSnap.style.display = 'block'; 
        setMode('camera', 'sensor_stream');
        btnCam.classList.add('active');
    } catch (err) {
        document.getElementById('sysStatus').innerText = "ОШИБКА: НЕТ ДОСТУПА К СЕНСОРУ";
    }
});

btnSnap.addEventListener('click', () => {
    if (webcam.readyState >= 2) {
        bCtx.clearRect(0, 0, 160, 120);
        bCtx.drawImage(webcam, 0, 0, 160, 120);
        
        const img = new Image();
        img.onload = () => {
            loadedImgElement = img;
            bufferCanvas.style.display = 'block';
            webcam.style.display = 'none';
            setMode('file', 'sensor_snapshot'); 
        };
        img.src = bufferCanvas.toDataURL('image/png'); 
    }
});

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
            btnSnap.style.display = 'none';
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

    sTime += autoRotateSpeed;
    document.getElementById('telTime').innerText = sTime.toFixed(4);

    let pixelData = null;
    if (currentMode === 'file' && loadedImgElement) {
        bCtx.clearRect(0, 0, 160, 120);
        bCtx.drawImage(loadedImgElement, 0, 0, 160, 120);
        pixelData = bCtx.getImageData(0, 0, 160, 120).data;
    }

    let activeVoxels = 0;
    const currentR = SfiralCore.R_coil || 1.8;

    for (let i = 0; i < density; i++) {
        let t = (i / (density - 1)) * 2 - 1;

        const voxel = SfiralCore.getVoxelPoint(t, sTime, userRotation.x, userRotation.y);

        const radiusScale = Math.min(canvas.width, canvas.height) / 3.8;
        const screenX = cx + voxel.x * radiusScale;
        const screenY = cy + voxel.y * radiusScale - (t * squeeze * 32 * Math.cos(userRotation.x));

        let r, g, b, a;

        if (pixelData && pixelData !== undefined && pixelData.length > 0) {
            let u = Math.floor(((currentR - voxel.x) / (currentR * 2)) * 160);
            let v = Math.floor(((voxel.y + currentR) / (currentR * 2)) * 120);
            
            u = Math.max(0, Math.min(159, u));
            v = Math.max(0, Math.min(119, v));

            const idx = (v * 160 + u) * 4;
            r = pixelData[idx];
            g = pixelData[idx + 1];
            b = pixelData[idx + 2];
            a = 1.0; 
            
            const brightness = (r + g + b) / 3;
            if (brightness < 15) {
                const demoColor = SfiralCore.getDemoColor(t);
                r = demoColor.r; g = demoColor.g; b = demoColor.b; a = 0.2; 
            }
        } else {
            const demoColor = SfiralCore.getDemoColor(t);
            r = demoColor.r; g = demoColor.g; b = demoColor.b; a = demoColor.a;
        }

        if (a > 0.05) {
            gl.beginPath();
            gl.arc(screenX, screenY, 3.5, 0, 2 * Math.PI);
            gl.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
            gl.fill();

            gl.shadowBlur = 8;
            gl.shadowColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
            activeVoxels++;
        }
    }

    gl.shadowBlur = 0;
    document.getElementById('telCount').innerText = activeVoxels;
    
    requestAnimationFrame(runPipeline);
}

// --- ФУНКЦИЯ ЭКСПОРТА МАТРИЦЫ В ФАЙЛ ДЛЯ BLENDER ---
function exportToOBJ() {
    const density = parseInt(rngDensity.value);
    const squeeze = parseInt(rngSqueeze.value) / 10;
    const currentR = SfiralCore.R_coil || 1.8;
    
    let pixelData = null;
    if (currentMode === 'file' && loadedImgElement) {
        pixelData = bCtx.getImageData(0, 0, 160, 120).data;
    }

    let objText = "# GIDEON Core Matrix Export\n# Топология Сфирали Времени\n";
    
    for (let i = 0; i < density; i++) {
        let t = (i / (density - 1)) * 2 - 1;
        
        // Экспортируем статическую чистую Сфираль без учета вращения мыши пользователя
        const voxel = SfiralCore.getVoxelPoint(t, 0, 0, 0); 
        
        // Интегрируем шаг S-Squeeze в чистую физическую координату Z
        let x = voxel.x;
        let y = voxel.y;
        let z = t * squeeze;

        let r = 0, g = 255, b = 204; // Дефолтные цвета

        if (pixelData) {
            let u = Math.floor(((currentR - voxel.x) / (currentR * 2)) * 160);
            let v = Math.floor(((voxel.y + currentR) / (currentR * 2)) * 120);
            u = Math.max(0, Math.min(159, u));
            v = Math.max(0, Math.min(119, v));

            const idx = (v * 160 + u) * 4;
            r = pixelData[idx];
            g = pixelData[idx + 1];
            b = pixelData[idx + 2];
        } else {
            const demoColor = SfiralCore.getDemoColor(t);
            r = demoColor.r; g = demoColor.g; b = demoColor.b;
        }

        // Переводим RGB в нормализованный вид для формата OBJ (от 0.0 до 1.0)
        let rNorm = (r / 255).toFixed(4);
        let gNorm = (g / 255).toFixed(4);
        let bNorm = (b / 255).toFixed(4);

        // Строка вершины в формате OBJ: v X Y Z R G B
        objText += `v ${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)} ${rNorm} ${gNorm} ${bNorm}\n`;
    }

    // Создаем ссылку для немедленного скачивания файла браузером
    const blob = new Blob([objText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sfiral_matrix_${currentMode}_${Date.now()}.obj`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Привязка функции экспорта к кнопке
btnExport.addEventListener('click', exportToOBJ);

// Старт
runPipeline();
