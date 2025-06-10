// Este script ahora maneja TODA la lógica de la página principal (index.html):
// 1. La subida de nuevos archivos EPUB a través del formulario.
// 2. La carga y visualización de la biblioteca de novelas desde el servidor.

document.addEventListener('DOMContentLoaded', () => {
    // --- SELECTORES DEL DOM ---
    const uploadForm = document.getElementById('upload-form');
    const epubFileInput = document.getElementById('epub-file-input');
    const uploadStatus = document.getElementById('upload-status');
    const fileNameDisplay = document.getElementById('file-name-display');
    const libraryContainer = document.getElementById('library-container');

    // --- LÓGICA DE SUBIDA DE ARCHIVOS ---
    if (uploadForm) {
        // Muestra el nombre del archivo seleccionado
        epubFileInput.addEventListener('change', () => {
            if (epubFileInput.files.length > 0) {
                fileNameDisplay.textContent = epubFileInput.files[0].name;
            } else {
                fileNameDisplay.textContent = 'Ningún archivo seleccionado';
            }
        });

        // Maneja el envío del formulario
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = epubFileInput.files[0];

            if (!file) {
                uploadStatus.textContent = 'Por favor, selecciona un archivo EPUB.';
                uploadStatus.className = 'status-msg error';
                return;
            }

            uploadStatus.textContent = 'Subiendo y procesando... Esto puede tardar un momento.';
            uploadStatus.className = 'status-msg info';

            const formData = new FormData();
            formData.append('epubFile', file);

            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Error del servidor: ${response.statusText}`);
                }

                uploadStatus.textContent = '¡Novela añadida con éxito!';
                uploadStatus.className = 'status-msg success';
                
                uploadForm.reset();
                fileNameDisplay.textContent = 'Ningún archivo seleccionado';
                
                // --- LA CORRECCIÓN FINAL ---
                // Esperamos medio segundo antes de recargar la biblioteca para darle
                // tiempo al sistema de archivos de escribir todos los datos.
                setTimeout(() => {
                    loadLibrary();
                }, 500); // 500 milisegundos = 0.5 segundos

            } catch (error) {
                console.error('Error en la subida:', error);
                uploadStatus.textContent = 'Error al subir el archivo. Inténtalo de nuevo.';
                uploadStatus.className = 'status-msg error';
            }
        });
    }

    // --- LÓGICA PARA CARGAR Y MOSTRAR LA BIBLIOTECA ---
    async function loadLibrary() {
        if (!libraryContainer) return;

        libraryContainer.innerHTML = '<p class="loading-message">Cargando tu biblioteca...</p>';

        try {
            const response = await fetch('/api/novels');
            if (!response.ok) throw new Error(`Error del servidor: ${response.statusText}`);

            const novels = await response.json();
            renderNovels(novels);
        } catch (error) {
            console.error('Error al cargar la biblioteca:', error);
            libraryContainer.innerHTML = '<p class="error-message">No se pudo cargar la biblioteca. Por favor, asegúrate de que el servidor esté funcionando.</p>';
        }
    }

    function renderNovels(novels) {
        libraryContainer.innerHTML = '';
        if (!novels || novels.length === 0) {
            libraryContainer.innerHTML = '<p class="info-message">Tu biblioteca está vacía. ¡Sube tu primera novela para empezar!</p>';
            return;
        }

        const novelCardsHTML = novels.map(novel => {
            if (!novel || !novel.id) {
                console.warn('Se encontró una novela sin ID en los datos del servidor:', novel);
                return '';
            }
            return `
                <a href="novel-detail.html?id=${novel.id}" class="novel-card">
                    <img src="${novel.cover || 'img/default-cover.png'}" alt="Portada de ${novel.title}" class="novel-cover">
                    <div class="novel-info">
                        <h4 class="novel-title">${novel.title || 'Sin título'}</h4>
                        <p class="novel-author">por ${novel.author || 'Desconocido'}</p>
                    </div>
                </a>
            `;
        }).join('');

        libraryContainer.innerHTML = novelCardsHTML;
    }

    // --- INICIALIZACIÓN ---
    loadLibrary();
});