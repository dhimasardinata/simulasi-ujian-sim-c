import json
import re

def clean_page_text(page_text):
    lines = page_text.split('\n')
    cleaned_lines = []
    for line in lines:
        l = line.strip()
        if re.search(r'Modul \d+ - (Persepsi Bahaya|Wawasan|Pengetahuan)', l, re.I):
            continue
        if l in ["Materi Uji Teori Sim", "Persepsi", "Bahaya", "Wawasan", "Pengetahuan"]:
            continue
        if "Buku Panduan" in l or "Teori Sim C" in l or "Latihan Ujian" in l:
            continue
        if re.match(r'^\d+$', l):
            continue
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines).strip()

def parse_persepsi_bahaya(page_text, module_num, page_num):
    cleaned = clean_page_text(page_text)
    blocks = [b.strip() for b in cleaned.split('\n\n') if b.strip()]
    
    questions = []
    i = 0
    while i < len(blocks):
        if i + 1 < len(blocks):
            title = blocks[i]
            desc = blocks[i+1]
            
            title_clean = " ".join([line.strip() for line in title.split('\n')]).strip()
            desc_clean = " ".join([line.strip() for line in desc.split('\n')]).strip()
            
            questions.append({
                "module": module_num,
                "page": page_num,
                "category": "Persepsi Bahaya",
                "question": title_clean,
                "explanation": desc_clean
            })
            i += 2
        else:
            odd_block = " ".join([line.strip() for line in blocks[i].split('\n')]).strip()
            questions.append({
                "module": module_num,
                "page": page_num,
                "category": "Persepsi Bahaya",
                "question": "Persepsi Bahaya",
                "explanation": odd_block
            })
            i += 1
    return questions

def parse_wawasan_pengetahuan(page_text, module_num, page_num, category):
    cleaned = clean_page_text(page_text)
    blocks = [b.strip() for b in cleaned.split('\n\n') if b.strip()]
    
    questions = []
    for b in blocks:
        b_clean = " ".join([line.strip() for line in b.split('\n')]).strip()
        
        if re.match(r'^scan\s+QR\s+untuk\s+melihat\s+video\.?$', b_clean, re.I):
            continue
            
        if '?' in b_clean:
            idx = b_clean.find('?')
            q = b_clean[:idx+1].strip()
            ans = b_clean[idx+1:].strip()
            ans = re.sub(r'scan\s+QR\s+untuk\s+melihat\s+video\.?$', '', ans, flags=re.I).strip()
            
            questions.append({
                "module": module_num,
                "page": page_num,
                "category": category,
                "question": q,
                "explanation": ans
            })
        else:
            questions.append({
                "module": module_num,
                "page": page_num,
                "category": category,
                "question": "Pertanyaan",
                "explanation": b_clean
            })
    return questions

all_questions = []

for m in range(1, 5):
    with open(f'extracted_text/Sim-C-Modul-{m}.txt', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix the single layout issue in Modul 1 Page 91
    if m == 1:
        content = content.replace(
            "dari pengendara .\nTerdapat pesepeda",
            "dari pengendara .\n\nTerdapat pesepeda"
        )
    
    pages = content.split('\x0c')
    
    # 1. Persepsi Bahaya: pages 80 to 92 (index 79 to 91)
    for idx in range(79, 92):
        qs = parse_persepsi_bahaya(pages[idx], m, idx+1)
        all_questions.extend(qs)
        
    # 2. Wawasan: pages 94 to 100 (index 93 to 99)
    for idx in range(93, 100):
        qs = parse_wawasan_pengetahuan(pages[idx], m, idx+1, "Wawasan")
        all_questions.extend(qs)
        
    # 3. Pengetahuan: pages 102 to 108 (index 101 to 107)
    for idx in range(101, 108):
        qs = parse_wawasan_pengetahuan(pages[idx], m, idx+1, "Pengetahuan")
        all_questions.extend(qs)

print(f"Total parsed questions: {len(all_questions)}")

# Write to JSON
with open('questions_raw.json', 'w', encoding='utf-8') as f:
    json.dump(all_questions, f, indent=2, ensure_ascii=False)
print("Saved to questions_raw.json")
