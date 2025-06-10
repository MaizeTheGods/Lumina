document.addEventListener('DOMContentLoaded', () => {
    console.log('Lector de novelas (novel-detail.js) cargado y ejecutándose.');

    // --- ESTADO DE LA APLICACIÓN ---
    let novelData = {};
    let currentChapterIndex = 0;
    let settings = { theme: 'light', fontSize: 16, sidebarOpen: true };

    // --- SELECTORES DEL DOM ---
    const dom = {
        sidebar: document.getElementById('sidebar'),
        mainContent: document.getElementById('main-content'),
        sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
        settingsToggleBtn: document.getElementById('settings-toggle-btn'),
        settingsPanel: document.getElementById('settings-panel'),
        overlay: document.getElementById('overlay'),
        novelTitleSidebar: document.getElementById('novel-title-sidebar'),
        tocList: document.getElementById('toc-list'),
        chapterTitle: document.getElementById('chapter-title'),
        contentDisplay: document.getElementById('content-display'),
        prevChapterBtn: document.getElementById('prev-chapter-btn'),
        nextChapterBtn: document.getElementById('next-chapter-btn'),
        decreaseFontBtn: document.getElementById('decrease-font-btn'),
        increaseFontBtn: document.getElementById('increase-font-btn'),
        currentFontSizeSpan: document.getElementById('current-font-size'),
        themeButtons: document.querySelectorAll('.theme-btn')
    };

    // --- FUNCIONES ---

    async function fetchNovelData(novelId) {
        console.log(`Pidiendo datos al servidor para la novela con ID: ${novelId}`);
        try {
            const response = await fetch(`/api/novels/${novelId}`);
            if (!response.ok) {
                throw new Error(`El servidor respondió con un error: ${response.statusText}`);
            }
            novelData = await response.json();
            console.log('Datos de la novela recibidos:', novelData);
            initializeReader();
        } catch (error) {
            console.error('Error fatal al obtener los datos de la novela:', error);
            dom.contentDisplay.innerHTML = `<p style="color: red; text-align: center;">${error.message}</p>`;
        }
    }

    function initializeReader() {
        console.log('Inicializando el lector...');
        dom.novelTitleSidebar.textContent = novelData.title;
        populateToc();
        displayChapter(currentChapterIndex);
    }

    function populateToc() {
        dom.tocList.innerHTML = '';
        novelData.chapters.forEach((chapter, index) => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = chapter.title;
            a.dataset.index = index;
            li.appendChild(a);
            dom.tocList.appendChild(li);
        });
        console.log('Tabla de contenidos generada.');
    }

    function displayChapter(index) {
        if (!novelData.chapters || index < 0 || index >= novelData.chapters.length) {
            console.warn(`Intento de cargar capítulo inválido: índice ${index}`);
            return;
        }
        console.log(`Mostrando capítulo ${index + 1}: "${novelData.chapters[index].title}"`);
        currentChapterIndex = index;
        const chapter = novelData.chapters[index];
        dom.chapterTitle.textContent = chapter.title;
        dom.contentDisplay.innerHTML = chapter.content;

        updateTocHighlight();
        updateNavButtons();
        localStorage.setItem(`lastChapter_${getNovelId()}`, index);
    }

    function updateTocHighlight() {
        document.querySelectorAll('#toc-list a').forEach(a => {
            a.classList.remove('active');
            if (parseInt(a.dataset.index) === currentChapterIndex) {
                a.classList.add('active');
            }
        });
    }

    function updateNavButtons() {
        dom.prevChapterBtn.disabled = currentChapterIndex === 0;
        dom.nextChapterBtn.disabled = currentChapterIndex === novelData.chapters.length - 1;
    }

    function changeFontSize(change) {
        const newSize = Math.max(14, Math.min(22, settings.fontSize + change));
        settings.fontSize = newSize;
        applySettings();
        saveSettings();
    }

    function changeTheme(themeName) {
        settings.theme = themeName;
        applySettings();
        saveSettings();
    }

    function applySettings() {
        document.body.className = `theme-${settings.theme}`;
        dom.themeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === settings.theme));
        dom.contentDisplay.className = `fs-${settings.fontSize}px`;
        dom.currentFontSizeSpan.textContent = `${settings.fontSize}px`;
    }

    function saveSettings() {
        localStorage.setItem('readerSettings', JSON.stringify(settings));
    }

    function loadSettings() {
        const savedSettings = localStorage.getItem('readerSettings');
        if (savedSettings) settings = { ...settings, ...JSON.parse(savedSettings) };
        applySettings();
        toggleSidebar(settings.sidebarOpen, false);
    }

    function toggleSidebar(show, save = true) {
        settings.sidebarOpen = typeof show === 'boolean' ? show : !settings.sidebarOpen;
        dom.sidebar.classList.toggle('hidden', !settings.sidebarOpen);
        dom.mainContent.classList.toggle('sidebar-hidden', !settings.sidebarOpen);
        if (save) saveSettings();
    }
    
    function togglePanel(panel) {
        const isVisible = panel.classList.toggle('visible');
        dom.overlay.classList.toggle('visible', isVisible);
    }

    function getNovelId() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    // --- EVENT LISTENERS ---
    dom.sidebarToggleBtn.addEventListener('click', () => toggleSidebar());
    dom.settingsToggleBtn.addEventListener('click', () => togglePanel(dom.settingsPanel));
    dom.overlay.addEventListener('click', () => {
        dom.settingsPanel.classList.remove('visible');
        dom.overlay.classList.remove('visible');
    });
    dom.nextChapterBtn.addEventListener('click', () => displayChapter(currentChapterIndex + 1));
    dom.prevChapterBtn.addEventListener('click', () => displayChapter(currentChapterIndex - 1));
    dom.tocList.addEventListener('click', (e) => {
        e.preventDefault();
        if (e.target.tagName === 'A') displayChapter(parseInt(e.target.dataset.index));
    });
    dom.increaseFontBtn.addEventListener('click', () => changeFontSize(2));
    dom.decreaseFontBtn.addEventListener('click', () => changeFontSize(-2));
    dom.themeButtons.forEach(btn => btn.addEventListener('click', () => changeTheme(btn.dataset.theme)));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') displayChapter(currentChapterIndex + 1);
        if (e.key === 'ArrowLeft') displayChapter(currentChapterIndex - 1);
    });

    // --- PUNTO DE INICIO ---
    function init() {
        console.log('Iniciando lector...');
        loadSettings();
        const novelId = getNovelId();
        console.log('ID de la novela obtenido de la URL:', novelId);

        if (!novelId) {
            console.error('No se encontró ID en la URL. Deteniendo ejecución.');
            dom.contentDisplay.innerHTML = `<p style="color: red; text-align: center; font-size: 1.2em;"><strong>Error:</strong> No se ha especificado una novela para cargar. Por favor, vuelve a la biblioteca y selecciona una.</p>`;
            return;
        }

        const lastChapter = localStorage.getItem(`lastChapter_${novelId}`);
        if(lastChapter) currentChapterIndex = parseInt(lastChapter);

        fetchNovelData(novelId);
    }

    init();
});