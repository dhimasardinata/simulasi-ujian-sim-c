import os
import json
import subprocess
import glob

# Load questions
with open('questions_raw.json', 'r') as f:
    questions = json.load(f)

# Group questions by (module, page)
page_questions = {}
for q in questions:
    key = (q['module'], q['page'])
    if key not in page_questions:
        page_questions[key] = []
    page_questions[key].append(q)

os.makedirs('extracted_images_all_test', exist_ok=True)

total_mismatches = 0
for m in range(1, 5):
    print(f"\n--- Checking Modul {m} ---")
    mismatches = 0
    # Modul range of question pages:
    # PB: 80-92
    # Wawasan: 94-100
    # Pengetahuan: 102-108
    pages_to_check = list(range(80, 93)) + list(range(94, 101)) + list(range(102, 109))
    
    for page_num in pages_to_check:
        key = (m, page_num)
        qs = page_questions.get(key, [])
        if not qs:
            continue
            
        prefix = f"extracted_images_all_test/m{m}_p{page_num}"
        # Delete old ones first
        for f in glob.glob(f"{prefix}*"):
            os.remove(f)
            
        cmd = ["pdfimages", "-png", "-f", str(page_num), "-l", str(page_num), f"Sim-C-Modul-{m}.pdf", prefix]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Filter files by size (> 5000 bytes)
        extracted_files = []
        for f in sorted(glob.glob(f"{prefix}-*")):
            size = os.path.getsize(f)
            if size > 5000:
                extracted_files.append((f, size))
                
        if len(qs) != len(extracted_files):
            print(f"  Page {page_num}: Mismatch! Questions = {len(qs)}, Extracted large images = {len(extracted_files)}")
            print(f"    Questions: {[q['question'][:40] for q in qs]}")
            print(f"    Images: {[os.path.basename(ef[0]) for ef in extracted_files]}")
            mismatches += 1
            total_mismatches += 1
            
    print(f"Modul {m} check complete. Mismatches in Modul {m}: {mismatches}")

print(f"\nTotal mismatches across all modules: {total_mismatches}")
