// Carga dinámica de metadatos y portada en novel-detail.html
window.onerror = function(msg, url, line, col, error) {
    console.error('Error JS:', msg, '\nArchivo:', url, '\nLinea:', line, '\nColumna:', col, error ? '\n' + error.stack : '');
    showErrorToast('Error en la aplicación: ' + msg);
    return false;
};

function showErrorToast(message) {
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 8px;
        color: white;
        background: #dc3545;
        z-index: 9999;
        animation: fadeInOut 3s ease-in-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function getLuminaUser() {
    return localStorage.getItem('luminaUser') || 'Anónimo';
}

let epubFile = null;
let bookRendition = null; // Stores the ePub.js rendition object
let currentFontSize = 100; // Default font size percentage (e.g., 100%)
try {
    const params = new URLSearchParams(window.location.search);
    epubFile = params.get('file');
    if (!epubFile) {
        throw new Error('No se encontró el parámetro "file" en la URL');
    }
} catch (err) {
    console.error('Error al leer parámetros de la URL:', err);
    document.body.innerHTML = `
        <div style="color:crimson; font-weight:bold; text-align:center; margin:32px;">
            Error: ${err.message}. Abre esta página desde el catálogo de novelas.
        </div>`;
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!epubFile) return;

    // --- Comentarios dinámicos ---
    const commentsList = document.querySelector('.comments-list');
    const commentForm = document.getElementById('comment-form');
    const commentTextarea = document.getElementById('comment-text');

    async function cargarComentarios() {
        if (!commentsList) return;
        
        commentsList.innerHTML = '<div style="color:#7A89D1;">Cargando comentarios...</div>';
        try {
            const res = await fetch(`/api/novel/${encodeURIComponent(epubFile)}/comments`);
            if (!res.ok) {
                throw new Error(`Error HTTP: ${res.status}`);
            }
            const comments = await res.json();
            
            if (!Array.isArray(comments)) {
                throw new Error('Formato de comentarios inválido');
            }

            if (!comments.length) {
                commentsList.innerHTML = '<div style="color:#b0b5d6;">Sé el primero en dejar un comentario estelar.</div>';
                return;
            }

            commentsList.innerHTML = '<h4>Comentarios Anteriores</h4>' + comments.map(c => {
                if (!c || typeof c !== 'object') return '';
                return `<article class="comment-item">
                    <div class="comment-meta">
                        <span class="comment-user">${escapeHtml(c.user || 'Anónimo')}</span> · 
                        <span class="comment-date">${formatoFecha(c.timestamp)}</span>
                    </div>
                    <div class="comment-text">${escapeHtml(c.text || '')}</div>
                </article>`;
            }).join('');
        } catch (err) {
            console.error('Error al cargar comentarios:', err);
            commentsList.innerHTML = '<div style="color:crimson;">Error al cargar comentarios: ' + err.message + '</div>';
        }
    }

    if (commentForm) {
        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = commentTextarea.value.trim();
            if (!text) {
                showErrorToast('El comentario no puede estar vacío');
                return;
            }

            commentTextarea.disabled = true;
            const submitBtn = commentForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            try {
                const res = await fetch(`/api/novel/${encodeURIComponent(epubFile)}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text, 
                        user: getLuminaUser() 
                    })
                });

                if (!res.ok) {
                    throw new Error(`Error HTTP: ${res.status}`);
                }

                const data = await res.json();
                if (!data || typeof data !== 'object') {
                    throw new Error('Respuesta del servidor inválida');
                }

                commentTextarea.value = '';
                await cargarComentarios();
            } catch (err) {
                console.error('Error al enviar comentario:', err);
                showErrorToast('Error al enviar comentario: ' + err.message);
            } finally {
                commentTextarea.disabled = false;
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // Cargar metadatos de la novela
    try {
        const res = await fetch('/api/novel/' + encodeURIComponent(epubFile));
        if (!res.ok) {
            throw new Error(`Error HTTP: ${res.status}`);
        }
        const meta = await res.json();
        
        if (!meta || typeof meta !== 'object') {
            throw new Error('Formato de metadatos inválido');
        }

        // Actualizar UI con metadatos
        const coverImg = document.getElementById('novel-cover');
        if (coverImg) {
            coverImg.src = meta.cover || '';
            coverImg.alt = `Portada de ${meta.title || 'la novela'}`;
        }

        const titleElement = document.getElementById('novel-title');
        if (titleElement) {
            titleElement.textContent = meta.title || 'Sin título';
        }

        const authorElement = document.getElementById('novel-author');
        if (authorElement) {
            authorElement.textContent = meta.author || 'Desconocido';
        }

        const genreElement = document.getElementById('novel-genre');
        if (genreElement) {
            genreElement.textContent = meta.genre ? 'Género: ' + meta.genre : '';
        }

        const synopsisElement = document.getElementById('novel-synopsis');
        if (synopsisElement) {
            synopsisElement.textContent = meta.synopsis || '';
        }

        // Actualizar capítulos
        const chaptersSection = document.querySelector('.novel-chapters');
        if (chaptersSection && meta.chapters && Array.isArray(meta.chapters)) {
            const chapterList = document.getElementById('chapter-list');
            if (chapterList) {
                if (!meta.chapters.length) {
                    chapterList.innerHTML = '<li>No se encontraron capítulos en este EPUB.</li>';
                } else {
                    chapterList.innerHTML = meta.chapters.map((ch, i) => `
                        <li>
                            <a href="#" data-chapter="${i}" tabindex="0" 
                               aria-label="${ch.label || 'Capítulo ' + (i+1)}">
                                ${ch.label || 'Capítulo ' + (i+1)}
                            </a>
                        </li>
                    `).join('');

                    // Eventos de clic en capítulos
                    chaptersSection.querySelectorAll('a[data-chapter]').forEach(link => {
                        link.addEventListener('click', e => {
                            e.preventDefault();
                            const idx = Number(link.getAttribute('data-chapter'));
                            if (!isNaN(idx)) {
                                abrirLectorEpub(epubFile, meta.title, idx);
                            }
                        });
                    });
                }
            }
        }

        // Cargar comentarios
        await cargarComentarios();

    } catch (err) {
        console.error('Error al cargar metadatos:', err);
        showErrorToast('Error al cargar la información de la novela: ' + err.message);
    }

    // Preparar para lector EPUB (primer capítulo)
    const detailSection = document.querySelector('.novel-info-main');
    const readBtn = detailSection.querySelector('.btn-primary');
    if (readBtn) {
        readBtn.addEventListener('click', (e) => {
            e.preventDefault();
            abrirLectorEpub(epubFile, meta.title, 0);
        });
    }

    // Quitar likes, vistas y ratings falsos
    const fakeLikes = document.querySelector('.novel-likes');
    if (fakeLikes) fakeLikes.remove();
    const fakeRating = document.querySelector('.novel-rating');
    if (fakeRating) fakeRating.remove();
    // Si hay vistas o stats falsos, también quitarlos
    const fakeStats = document.querySelector('.novel-stats');
    if (fakeStats) fakeStats.remove();
});

function abrirLectorEpub(filename, title, chapterIndex) {
    let panel = document.getElementById('epub-reader-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'epub-reader-panel';
        document.body.appendChild(panel);
    }
    panel.innerHTML = `
    <div id="epub-reader-fade" role="dialog" aria-modal="true" aria-label="Lector EPUB">
        <div class="epub-reader-panel-content" tabindex="-1">
            <div class="epub-reader-header">
                <h3 id="epub-chapter-title">${title}</h3>
                <button id="close-epub-reader" aria-label="Cerrar lector">&times;</button>
            </div>
            <div class="epub-reader-navigation">
                <button id="epub-prev" class="btn" aria-label="Capítulo anterior">&lt; Anterior</button>
                <span id="epub-current-label">Cargando...</span>
                <button id="epub-next" class="btn" aria-label="Siguiente capítulo">Siguiente &gt;</button>
            </div>
            <div class="epub-reader-controls">
                <div class="epub-control-group">
                    <label for="epub-theme-select">Tema:</label>
                    <select id="epub-theme-select" class="btn">
                        <option value="default">Claro</option>
                        <option value="dark">Oscuro</option>
                        <option value="sepia">Sepia</option>
                    </select>
                </div>
                <div class="epub-control-group epub-font-controls">
                    <span class="epub-font-label">Fuente:</span>
                    <button id="epub-font-decrease" class="btn" aria-label="Disminuir tamaño de fuente">A-</button>
                    <span id="epub-font-size-display">${currentFontSize}%</span>
                    <button id="epub-font-increase" class="btn" aria-label="Aumentar tamaño de fuente">A+</button>
                </div>
            </div>
            <div id="epubjs-viewer"></div>
        </div>
    </div>`;

    const closeBtnElement = document.getElementById('close-epub-reader');
    if (closeBtnElement) closeBtnElement.onclick = cerrarPanel;
    
    document.addEventListener('keydown', escCerrarGeneral, { once: true });

    // Focus trap para accesibilidad
    setTimeout(() => {
        if (closeBtnElement) closeBtnElement.focus();
        const trap = document.getElementById('epub-reader-fade');
        if (trap) {
            trap.tabIndex = -1;
            trap.focus();
            // Focus trap keydown listener specific to the panel
            trap.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    cerrarPanel();
                }
                const focusable = trap.querySelectorAll('button, [tabindex="0"], select');
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.key === 'Tab') {
                    if (e.shiftKey) {
                        if (document.activeElement === first) {
                            e.preventDefault();
                            last.focus();
                        }
                    } else {
                        if (document.activeElement === last) {
                            e.preventDefault();
                            first.focus();
                        }
                    }
                }
            });
        }
    }, 100);

    // --- Reader Controls Event Listeners ---
    const themeSelect = document.getElementById('epub-theme-select');
    const fontDecreaseBtn = document.getElementById('epub-font-decrease');
    const fontIncreaseBtn = document.getElementById('epub-font-increase');
    const fontSizeDisplay = document.getElementById('epub-font-size-display');

    if (fontSizeDisplay) fontSizeDisplay.textContent = currentFontSize + '%';

    if (themeSelect) {
        themeSelect.addEventListener('change', function() {
            if (bookRendition) {
                bookRendition.themes.select(this.value);
                localStorage.setItem('epubReaderTheme', this.value);
            }
        });
    }

    if (fontDecreaseBtn) {
        fontDecreaseBtn.addEventListener('click', function() {
            if (bookRendition && currentFontSize > 50) { // Min font size 50%
                currentFontSize -= 10;
                bookRendition.themes.fontSize(currentFontSize + '%');
                if (fontSizeDisplay) fontSizeDisplay.textContent = currentFontSize + '%';
                localStorage.setItem('epubReaderFontSize', currentFontSize);
            }
        });
    }

    if (fontIncreaseBtn) {
        fontIncreaseBtn.addEventListener('click', function() {
            if (bookRendition && currentFontSize < 200) { // Max font size 200%
                currentFontSize += 10;
                bookRendition.themes.fontSize(currentFontSize + '%');
                if (fontSizeDisplay) fontSizeDisplay.textContent = currentFontSize + '%';
                localStorage.setItem('epubReaderFontSize', currentFontSize);
            }
        });
    }
    // --- End Reader Controls Event Listeners ---

    // Cargar Epub.js si no existe
    if (!window.ePub) {
        // Usar la copia local de Epub.js
        loadScript('/js/libs/epub.js', 'ePub', () => mostrarEpub(filename, chapterIndex));
    } else {
        mostrarEpub(filename, chapterIndex);
    }

    function cerrarPanel() {
        document.removeEventListener('keydown', escCerrarGeneral);
        const fade = document.getElementById('epub-reader-fade');
        if (fade) {
            fade.style.animation = 'fadeOutPanel 0.22s';
            setTimeout(() => { 
                if (panel) panel.innerHTML = ''; 
                if (bookRendition) { // Destroy rendition to free resources
                    bookRendition.destroy();
                    bookRendition = null;
                }
            }, 200);
        } else if (panel) {
            panel.innerHTML = '';
        }
    }
    // This listener is general for the page, might be better scoped or removed if panel handles its own escape
    function escCerrarGeneral(e) { 
        if (e.key === 'Escape') cerrarPanel();
    }
}

function loadScript(src, libraryGlobalName, callback) {
    if (window[libraryGlobalName]) {
        console.log(`${libraryGlobalName} already available globally.`);
        if (callback) callback();
        return;
    }

    const baseSrc = src.split('?')[0];
    const existingScript = document.querySelector(`script[src^="${baseSrc}"]`);
    if (existingScript) {
        console.warn(`Removing existing script tag for ${baseSrc} to attempt a fresh load as ${libraryGlobalName} was not found.`);
        existingScript.remove();
    }

    const script = document.createElement('script');
    const srcWithCacheBuster = `${baseSrc}?t=${Date.now()}`;
    script.src = srcWithCacheBuster;
    document.head.appendChild(script);

    script.onload = () => {
        console.log(`${srcWithCacheBuster} loaded successfully. Checking for ${libraryGlobalName}.`);
        if (window[libraryGlobalName]) {
            if (callback) callback();
        } else {
            console.error(`${libraryGlobalName} not found globally after loading ${srcWithCacheBuster}.`);
            // Consider updating UI to inform the user about the script loading failure.
            if (document.getElementById('epubjs-viewer')) {
                 document.getElementById('epubjs-viewer').innerHTML = `<div style='padding:20px; text-align:center; color:crimson;'>Error crítico: No se pudo cargar la librería del lector EPUB (${libraryGlobalName}).</div>`;
            }
        }
    };
    script.onerror = () => {
        console.error(`Error loading script ${srcWithCacheBuster}`);
        if (document.getElementById('epubjs-viewer')) {
            document.getElementById('epubjs-viewer').innerHTML = `<div style='padding:20px; text-align:center; color:crimson;'>Error crítico: Falló la carga de ${srcWithCacheBuster}.</div>`;
        }
    };
}

async function mostrarEpub(filename, chapterIndex) {
    const viewerElement = document.getElementById('epubjs-viewer');
    const chapterTitleElement = document.getElementById('epub-chapter-title');
    const currentLabelElement = document.getElementById('epub-current-label');
    const prevBtn = document.getElementById('epub-prev');
    const nextBtn = document.getElementById('epub-next');

    if (!viewerElement || !chapterTitleElement || !currentLabelElement || !prevBtn || !nextBtn) {
        console.error('Uno o más elementos de la interfaz del lector EPUB no se encontraron.');
        if (viewerElement) viewerElement.innerHTML = '<div style="padding:20px; text-align:center; color:crimson;">Error: Elementos de UI faltantes.</div>';
        return;
    }
    viewerElement.innerHTML = '<div style="padding:20px; text-align:center; color:var(--color-primary-dark);">Cargando libro...</div>';
    console.log('[mostrarEpub] Called with filename:', filename);

    try {
        if (!filename) {
            console.error('[mostrarEpub] Error: filename is undefined or null.');
            viewerElement.innerHTML = '<div style="padding:20px; text-align:center; color:crimson;">Error: No se especificó el archivo del libro.</div>';
            return;
        }
        const bookPath = `/uploads/${encodeURIComponent(filename)}?t=${Date.now()}`;
        console.log('[Epub.js] Attempting to load book from path (with cache buster):', bookPath);
        const book = ePub(bookPath);
        console.log('[Epub.js] Book object created:', book);

        // DEPURACIÓN: listeners y logs adicionales
        book.on('book:opened', () => {
            console.log('[Epub.js] EVENT: book:opened');
        });
        book.on('book:ready', () => {
            console.log('[Epub.js] EVENT: book:ready');
        });
        book.on('error', (err) => {
            console.error('[Epub.js] EVENT: error', err);
        });
        book.opened.then(() => {
            console.log('[Epub.js] book.opened PROMISE RESOLVED');
        }).catch((err) => {
            console.error('[Epub.js] book.opened PROMISE REJECTED', err);
        });

        // Timeout para mostrar error si EPUB.js no responde
        let openedResolved = false;
        const timeoutMs = 7000;
        const timeoutId = setTimeout(() => {
            if (!openedResolved) {
                console.error('[Epub.js] Timeout: El libro no se abrió en el tiempo esperado.');
                if (viewerElement) {
                    viewerElement.innerHTML = `<div style='padding:20px; text-align:center; color:crimson;'>Error: El libro no pudo abrirse. Puede que el archivo esté dañado o no sea compatible.<br>Intenta con otro EPUB o revisa la consola para más detalles.</div>`;
                }
                if (prevBtn) prevBtn.disabled = true;
                if (nextBtn) nextBtn.disabled = true;
                if (currentLabelElement) currentLabelElement.textContent = 'Error';
            }
        }, timeoutMs);

        // Esperar a que book.opened se resuelva o rechace
        try {
            const openResult = await book.opened;
            openedResolved = true;
            clearTimeout(timeoutId);
            console.log('[Epub.js] book.opened resolved. Type:', typeof openResult, 'Value:', openResult);
        } catch (err) {
            openedResolved = true;
            clearTimeout(timeoutId);
            console.error('[Epub.js] book.opened FAILED:', err);
            if (viewerElement) viewerElement.innerHTML = `<div style='padding:20px; text-align:center; color:crimson;'>Error al abrir el libro: ${err.message || 'Error desconocido'}</div>`;
            return;
        }

        console.log('[Epub.js] Awaiting book.ready...');
        try {
            await book.ready;
            console.log('[Epub.js] book.ready resolved!');
        } catch (err) {
            console.error('[Epub.js] book.ready FAILED or REJECTED:', err);
            if (viewerElement) viewerElement.innerHTML = `<div style='padding:20px; text-align:center; color:crimson;'>Error al procesar estructura del libro: ${err.message || 'Error desconocido'}</div>`;
            return; 
        }
        
        console.log('[Epub.js] Waiting for book.loaded.navigation (TOC)...');
        const toc = await book.loaded.navigation;
        console.log('[Epub.js] TOC loaded:', toc);

        const updateChapterUI = (location) => {
            if (!location || !location.start) return;
            const current = book.spine.get(location.start.cfi);
            let label = 'Inicio del libro';
            if (current && current.href) {
                const tocItem = toc.toc.find(item => item.href.includes(current.href.split('/').pop()));
                label = tocItem ? tocItem.label.trim() : (current.index !== undefined ? `Capítulo ${current.index + 1}` : 'Sección actual');
            }
            currentLabelElement.textContent = label;
            chapterTitleElement.textContent = label; 
            prevBtn.disabled = location.atStart;
            nextBtn.disabled = location.atEnd;
        };

        bookRendition = book.renderTo(viewerElement, {
            width: '100%',
            height: '100%',
            flow: 'paginated', // paginated or scrolled-doc
            spread: 'auto',    // auto, none, always
            manager: 'default' // default or continuous
        });

        // Register custom themes
        bookRendition.themes.register('dark', {
            'body': { 'color': '#E0E0E0', 'background-color': '#121212' },
            'a': { 'color': '#BB86FC', 'text-decoration': 'underline' },
            'a:hover': { 'color': '#cf9fff' },
            'p, li, h1, h2, h3, h4, h5, h6, span, div': { 'color': '#E0E0E0 !important' }
        });
        bookRendition.themes.register('sepia', {
            'body': { 'color': '#5B4636', 'background-color': '#FBF0D9' },
            'a': { 'color': '#705A48', 'text-decoration': 'underline' },
            'a:hover': { 'color': '#8a6f5a' },
            'p, li, h1, h2, h3, h4, h5, h6, span, div': { 'color': '#5B4636 !important' }
        });
        bookRendition.themes.register('default', {
            'body': { 'color': 'inherit', 'background-color': 'inherit' },
            'a': { 'color': 'inherit' },
            'p, li, h1, h2, h3, h4, h5, h6, span, div': { 'color': 'inherit !important' }
        });
        
        // Apply initial font size and selected theme (default if nothing stored)
        const storedTheme = localStorage.getItem('epubReaderTheme') || 'default';
        bookRendition.themes.select(storedTheme);
        const themeSelectElement = document.getElementById('epub-theme-select');
        if (themeSelectElement) themeSelectElement.value = storedTheme;

        const storedFontSize = parseInt(localStorage.getItem('epubReaderFontSize'), 10) || 100;
        currentFontSize = storedFontSize;
        bookRendition.themes.fontSize(currentFontSize + '%');
        const fontSizeDisplay = document.getElementById('epub-font-size-display');
        if (fontSizeDisplay) fontSizeDisplay.textContent = currentFontSize + '%';

        // NOTE: The duplicated updateChapterUI function definition was removed from here.

        bookRendition.on('displayed', function(section) {
             console.log('[Epub.js] Rendition event: displayed', section);
             // Epub.js `displayed` event gives section, not full location object for atStart/atEnd
             // We need to wait for `relocated` or use book.locations to determine atStart/atEnd accurately
             // For now, let's try to update UI based on the section if possible, or wait for relocated.
             const currentLocation = bookRendition.location;
             if (currentLocation) {
                updateChapterUI(currentLocation);
             }
        });

        bookRendition.on('relocated', function(location) {
            updateChapterUI(location);
        });

        prevBtn.onclick = () => {
            if (bookRendition) bookRendition.prev();
        };
        nextBtn.onclick = () => {
            if (bookRendition) bookRendition.next();
        };

        // Display initial chapter or location
        let initialLocationCfi;
        if (chapterIndex !== undefined && toc.toc[chapterIndex] && toc.toc[chapterIndex].href) {
            initialLocationCfi = toc.toc[chapterIndex].href;
        } else if (chapterIndex !== undefined && book.spine && book.spine.get(chapterIndex)) {
            // Fallback if TOC doesn't have it but spine might (e.g. by numerical index)
            initialLocationCfi = book.spine.get(chapterIndex).cfi;
        }
        // If initialLocationCfi is still undefined, Epub.js will start at the beginning by default.
        
        console.log(`[Epub.js] Attempting to display initial location: ${initialLocationCfi || 'start'}`);
        await bookRendition.display(initialLocationCfi);
        console.log('[Epub.js] bookRendition.display() promise resolved.');
        
        // The 'relocated' event should fire after display and handle UI updates.
        // If it doesn't fire immediately, the UI might take a moment to update.

    } catch (err) {
        console.error('[mostrarEpub] CAUGHT ERROR:', err.message, err.stack);
        if (viewerElement) {
            viewerElement.innerHTML = `<div style='padding:20px; text-align:center; color:crimson;'>Error al cargar el libro: ${err.message}</div>`;
        }
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        if (currentLabelElement) currentLabelElement.textContent = 'Error';
    }
}

// Animaciones para panel
const styleFade = document.createElement('style');
styleFade.innerHTML = `@keyframes fadeInPanel{from{opacity:0}to{opacity:1}}@keyframes fadeOutPanel{from{opacity:1}to{opacity:0}}`;
document.head.appendChild(styleFade);
