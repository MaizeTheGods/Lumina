// --- IMPORTACIONES DE MÓDULOS ---
const express = require('express');
const path = require('path');
const multer = require('multer');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises; // Usamos la versión de promesas para código async/await

// --- CONFIGURACIÓN INICIAL DE EXPRESS ---
const app = express();
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARE ---
// Sirve archivos estáticos (HTML, CSS, JS, imágenes) desde el directorio raíz del proyecto.
app.use(express.static(path.join(__dirname)));

// Permite al servidor entender JSON y datos de formularios.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CONFIGURACIÓN DE MULTER PARA LA SUBIDA DE ARCHIVOS ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Generamos un ID único para la subida. Este será el ID de la novela.
        const novelId = uuidv4();
        const uploadPath = path.join(__dirname, 'uploads', novelId);
        
        fs.mkdir(uploadPath, { recursive: true }).then(() => {
            // Guardamos la ruta en el objeto `req` para usarla después.
            req.uploadPath = uploadPath;
            cb(null, uploadPath);
        }).catch(err => cb(err));
    },
    filename: (req, file, cb) => {
        // Mantenemos el nombre original del archivo.
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- RUTAS DE LA API ---

// RUTA PARA SUBIR Y PROCESAR UN NUEVO EPUB
app.post('/api/upload', upload.single('epubFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No se ha subido ningún archivo.' });
    }

    // Llamamos al script de Python para procesar el EPUB.
    const pythonProcess = spawn('python', [path.join(__dirname, 'backend_epub.py'), req.uploadPath]);

    let stderr = ''; // Variable para capturar la salida de error
    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python Script stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python Script stderr: ${data}`);
        stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code === 0) {
            res.status(200).json({ message: 'Archivo subido y procesado con éxito.' });
        } else {
            res.status(500).json({ message: 'Error al procesar el archivo EPUB.', error: stderr });
        }
    });
});

// RUTA PARA OBTENER LA LISTA DE TODAS LAS NOVELAS (BIBLIOTECA)
app.get('/api/novels', async (req, res) => {
    try {
        const novelsDataDir = path.join(__dirname, 'novels_data');
        
        // --- LA CORRECCIÓN MÁS IMPORTANTE ---
        // Primero, comprobamos si el directorio existe.
        try {
            await fs.access(novelsDataDir);
        } catch {
            // Si no existe, significa que no hay novelas. Devolvemos un array vacío.
            console.log("La carpeta 'novels_data' no existe, devolviendo biblioteca vacía.");
            return res.json([]);
        }
        
        const novelFolders = await fs.readdir(novelsDataDir, { withFileTypes: true });

        const novels = await Promise.all(
            novelFolders
                .filter(dirent => dirent.isDirectory())
                .map(async (dir) => {
                    const metadataPath = path.join(novelsDataDir, dir.name, 'metadata.json');
                    try {
                        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
                        const metadata = JSON.parse(metadataContent);
                        return { id: dir.name, ...metadata };
                    } catch (error) {
                        console.warn(`Omitiendo la novela en la carpeta '${dir.name}' por error:`, error.message);
                        return null;
                    }
                })
        );
        res.json(novels.filter(n => n !== null));
    } catch (error) {
        console.error("Error al obtener la lista de novelas:", error);
        res.status(500).json({ message: 'Error interno al cargar la biblioteca.' });
        res.status(500).json({ message: 'Error al cargar la biblioteca.' });
    }
});


// RUTA PARA OBTENER LOS DATOS DE UNA NOVELA ESPECÍFICA
app.get('/api/novels/:novelId', async (req, res) => {
    try {
        const novelId = req.params.novelId;
        const novelFolderPath = path.join(__dirname, 'novels_data', novelId);

        // Leemos el archivo de metadatos.
        const metadataPath = path.join(novelFolderPath, 'metadata.json');
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);

        // Leemos todos los archivos de capítulos del directorio.
        const files = await fs.readdir(novelFolderPath);
        const chapterFiles = files
            .filter(file => file.startsWith('chapter') && file.endsWith('.html')) // Ahora buscamos .html
            .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)[0]);
                const numB = parseInt(b.match(/\d+/)[0]);
                return numA - numB;
            });

        const chapters = await Promise.all(
            chapterFiles.map(async (fileName, index) => {
                const chapterPath = path.join(novelFolderPath, fileName);
                const content = await fs.readFile(chapterPath, 'utf-8');
                return {
                    title: metadata.chapters[index]?.title || `Capítulo ${index + 1}`,
                    content: content
                };
            })
        );
        
        const novelData = {
            title: metadata.title,
            author: metadata.author,
            cover: metadata.cover,
            chapters: chapters
        };

        res.json(novelData);

    } catch (error) {
        console.error(`Error al obtener datos de la novela ${req.params.novelId}:`, error);
        res.status(404).json({ message: 'Novela no encontrada o error al procesar los datos.' });
    }
});

// --- INICIO DEL SERVIDOR ---
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});