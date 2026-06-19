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

# Test Modul 1
m = 1
os.makedirs('extracted_images_test', exist_ok=True)

mismatches = 0
for page_num in range(80, 109): # Test all question pages in Modul 1 (80 to 108)
    key = (m, page_num)
    qs = page_questions.get(key, [])
    if not qs:
        continue
        
    # Extract images for this page
    prefix = f"extracted_images_test/m{m}_p{page_num}"
    # Delete old ones first
    for f in glob.glob(f"{prefix}*"):
        os.remove(f)
        
    cmd = ["pdfimages", "-png", "-f", str(page_num), "-l", str(page_num), f"Sim-C-Modul-{m}.pdf", prefix]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # List extracted files and filter by size (> 5000 bytes)
    extracted_files = []
    for f in sorted(glob.glob(f"{prefix}-*")):
        size = os.path.getsize(f)
        if size > 5000: # large image
            extracted_files.append((f, size))
            
    print(f"Modul {m} Page {page_num}: Parsed questions = {len(qs)}, Extracted large images = {len(extracted_files)}")
    if len(qs) != len(extracted_files):
        print(f"  [MISMATCH] Questions: {[q['question'][:30] for q in qs]}")
        print(f"  [MISMATCH] Images: {extracted_files}")
        mismatches += 1

print(f"Total mismatches: {mismatches}")
