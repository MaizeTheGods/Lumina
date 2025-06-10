// Lumina Auth: login/signup simulation with localStorage
function showAuthModal() {
    document.getElementById('lumina-auth-modal').style.display = 'flex';
    document.getElementById('lumina-auth-username').focus();
}
function hideAuthModal() {
    document.getElementById('lumina-auth-modal').style.display = 'none';
}
function getLuminaUser() {
    return localStorage.getItem('luminaUser') || null;
}
function setLuminaUser(username) {
    localStorage.setItem('luminaUser', username);
}
// Display username in header, add login click
function updateUserHeader() {
    let user = getLuminaUser();
    let header = document.querySelector('header');
    if (!header) return;
    let userElem = document.getElementById('lumina-user-display');
    if (!userElem) {
        userElem = document.createElement('span');
        userElem.id = 'lumina-user-display';
        userElem.style.cssText = 'margin-left:18px;font-weight:600;color:#7A89D1;cursor:pointer;';
        header.appendChild(userElem);
    }
    if (user) {
        userElem.textContent = '👤 ' + user;
        userElem.onclick = null;
    } else {
        userElem.textContent = 'Iniciar sesión';
        userElem.onclick = showAuthModal;
    }
}
document.addEventListener('DOMContentLoaded', () => {
    updateUserHeader();
    document.getElementById('lumina-auth-close').onclick = hideAuthModal;
    document.getElementById('lumina-auth-form').onsubmit = function(e) {
        e.preventDefault();
        let username = document.getElementById('lumina-auth-username').value.trim();
        if (!username) return;
        setLuminaUser(username);
        hideAuthModal();
        updateUserHeader();
        // Refresh library and comments if needed
        if (window.updateLibraryUI) updateLibraryUI();
        if (window.cargarComentarios) cargarComentarios();
    };
});
