import sys
import os
import json
from ebooklib import epub
import bs4
import warnings

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

def process_epub(upload_path):
    try:
        novel_id = os.path.basename(upload_path)
        
        epub_file_name = next((f for f in os.listdir(upload_path) if f.endswith('.epub')), None)
        if not epub_file_name:
            raise Exception("No se encontró archivo .epub en la carpeta de subida.")

        epub_path = os.path.join(upload_path, epub_file_name)
        book = epub.read_epub(epub_path, options={"ignore_ncx": True})

        output_dir = os.path.join(os.path.dirname(upload_path), '..', 'novels_data', novel_id)
        os.makedirs(output_dir, exist_ok=True)

        title = (book.get_metadata('DC', 'title')[0][0] if book.get_metadata('DC', 'title') else "Título desconocido")
        author = (book.get_metadata('DC', 'creator')[0][0] if book.get_metadata('DC', 'creator') else "Autor desconocido")

        # --- Extracción de TODAS las Imágenes (Paso Clave, sin cambios) ---
        image_path_map = {}
        image_output_dir = os.path.join(output_dir, 'images')
        os.makedirs(image_output_dir, exist_ok=True)
        
        for item in book.get_items():
            if item.media_type.startswith('image/'):
                file_name = os.path.basename(item.get_name())
                save_path = os.path.join(image_output_dir, file_name)
                with open(save_path, 'wb') as f:
                    f.write(item.get_content())
                
                original_path = item.get_name()
                new_web_path = f"/novels_data/{novel_id}/images/{file_name}"
                image_path_map[original_path] = new_web_path

        # --- EXTRACCIÓN DE PORTADA (SECCIÓN MEJORADA CON ESTRATEGIA DE 4 PASOS) ---
        cover_image_path = None
        
        # PASO 1: Intentar el método estándar usando metadatos OPF ('cover')
        meta_cover = book.get_metadata('OPF', 'cover')
        if meta_cover:
            cover_id = meta_cover[0][1].get('content')
            cover_item = book.get_item_with_id(cover_id)
            if cover_item and cover_item.get_name() in image_path_map:
                cover_image_path = image_path_map[cover_item.get_name()]
        
        # PASO 2: Si falla, intentar buscar en la sección 'guide' del EPUB
        if not cover_image_path and book.guide:
            for item in book.guide:
                if item.get('type') == 'cover':
                    # El 'href' puede ser a un HTML que contiene la imagen
                    href = item.get('href')
                    cover_item = book.get_item_with_href(href)
                    if not cover_item:
                        continue
                    
                    if cover_item.media_type.startswith('image/'):
                        # Es una imagen directa
                        if cover_item.get_name() in image_path_map:
                            cover_image_path = image_path_map[cover_item.get_name()]
                            break
                    else:
                        # Es un XHTML, hay que buscar la imagen dentro
                        soup = bs4.BeautifulSoup(cover_item.get_content(), 'html.parser')
                        img_tag = soup.find('img')
                        if img_tag and img_tag.get('src'):
                            img_src = img_tag.get('src')
                            # Buscar la imagen por su nombre de archivo en nuestro mapa
                            img_basename = os.path.basename(img_src)
                            for original_path, new_web_path in image_path_map.items():
                                if os.path.basename(original_path) == img_basename:
                                    cover_image_path = new_web_path
                                    break
                            if cover_image_path:
                                break
            
        # PASO 3: Si sigue fallando, buscar por nombre de archivo 'cover'
        if not cover_image_path:
            for original_path, new_web_path in image_path_map.items():
                if 'cover' in original_path.lower():
                    cover_image_path = new_web_path
                    break
        
        # PASO 4: Como último recurso, buscar imagen en el primer item del 'spine'
        if not cover_image_path and book.spine:
            first_item_id = book.spine[0][0]
            first_item = book.get_item_with_id(first_item_id)
            if first_item:
                soup = bs4.BeautifulSoup(first_item.get_content(), 'html.parser')
                img_tag = soup.find('img')
                if img_tag and img_tag.get('src'):
                    img_src = img_tag.get('src')
                    img_basename = os.path.basename(img_src)
                    for original_path, new_web_path in image_path_map.items():
                        if os.path.basename(original_path) == img_basename:
                            cover_image_path = new_web_path
                            break
                            
        # --- Extracción de Capítulos (sin cambios) ---
        chapters_metadata = []
        if book.spine:
            for item_id, _ in book.spine:
                item = book.get_item_with_id(item_id)
                if item and item.media_type == 'application/xhtml+xml':
                    soup = bs4.BeautifulSoup(item.get_content(), 'html.parser')
                    
                    for img_tag in soup.find_all('img'):
                        old_src = img_tag.get('src')
                        if not old_src: continue
                        
                        old_src_basename = os.path.basename(old_src)
                        for original_path, new_web_path in image_path_map.items():
                            if os.path.basename(original_path) == old_src_basename:
                                img_tag['src'] = new_web_path
                                break
                    
                    content_body = soup.find('body')
                    content_html = str(content_body) if content_body else ''

                    chapter_filename = f"chapter{len(chapters_metadata) + 1}.html"
                    chapter_path = os.path.join(output_dir, chapter_filename)
                    with open(chapter_path, 'w', encoding='utf-8') as f:
                        f.write(content_html)
                    
                    chapter_title_tag = soup.find('title') or soup.find(['h1', 'h2', 'h3'])
                    chapter_title = chapter_title_tag.get_text(strip=True) if chapter_title_tag else f"Capítulo {len(chapters_metadata) + 1}"
                    chapters_metadata.append({"title": chapter_title})
        
        # --- Guardar Metadata.json Final ---
        metadata = {
            "id": novel_id, "title": title, "author": author,
            "cover": cover_image_path, "chapters": chapters_metadata
        }
        with open(os.path.join(output_dir, 'metadata.json'), 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=4)
            
        print(f"Procesamiento exitoso para la novela: '{title}'.")
        print(f"Portada encontrada: {'Sí' if cover_image_path else 'No'}")
        print(f"Capítulos extraídos: {len(chapters_metadata)}")

    except Exception as e:
        import traceback
        print(f"Error procesando EPUB: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) > 1:
        upload_folder_path = sys.argv[1]
        process_epub(upload_folder_path)
    else:
        print("Error: Se requiere la ruta de la carpeta de subida.", file=sys.stderr)
        sys.exit(1)