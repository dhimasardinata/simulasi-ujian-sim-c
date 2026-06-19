import os
import json
import subprocess
import glob
import re
import shutil

# 1. Create directory structure
os.makedirs('public/images', exist_ok=True)

# Load raw questions
with open('questions_raw.json', 'r', encoding='utf-8') as f:
    questions = json.load(f)

# Group questions by (module, page)
page_questions = {}
for q in questions:
    key = (q['module'], q['page'])
    if key not in page_questions:
        page_questions[key] = []
    page_questions[key].append(q)

def extract_action(explanation):
    # Try to find a sentence containing 'harus', 'wajib', 'sebaiknya', or 'dapat'
    sentences = re.split(r'(?<=[.!?])\s+', explanation)
    for s in sentences:
        if any(w in s.lower() for w in ['harus', 'wajib', 'sebaiknya', 'dapat']):
            return s.strip()
    # Fallback to the last sentence
    if sentences:
        non_empty = [s.strip() for s in sentences if s.strip()]
        if non_empty:
            return non_empty[-1]
    return explanation

def generate_distractors(q_text, explanation, category):
    correct_text = explanation
    
    # If explanation is too long, try to take the first 2 sentences or the action sentence
    sentences = re.split(r'(?<=[.!?])\s+', explanation)
    if len(sentences) > 2:
        correct_text = " ".join(sentences[:2])
        
    correct_text = correct_text.strip()
    
    # Persepsi Bahaya has a very standard pattern
    if category == "Persepsi Bahaya":
        action = extract_action(explanation)
        # Simplify action if possible
        correct_opt = action
        
        # Distractors
        dist1 = "Meningkatkan kecepatan kendaraan agar dapat melewati situasi tersebut dengan cepat."
        dist2 = "Tetap berkendara dengan kecepatan stabil tanpa melakukan tindakan pengereman."
        return correct_opt, dist1, dist2

    # Swap-based distractors for Wawasan and Pengetahuan
    dist1 = correct_text
    dist2 = correct_text
    
    swaps1 = {
        "wajib": "tidak wajib",
        "harus": "tidak perlu",
        "larangan": "perintah",
        "dilarang": "diperbolehkan",
        "mengurangi": "meningkatkan",
        "berhenti": "melaju terus",
        "kiri": "kanan",
        "kanan": "kiri",
        "prioritas": "non-prioritas",
        "benar": "salah",
        "Benar": "Salah",
        "menyalakan": "mematikan",
        "melindungi": "mengabaikan",
    }
    
    swaps2 = {
        "wajib": "himbauan saja",
        "harus": "boleh dilakukan boleh tidak",
        "larangan": "petunjuk arah",
        "dilarang": "dianjurkan",
        "mengurangi": "mempertahankan",
        "berhenti": "membunyikan klakson",
        "kiri": "tengah",
        "kanan": "tengah",
        "prioritas": "biasa",
        "benar": "kurang tepat",
        "menyalakan": "mengedipkan",
    }
    
    for k, v in swaps1.items():
        dist1 = re.sub(r'\b' + k + r'\b', v, dist1, flags=re.I)
    for k, v in swaps2.items():
        dist2 = re.sub(r'\b' + k + r'\b', v, dist2, flags=re.I)
        
    # Check if swaps did anything, if not, generate fallback distractors
    if dist1 == correct_text:
        dist1 = "Melanjutkan perjalanan tanpa menghiraukan kondisi rambu atau aturan tersebut."
    if dist2 == correct_text:
        dist2 = "Melakukan tindakan acuh tak acuh dan membiarkan pengendara lain mengambil hak utama."
        
    return correct_text, dist1, dist2

# Process page-by-page, extract images and build final database
final_questions = []

print("Starting image extraction and mapping...")

# Temporary directory for pdfimages
os.makedirs('tmp_extract', exist_ok=True)

# We will compile list of all (module, page) keys
keys_to_process = sorted(list(page_questions.keys()))

for m, page_num in keys_to_process:
    qs = page_questions[(m, page_num)]
    
    # Run pdfimages
    prefix = f"tmp_extract/m{m}_p{page_num}"
    
    # Clean previous tmp files
    for f in glob.glob(f"{prefix}*"):
        try:
            os.remove(f)
        except OSError:
            pass
            
    cmd = ["pdfimages", "-png", "-f", str(page_num), "-l", str(page_num), f"Sim-C-Modul-{m}.pdf", prefix]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # Get large images (> 5KB)
    extracted_files = []
    for f in sorted(glob.glob(f"{prefix}-*")):
        size = os.path.getsize(f)
        if size > 5000:
            extracted_files.append(f)
            
    # Map them 1-to-1 to questions
    for idx, q in enumerate(qs):
        image_relative_path = None
        if idx < len(extracted_files):
            src_path = extracted_files[idx]
            dest_filename = f"m{m}_p{page_num}_{idx}.png"
            dest_path = os.path.join('public/images', dest_filename)
            shutil.copy(src_path, dest_path)
            image_relative_path = f"images/{dest_filename}"
        else:
            print(f"  [WARN] Missing image for Modul {m} Page {page_num} Question {idx+1}")
            
        # Generate options
        correct_ans, dist1, dist2 = generate_distractors(q['question'], q['explanation'], q['category'])
        
        # Options array: we place them in a deterministic or random order, but we save correct option index.
        # Let's place them: A = Correct, B = Dist1, C = Dist2, but we can shuffle them or place them in order:
        # A, B, C. In the UI we can shuffle them dynamically so the test feels fresh!
        # Let's save them as:
        # options: [correct_ans, dist1, dist2]
        # correct_index: 0
        
        final_questions.append({
            "id": len(final_questions) + 1,
            "module": q['module'],
            "page": q['page'],
            "category": q['category'],
            "question": q['question'],
            "explanation": q['explanation'],
            "image": image_relative_path,
            "options": [correct_ans, dist1, dist2],
            "correct_index": 0
        })

print(f"Completed mapping. Total final questions: {len(final_questions)}")

# Save to public/questions.json
with open('public/questions.json', 'w', encoding='utf-8') as f:
    json.dump(final_questions, f, indent=2, ensure_ascii=False)
print("Saved final compiled database to public/questions.json")

# Clean tmp_extract
shutil.rmtree('tmp_extract', ignore_errors=True)
print("Cleaned temporary directory.")
