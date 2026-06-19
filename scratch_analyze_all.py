for m in range(1, 5):
    with open(f'extracted_text/Sim-C-Modul-{m}.txt', 'r', encoding='utf-8') as f:
        content = f.read()
    pages = content.split('\x0c')
    print(f"\n--- Modul {m} (Total pages: {len(pages)}) ---")
    
    sections = {}
    for i, page in enumerate(pages):
        lines = [line.strip() for line in page.split('\n') if line.strip()]
        if not lines:
            continue
        first_few_lines = " | ".join(lines[:3])
        # Find if it belongs to a section of interest
        for sec in ["Persepsi Bahaya", "Wawasan", "Pengetahuan"]:
            if sec in first_few_lines:
                if sec not in sections:
                    sections[sec] = []
                sections[sec].append(i+1)
    
    for sec, page_list in sections.items():
        print(f"  {sec}: {len(page_list)} pages (pages {page_list[0]} to {page_list[-1]})")
