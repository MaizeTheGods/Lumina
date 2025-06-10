// Lumina Personal Library (localStorage)
function getLibrary() {
    try {
        let user = localStorage.getItem('luminaUser');
        if (!user) return [];
        let lib = localStorage.getItem('luminaLibrary_' + user);
        if (!lib) return [];
        const parsedLib = JSON.parse(lib);
        if (!Array.isArray(parsedLib)) {
            console.error('Error: Biblioteca no es un array válido');
            return [];
        }
        return parsedLib;
    } catch (err) {
        console.error('Error al obtener biblioteca:', err);
        showLuminaToast('Error al cargar tu biblioteca', 'error');
        return [];
    }
}

function setLibrary(arr) {
    try {
        if (!Array.isArray(arr)) {
            throw new Error('La biblioteca debe ser un array');
        }
        let user = localStorage.getItem('luminaUser');
        if (!user) {
            throw new Error('Usuario no encontrado');
        }
        localStorage.setItem('luminaLibrary_' + user, JSON.stringify(arr));
    } catch (err) {
        console.error('Error al guardar biblioteca:', err);
        showLuminaToast('Error al guardar tu biblioteca', 'error');
    }
}

function addToLibrary(novel) {
    try {
        if (!novel || typeof novel !== 'object') {
            throw new Error('Datos de novela inválidos');
        }
        if (!novel.filename) {
            throw new Error('La novela debe tener un nombre de archivo');
        }
        let lib = getLibrary();
        if (!lib.find(n => n.filename === novel.filename)) {
            lib.push(novel);
            setLibrary(lib);
            updateLibraryUI();
            showLuminaToast('Añadido a tu biblioteca');
        }
    } catch (err) {
        console.error('Error al añadir a biblioteca:', err);
        showLuminaToast('Error al añadir a tu biblioteca', 'error');
    }
}

function removeFromLibrary(filename) {
    let lib = getLibrary();
    lib = lib.filter(n => n.filename !== filename);
    setLibrary(lib);
    updateLibraryUI();
    showLuminaToast('Eliminado de tu biblioteca');
}

function showLuminaToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `lumina-toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 8px;
        color: white;
        background: ${type === 'error' ? '#dc3545' : '#28a745'};
        z-index: 9999;
        animation: fadeInOut 3s ease-in-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function updateLibraryUI() {
    try {
        // Show "Añadir a biblioteca" on novel cards
        let user = localStorage.getItem('luminaUser');
        document.querySelectorAll('.novel-card').forEach(card => {
            let addBtn = card.querySelector('.add-to-library-btn');
            if (!addBtn) {
                addBtn = document.createElement('button');
                addBtn.className = 'add-to-library-btn btn btn-secondary';
                addBtn.style.marginTop = '10px';
                addBtn.textContent = 'Añadir a Biblioteca';
                card.querySelector('.novel-info').appendChild(addBtn);
            }
            addBtn.style.display = user ? '' : 'none';
            addBtn.onclick = async (e) => {
                e.preventDefault();
                try {
                    // Get novel metadata from card
                    let title = card.querySelector('.novel-title')?.textContent;
                    let author = card.querySelector('.novel-author')?.textContent.replace('por ','');
                    let cover = card.querySelector('.novel-cover')?.src;
                    let link = card.getAttribute('href');
                    let filename = link ? decodeURIComponent(link.split('file=')[1]) : '';
                    
                    if (!filename) {
                        throw new Error('No se pudo obtener el nombre del archivo');
                    }
                    
                    addToLibrary({ title, author, cover, filename });
                } catch (err) {
                    console.error('Error al procesar novela:', err);
                    showLuminaToast('Error al procesar la novela', 'error');
                }
            };
        });
        
        // Show library in profile page (if exists)
        let lib = getLibrary();
        let libCont = document.getElementById('lumina-library-list');
        if (libCont) {
            if (!lib.length) {
                libCont.innerHTML = "<div style='color:#b0b5d6;'>No tienes novelas en tu biblioteca.</div>";
                return;
            }
            
            libCont.innerHTML = lib.map(n => {
                if (!n || !n.filename) {
                    console.warn('Novela inválida en biblioteca:', n);
                    return '';
                }
                return `<div class='novel-card' style='margin-bottom:12px;'>
                    <img class='novel-cover' src='${n.cover || ''}' style='width:60px;height:90px;object-fit:cover;border-radius:10px;margin-right:12px;float:left;'>
                    <div class='novel-info' style='margin-left:75px;'>
                      <h4 class='novel-title'>${n.title || 'Sin título'}</h4>
                      <p class='novel-author'>por ${n.author || 'Desconocido'}</p>
                      <button class='btn btn-danger' onclick='removeFromLibrary("${n.filename}")'>Quitar</button>
                    </div>
                </div>`;
            }).join('');
        }
    } catch (err) {
        console.error('Error al actualizar UI de biblioteca:', err);
        showLuminaToast('Error al actualizar la biblioteca', 'error');
    }
}

document.addEventListener('DOMContentLoaded', updateLibraryUI);
window.updateLibraryUI = updateLibraryUI;
window.addToLibrary = addToLibrary;
window.removeFromLibrary = removeFromLibrary;
