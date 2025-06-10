const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Multer storage config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Ensure uploadsDir exists *before* Multer tries to write.
        if (!fs.existsSync(uploadsDir)) {
            try {
                fs.mkdirSync(uploadsDir, { recursive: true });
                console.log(`[Multer Dest] Created uploads directory: ${uploadsDir}`);
            } catch (err) {
                console.error(`[Multer Dest] Failed to create uploads directory ${uploadsDir}:`, err);
                return cb(err); // Pass error to Multer
            }
        }
        cb(null, uploadsDir); // Use absolute path
    },
    filename: function (req, file, cb) {
        // Sanitize originalname to prevent path traversal or invalid characters
        const sanitizedOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._\-]/g, '');
        cb(null, Date.now() + '-' + sanitizedOriginalName);
    }
});
const upload = multer({ storage: storage });

// --- EPUB METADATA & COVER EXTRACTION ---
const unzipper = require('unzipper');
const sharp = require('sharp');

async function extractEpubMetadata(epubPath, destDir, destBasename) {
    // Defaults
    let title = destBasename;
    let author = 'Desconocido';
    let coverPath = null;
    let foundCover = false;
    let coverBuffer = null;
    let chapters = [];
    // Unzip EPUB and extract metadata
    const directory = await unzipper.Open.file(epubPath);
    // Find container.xml
    const containerEntry = directory.files.find(f => f.path === 'META-INF/container.xml');
    if (!containerEntry) return { title, author, cover: null, chapters };
    const containerXml = (await containerEntry.buffer()).toString();
    // Find path to OPF file
    const opfMatch = containerXml.match(/full-path="([^"]+)"/);
    if (!opfMatch) return { title, author, cover: null, chapters };
    const opfPath = opfMatch[1];
    const opfEntry = directory.files.find(f => f.path === opfPath);
    if (!opfEntry) return { title, author, cover: null, chapters };
    const opfXml = (await opfEntry.buffer()).toString();
    // Extract title & author
    const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
    if (titleMatch) title = titleMatch[1];
    const authorMatch = opfXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/);
    if (authorMatch) author = authorMatch[1];
    // Find cover id
    let coverId = null;
    const metaCoverMatch = opfXml.match(/<meta[^>]+name=["']cover["'][^>]+content=["']([^"']+)["'][^>]*>/);
    if (metaCoverMatch) coverId = metaCoverMatch[1];
    // Find cover href
    let coverHref = null;
    if (coverId) {
        const coverHrefMatch = new RegExp(`<item[^>]+id=["']${coverId}["'][^>]+href=["']([^"']+)["']`, 'i').exec(opfXml);
        if (coverHrefMatch) coverHref = coverHrefMatch[1];
    }
    // Try fallback: look for jpeg/png in manifest
    if (!coverHref) {
        const fallback = opfXml.match(/<item[^>]+href=["']([^"']+\.(jpg|jpeg|png))["'][^>]*>/i);
        if (fallback) coverHref = fallback[1];
    }
    // Extract cover buffer
    if (coverHref) {
        // Find base path
        const basePath = opfPath.substring(0, opfPath.lastIndexOf('/')+1);
        const coverFullPath = basePath + coverHref;
        const coverEntry = directory.files.find(f => f.path === coverFullPath);
        if (coverEntry) {
            coverBuffer = await coverEntry.buffer();
            foundCover = true;
        }
    }
    // Save cover image if found
    if (foundCover && coverBuffer) {
        const coverOutPath = path.join(destDir, destBasename + '-cover.jpg');
        await sharp(coverBuffer).resize(300, 400, { fit: 'inside' }).jpeg().toFile(coverOutPath);
        coverPath = '/uploads/' + path.basename(coverOutPath);
    }
    // Extract chapters (spine)
    const spineMatches = [...opfXml.matchAll(/<itemref[^>]+idref=["']([^"']+)["'][^>]*>/g)].map(m => m[1]);
    chapters = spineMatches.map(idref => {
        const itemMatch = new RegExp(`<item[^>]+id=["']${idref}["'][^>]+href=["']([^"']+)["'][^>]*>`, 'i').exec(opfXml);
        let href = itemMatch ? itemMatch[1] : null;
        let label = idref;
        // Try to get <navLabel> or fallback
        // (For simplicity, just use idref or href basename here)
        if (href) label = href.replace(/_/g, ' ').replace(/\.[a-z0-9]+$/i, '');
        return { idref, href, label };
    });
    return { title, author, cover: coverPath, chapters };
}

// Obtener metadatos de una novela EPUB por filename
app.get('/api/novel/:file', async (req, res) => {
    try {
        const filename = req.params.file;
        const epubPath = path.join(uploadsDir, filename);
        if (!fs.existsSync(epubPath)) {
            console.error(`[404] EPUB no encontrado: ${epubPath}`);
            return res.status(404).json({ error: 'EPUB no encontrado' });
        }
        const meta = await extractEpubMetadata(epubPath, uploadsDir, filename);
        // Si hay portada, servirla como URL relativa
        if (meta.cover && !meta.cover.startsWith('http')) {
            meta.cover = '/uploads/' + path.basename(meta.cover);
        }
        res.json(meta);
    } catch (err) {
        console.error('Error extrayendo metadatos EPUB:', err);
        res.status(500).json({ error: 'Error al procesar EPUB' });
    }
});

// Upload EPUB endpoint
app.post('/api/upload-epub', upload.single('epub'), async (req, res) => {
    // Check if Multer failed or no file was sent
    if (!req.file) {
        console.error('[Upload Error] Multer failed or no file received.');
        // Multer might have already sent a response or an error might have occurred before this handler.
        // If res is not headersSent, send a response.
        if (!res.headersSent) {
            return res.status(400).json({ error: 'No file uploaded or Multer error.' });
        }
        return; // Avoid further processing if headers already sent
    }

    const epubPath = req.file.path; // This is the full path where Multer saved the file
    const originalFilenameForBase = req.file.filename; // Filename as saved by Multer (timestamped)
    const base = path.parse(originalFilenameForBase).name; // Base name from the Multer-saved file

    try {
        // This check is more for operations *after* Multer, like saving metadata/cover
        if (!fs.existsSync(uploadsDir)) {
            console.warn(`[Upload] Uploads directory ${uploadsDir} was missing post-Multer, attempting to recreate.`);
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        console.log(`[Upload] Processing file: ${epubPath}`);
        console.log(`[Upload] Base name for metadata/cover: ${base}`);

        const meta = await extractEpubMetadata(epubPath, uploadsDir, base); // Pass absolute uploadsDir

        const metadataJsonPath = path.join(uploadsDir, base + '.json');
        fs.writeFileSync(metadataJsonPath, JSON.stringify(meta, null, 2));
        console.log(`[Upload] Metadata saved to: ${metadataJsonPath}`);

        res.json({ message: 'EPUB uploaded successfully', filename: originalFilenameForBase, meta });

    } catch (e) {
        console.error('[Upload Error] Error during EPUB processing or metadata saving:', e);

        if (fs.existsSync(epubPath)) {
            try {
                fs.unlinkSync(epubPath);
                console.log(`[Upload Error] Cleaned up partially uploaded EPUB: ${epubPath}`);
            } catch (unlinkErr) {
                console.error(`[Upload Error] Failed to cleanup partially uploaded EPUB ${epubPath}:`, unlinkErr);
            }
        }
        // If res is not headersSent, send a response.
        if (!res.headersSent) {
            res.status(500).json({
                message: 'EPUB upload failed during processing.',
                error: e.message,
                filename: req.file ? originalFilenameForBase : 'N/A'
            });
        }
    }
});

// Get comments for a novel
app.get('/api/novel/:filename/comments', (req, res) => {
    const base = path.parse(req.params.filename).name;
    const commentsPath = path.join('uploads', base + '-comments.json');
    if (fs.existsSync(commentsPath)) {
        try {
            const comments = JSON.parse(fs.readFileSync(commentsPath));
            res.json(comments);
        } catch {
            res.status(500).json({ error: 'Error reading comments' });
        }
    } else {
        res.json([]);
    }
});

// Post a new comment for a novel
app.post('/api/novel/:filename/comments', express.json(), (req, res) => {
    const base = path.parse(req.params.filename).name;
    const commentsPath = path.join('uploads', base + '-comments.json');
    let comments = [];
    if (fs.existsSync(commentsPath)) {
        try {
            comments = JSON.parse(fs.readFileSync(commentsPath));
        } catch {}
    }
    const { text, user } = req.body;
    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Comentario vacío o inválido' });
    }
    const comment = {
        text: text.trim(),
        user: user || 'Anónimo',
        timestamp: Date.now()
    };
    comments.unshift(comment); // Más reciente primero
    try {
        fs.writeFileSync(commentsPath, JSON.stringify(comments, null, 2));
        res.status(201).json(comment);
    } catch {
        res.status(500).json({ error: 'Error al guardar comentario' });
    }
});

// Get metadata for a single novel
app.get('/api/novel/:filename', (req, res) => {
    const base = path.parse(req.params.filename).name;
    const metaPath = path.join('uploads', base + '.json');
    if (fs.existsSync(metaPath)) {
        try {
            const meta = JSON.parse(fs.readFileSync(metaPath));
            res.json(meta);
        } catch {
            res.status(500).json({ error: 'Error reading metadata' });
        }
    } else {
        res.status(404).json({ error: 'Novel not found' });
    }
});

// List uploaded EPUBs (with metadata)
app.get('/api/novels', (req, res) => {
    fs.readdir('uploads', (err, files) => {
        if (err) return res.status(500).json({ error: 'Error reading uploads' });
        const epubs = files.filter(f => f.endsWith('.epub'));
        const novels = epubs.map(f => {
            const base = path.parse(f).name;
            let meta = { title: base, author: 'Desconocido', cover: null };
            const metaPath = path.join('uploads', base + '.json');
            if (fs.existsSync(metaPath)) {
                try { meta = JSON.parse(fs.readFileSync(metaPath)); } catch {}
            }
            return {
                filename: f,
                title: meta.title,
                author: meta.author,
                cover: meta.cover
            };
        });
        res.json(novels);
    });
});

// Placeholder API endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'Welcome to Lumina API! The cosmos is vast and full of wonders.' });
});

// Serve static files (HTML, CSS, JS, etc.)
app.use(express.static(path.join(__dirname, '.')));

// Servir archivos EPUB con el tipo MIME correcto
app.get('/uploads/:epubFile', (req, res, next) => {
    const epubFile = req.params.epubFile;
    if (!epubFile.endsWith('.epub')) return next();
    const filePath = path.join(__dirname, 'uploads', epubFile);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('EPUB not found');
    }
    res.setHeader('Content-Type', 'application/epub+zip');
    res.sendFile(filePath);
});

app.listen(PORT, () => {
    console.log(`Lumina server shining brightly on http://localhost:${PORT}`);
});
