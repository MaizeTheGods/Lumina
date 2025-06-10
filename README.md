# Lumina - Una Red Social Simple

Lumina es un proyecto de red social desarrollado con PHP puro para aprender los fundamentos del desarrollo web backend.

## ✨ Características
- Registro de usuarios
- Inicio de sesión
- Creación de posts

## 🛠️ Tecnologías Utilizadas
- **Backend:** PHP 8+
- **Base de Datos:** MySQL
- **Frontend:** HTML, CSS, JavaScript

## 🚀 Cómo Empezar

Sigue estos pasos para ejecutar el proyecto en tu máquina local.

1.  **Clona el repositorio:**
    ```bash
    git clone https://github.com/MaizeTheGods/Lumina.git
    cd Lumina
    ```

2.  **Configura la base de datos:**
    - Crea una base de datos en MySQL llamada `lumina`.
    - Importa el archivo `database/lumina.sql` en tu base de datos.

3.  **Configura las credenciales:**
    - Renombra el archivo `src/config/database.php.example` a `database.php`.
    - Edita `src/config/database.php` con tus credenciales de MySQL.

4.  **Instala las dependencias:**
    ```bash
    composer install
    ```

5.  **Inicia el servidor:**
    ```bash
    php -S localhost:8000
    ```