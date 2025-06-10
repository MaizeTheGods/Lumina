// JavaScript for Lumina's interactivity will go here

document.addEventListener('DOMContentLoaded', () => {
    // --- Accessibility: Skip to content link ---
    if (!document.getElementById('skip-to-content')) {
        const skip = document.createElement('a');
        skip.href = '#main-content';
        skip.id = 'skip-to-content';
        skip.textContent = 'Saltar al contenido principal';
        skip.style.position = 'absolute';
        skip.style.left = '-9999px';
        skip.style.top = '10px';
        skip.style.background = '#fff';
        skip.style.color = '#7A89D1';
        skip.style.padding = '8px 18px';
        skip.style.borderRadius = '10px';
        skip.style.fontWeight = '700';
        skip.style.zIndex = '99999';
        skip.style.transition = 'left 0.2s';
        skip.addEventListener('focus', () => { skip.style.left = '20px'; });
        skip.addEventListener('blur', () => { skip.style.left = '-9999px'; });
        document.body.insertBefore(skip, document.body.firstChild);
    }

    // --- Keyboard navigation for .novel-card ---
    document.addEventListener('keydown', function(e) {
        const active = document.activeElement;
        if (active && active.classList && active.classList.contains('novel-card')) {
            if (e.key === 'Enter' || e.key === ' ') {
                active.click();
            }
        }
    });
    // --- Announce section changes for screen readers ---
    function announceSection(sectionId) {
        let live = document.getElementById('lumina-live-region');
        if (!live) {
            live = document.createElement('div');
            live.id = 'lumina-live-region';
            live.setAttribute('aria-live', 'polite');
            live.style.position = 'absolute';
            live.style.left = '-9999px';
            document.body.appendChild(live);
        }
        const section = document.getElementById(sectionId);
        if (section) {
            live.textContent = section.querySelector('h2') ? section.querySelector('h2').textContent : sectionId;
        }
    }
    document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && document.querySelector(href)) {
                e.preventDefault();
                document.querySelector(href).scrollIntoView({ behavior: 'smooth' });
                const id = href.replace('#','');
                setTimeout(() => announceSection(id), 400);
            }
        });
    });
    // --- Profile page tab switching ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tabContents.forEach(tc => tc.style.display = 'none');
            const tab = btn.getAttribute('data-tab');
            document.getElementById('tab-' + tab).style.display = '';
        });
    });
    // --- Profile username display ---
    const user = localStorage.getItem('luminaUser');
    if (user && document.getElementById('profile-username')) {
        document.getElementById('profile-username').textContent = user;
    }
    if (user && document.getElementById('profile-nick')) {
        document.getElementById('profile-nick').value = user;
    }
    // --- Profile form update username ---
    const profileForm = document.querySelector('.profile-form');
    if (profileForm) {
        profileForm.onsubmit = function(e) {
            e.preventDefault();
            const newUser = document.getElementById('profile-nick').value.trim();
            if (!newUser) return;
            localStorage.setItem('luminaUser', newUser);
            if (document.getElementById('profile-username')) {
                document.getElementById('profile-username').textContent = newUser;
            }
            if (window.updateUserHeader) updateUserHeader();
            if (window.updateLibraryUI) updateLibraryUI();
            if (window.cargarComentarios) cargarComentarios();
            alert('Nombre de usuario actualizado');
        };
    }
    // --- Logout ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = function() {
            localStorage.removeItem('luminaUser');
            location.reload();
        };
    }
});
