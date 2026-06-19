with open('extracted_text/Sim-C-Modul-1.txt', 'r', encoding='utf-8') as f:
    content = f.read()

pages = content.split('\x0c')
print(pages[90].strip()) # Page 91 (index 90)
