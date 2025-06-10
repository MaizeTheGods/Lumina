import os
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from ebooklib import epub
import ebooklib
import uuid

UPLOAD_FOLDER = 'uploads'
NOVELS_FOLDER = 'novels_data'
ALLOWED_EXTENSIONS = {'epub'}

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['NOVELS_FOLDER'] = NOVELS_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(NOVELS_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_novel(epub_path, novel_id):
    book = epub.read_epub(epub_path)
    meta = {
        'id': novel_id,
        'title': book.get_metadata('DC', 'title')[0][0] if book.get_metadata('DC', 'title') else 'Sin título',
        'author': book.get_metadata('DC', 'creator')[0][0] if book.get_metadata('DC', 'creator') else 'Desconocido',
        'chapters': []
    }
    chapters = []
    for idx, item in enumerate(book.get_items_of_type(ebooklib.ITEM_DOCUMENT)):
        chapter_id = f'chapter_{idx}'
        
        # Lógica mejorada para obtener el título del capítulo
        chapter_title = None
        if hasattr(item, 'title') and item.title: # Priorizar título explícito
            chapter_title = item.title
        elif hasattr(item, 'get_name') and item.get_name(): # Fallback a nombre de archivo limpiado
            raw_file_name = item.get_name()
            # Extraer solo el nombre del archivo, remover extensión, reemplazar separadores y capitalizar
            clean_name = os.path.splitext(os.path.basename(raw_file_name))[0]
            clean_name = clean_name.replace('-', ' ').replace('_', ' ').capitalize()
            chapter_title = clean_name
        
        if not chapter_title: # Fallback final si nada funcionó
            chapter_title = f'Capítulo {idx+1}'

        chapter_content = item.get_content().decode('utf-8')
        chapter_path = os.path.join(NOVELS_FOLDER, f'{novel_id}_{chapter_id}.html')
        with open(chapter_path, 'w', encoding='utf-8') as f:
            f.write(chapter_content)
        chapters.append({'id': chapter_id, 'title': chapter_title, 'path': f'/novels_data/{novel_id}_{chapter_id}.html'})
    meta['chapters'] = chapters
    # Guarda metadatos
    meta_path = os.path.join(NOVELS_FOLDER, f'{novel_id}_meta.json')
    with open(meta_path, 'w', encoding='utf-8') as f:
        import json
        json.dump(meta, f, ensure_ascii=False, indent=2)
    return meta

@app.route('/upload-epub', methods=['POST'])
def upload_epub():
    if 'epub' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['epub']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        novel_id = str(uuid.uuid4())
        epub_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{novel_id}_{filename}')
        file.save(epub_path)
        meta = extract_novel(epub_path, novel_id)
        return jsonify({'message': 'EPUB procesado', 'novel': meta}), 201
    return jsonify({'error': 'Archivo no permitido'}), 400

@app.route('/novels', methods=['GET'])
def list_novels():
    novels = []
    for fname in os.listdir(NOVELS_FOLDER):
        if fname.endswith('_meta.json'):
            with open(os.path.join(NOVELS_FOLDER, fname), encoding='utf-8') as f:
                import json
                novels.append(json.load(f))
    return jsonify(novels)

@app.route('/novel/<novel_id>', methods=['GET'])
def get_novel(novel_id):
    meta_path = os.path.join(NOVELS_FOLDER, f'{novel_id}_meta.json')
    if not os.path.exists(meta_path):
        return jsonify({'error': 'Novela no encontrada'}), 404
    with open(meta_path, encoding='utf-8') as f:
        import json
        meta = json.load(f)
    return jsonify(meta)

@app.route('/novels_data/<path:filename>')
def serve_chapter(filename):
    return send_from_directory(NOVELS_FOLDER, filename)

@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory('css', filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('js', filename)

@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    return send_from_directory('uploads', filename)

@app.route('/<path:filename>')
def serve_html(filename):
    if filename.endswith('.html'):
        return send_from_directory('.', filename)
    return 'Not Found', 404

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000) 