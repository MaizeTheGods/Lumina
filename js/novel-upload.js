// JS para subir EPUB y mostrar novelas dinámicamente

document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('epub-upload-form');
    const epubFileInput = document.getElementById('epub-file');
    const statusSpan = document.getElementById('epub-upload-status');
    const grid = document.getElementById('novel-grid');

    function showStatus(message, type = 'info') {
        if (!statusSpan) return;
        statusSpan.textContent = message;
        statusSpan.style.color = type === 'error' ? 'crimson' : 
                                type === 'success' ? 'green' : 
                                'var(--color-text-light)';
    }

    async function fetchNovels() {
        if (!grid) return;
        
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:var(--color-text-light);">Cargando novelas...</div>';
        
        try {
            const res = await fetch('/api/novels');
            if (!res.ok) {
                throw new Error(`Error HTTP: ${res.status}`);
            }
            
            const novels = await res.json();
            if (!Array.isArray(novels)) {
                throw new Error('Formato de respuesta inválido');
            }

            if (!novels.length) {
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:var(--color-text-light);">No hay novelas subidas aún.</div>';
                return;
            }

            grid.innerHTML = novels.map(novel => {
                if (!novel || typeof novel !== 'object') return '';
                
                const title = novel.title || 'Sin título';
                const author = novel.author || 'Desconocido';
                const cover = novel.cover || 'https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons/images/svg/book.svg';
                const filename = novel.filename || '';

                return `
                    <a href="novel-detail.html?file=${encodeURIComponent(filename)}" 
                       class="novel-card" 
                       style="animation: fadeIn 0.7s; cursor:pointer; text-decoration:none; color:inherit;" 
                       aria-label="Ver detalles de ${title}" 
                       tabindex="0">
                        <img class="novel-cover" 
                             src="${cover}" 
                             alt="Portada de la novela '${title}'" 
                             style="background:#eaf0fa; object-fit:cover; height:210px; width:100%; border-radius: 18px 18px 0 0;"/>
                        <div class="novel-info">
                            <h3 class="novel-title">${title}</h3>
                            <p class="novel-author">por ${author}</p>
                            <span class="novel-genre">EPUB</span>
                        </div>
                    </a>
                `;
            }).join('');

            if (window.updateLibraryUI) {
                updateLibraryUI();
            }
        } catch (err) {
            console.error('Error al cargar novelas:', err);
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:crimson;">
                Error al cargar novelas: ${err.message}
            </div>`;
        }
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const file = epubFileInput.files[0];
            if (!file) {
                showStatus('Selecciona un archivo EPUB.', 'error');
                return;
            }

            if (!file.name.toLowerCase().endsWith('.epub')) {
                showStatus('El archivo debe ser un EPUB.', 'error');
                return;
            }

            showStatus('Subiendo...');
            const formData = new FormData();
            formData.append('epub', file);

            try {
                const res = await fetch('/api/upload-epub', {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) {
                    throw new Error(`Error HTTP: ${res.status}`);
                }

                const data = await res.json();
                if (!data || typeof data !== 'object') {
                    throw new Error('Respuesta del servidor inválida');
                }

                if (data.error) {
                    throw new Error(data.error);
                }

                showStatus('¡EPUB subido con éxito!', 'success');
                epubFileInput.value = '';
                await fetchNovels();
            } catch (err) {
                console.error('Error al subir EPUB:', err);
                showStatus('Error al subir: ' + err.message, 'error');
            }
        });
    }

    fetchNovels();
});
