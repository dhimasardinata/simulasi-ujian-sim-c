// App State
let state = {
    questions: [],
    filteredQuestions: [],
    currentStudyIndex: 0,
    
    // Exam state
    examQuestions: [],
    examAnswers: [], // Selected option indices (0-2) corresponding to the shuffled options
    examShuffledOptions: [], // Array of arrays of { text, originalIndex }
    currentExamIndex: 0,
    examTimeRemaining: 1800, // 30 minutes in seconds
    examTotalTime: 1800,
    examTimerInterval: null,
    
    // Progress tracking
    mastery: {} // Maps questionId (1-260) to 'mastered', 'review', or 'none'
};

// DOM Elements
const views = {
    home: document.getElementById('home-view'),
    study: document.getElementById('study-view'),
    reference: document.getElementById('reference-view'),
    exam: document.getElementById('exam-view'),
    result: document.getElementById('result-view')
};

const navButtons = {
    home: document.getElementById('btn-nav-home'),
    study: document.getElementById('btn-nav-study'),
    reference: document.getElementById('btn-nav-reference'),
    exam: document.getElementById('btn-nav-exam')
};

// ==================== PWA & REGISTER SERVICE WORKER ====================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('[PWA] Service Worker registered with scope:', reg.scope))
            .catch(err => console.error('[PWA] Service Worker registration failed:', err));
    });
}

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // Load progress from localStorage
    loadProgress();
    
    // Fetch questions
    try {
        const response = await fetch('questions.json');
        state.questions = await response.json();
        
        // Initialize dashboard stats
        updateDashboardStats();
        
        // Setup Event Listeners
        setupEventListeners();
        
        // Set default study list
        applyStudyFilters();
        
        // Render Reference View Initial Tab
        renderReferenceMaterial('peringatan');
        
    } catch (error) {
        showToast("Gagal memuat database soal. Jalankan dengan server HTTP.", "error");
        console.error("Error loading questions database:", error);
    }
});

// Load Progress from LocalStorage
function loadProgress() {
    const savedMastery = localStorage.getItem('sim_c_mastery');
    if (savedMastery) {
        state.mastery = JSON.parse(savedMastery);
    } else {
        state.mastery = {};
    }
}

// Save Progress to LocalStorage
function saveProgress() {
    localStorage.setItem('sim_c_mastery', JSON.stringify(state.mastery));
    updateDashboardStats();
}

// Update Dashboard Statistics
function updateDashboardStats() {
    let masteredCount = 0;
    
    state.questions.forEach(q => {
        if (state.mastery[q.id] === 'mastered') {
            masteredCount++;
        }
    });
    
    const percentage = state.questions.length > 0 
        ? Math.round((masteredCount / state.questions.length) * 100) 
        : 0;
        
    const txtStatMastery = document.getElementById('txt-stat-mastery');
    const barStatMastery = document.getElementById('bar-stat-mastery');
    
    if (txtStatMastery && barStatMastery) {
        txtStatMastery.innerHTML = `${percentage}% <span style="font-size: 0.95rem; font-weight: normal; color: var(--text-secondary);">${masteredCount} / ${state.questions.length} Soal Terkuasai</span>`;
        barStatMastery.style.width = `${percentage}%`;
    }
    
    // Update Badge counts in Study Mode Sidebar
    let pbTotal = 0, wawasanTotal = 0, pengetahuanTotal = 0;
    state.questions.forEach(q => {
        if (q.category === "Persepsi Bahaya") pbTotal++;
        else if (q.category === "Wawasan") wawasanTotal++;
        else if (q.category === "Pengetahuan") pengetahuanTotal++;
    });
    
    document.getElementById('badge-count-all').textContent = state.questions.length;
    document.getElementById('badge-count-pb').textContent = pbTotal;
    document.getElementById('badge-count-wawasan').textContent = wawasanTotal;
    document.getElementById('badge-count-pengetahuan').textContent = pengetahuanTotal;
    
    // Update Last Exam Stats
    const lastResult = localStorage.getItem('sim_c_last_exam');
    const txtLastScore = document.getElementById('txt-stat-last-score');
    const txtLastStatus = document.getElementById('txt-stat-last-status');
    
    if (txtLastScore && txtLastStatus) {
        if (lastResult) {
            const res = JSON.parse(lastResult);
            txtLastScore.textContent = `${res.score} / ${res.total || 30}`;
            txtLastStatus.textContent = res.passed ? 'LULUS (Ujian Terakhir)' : 'TIDAK LULUS (Ujian Terakhir)';
            txtLastStatus.className = res.passed ? 'status-passed' : 'status-failed';
        } else {
            txtLastScore.textContent = 'Belum Ujian';
            txtLastStatus.textContent = 'Ikuti simulasi untuk menguji pemahaman Anda.';
            txtLastStatus.className = '';
        }
    }
}

// Navigation / View Switching
function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    Object.values(navButtons).forEach(b => b.classList.remove('btn-primary'));
    Object.values(navButtons).forEach(b => b.classList.add('btn-secondary'));
    
    if (views[viewName]) {
        views[viewName].classList.add('active');
    }
    
    if (navButtons[viewName]) {
        navButtons[viewName].classList.remove('btn-secondary');
        navButtons[viewName].classList.add('btn-primary');
    }
    
    // Stop exam timer if exiting exam view
    if (viewName !== 'exam' && state.examTimerInterval) {
        clearInterval(state.examTimerInterval);
        state.examTimerInterval = null;
    }
    
    // Stop confetti loop if leaving result view
    if (viewName !== 'result') {
        stopConfetti();
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== WEB AUDIO API (NO-ASSET SOUND ENGINE) ====================
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    const isSoundOn = document.getElementById('toggle-sound').value === 'on';
    if (!isSoundOn) return;
    
    try {
        initAudio();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const now = audioCtx.currentTime;
        
        if (type === 'correct') {
            // High double-note chime (C5 to E5)
            const osc1 = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(523.25, now); // C5
            osc1.frequency.setValueAtTime(659.25, now + 0.1); // E5
            
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            
            osc1.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc1.start(now);
            osc1.stop(now + 0.4);
        } else if (type === 'incorrect') {
            // Low descending slide (A3 to D3)
            const osc1 = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(220.00, now); // A3
            osc1.frequency.linearRampToValueAtTime(146.83, now + 0.25); // D3
            
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            
            osc1.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc1.start(now);
            osc1.stop(now + 0.4);
        }
    } catch (e) {
        console.warn("Audio synthesis not supported or blocked by policy:", e);
    }
}

// ==================== TOAST NOTIFICATION SYSTEM ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    
    // Auto remove after animation completes
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// ==================== DATA SYNC MANAGER (IMPORT/EXPORT) ====================
function exportProgress() {
    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
            mastery: state.mastery,
            last_exam: localStorage.getItem('sim_c_last_exam')
        }));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `progres_sim_c_mastery.json`);
        dlAnchorElem.click();
        showToast("Progres belajar berhasil diekspor!", "success");
    } catch (e) {
        showToast("Gagal mengekspor progres.", "error");
    }
}

function importProgress(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data && data.mastery) {
                state.mastery = data.mastery;
                saveProgress();
                
                if (data.last_exam) {
                    localStorage.setItem('sim_c_last_exam', data.last_exam);
                }
                
                updateDashboardStats();
                applyStudyFilters();
                showToast("Progres belajar berhasil diimpor!", "success");
            } else {
                showToast("File tidak valid.", "error");
            }
        } catch (err) {
            showToast("Gagal membaca file impor.", "error");
        }
    };
    reader.readAsText(file);
}

// ==================== SETUP EVENT LISTENERS ====================
function setupEventListeners() {
    // Navigation click events
    navButtons.home.addEventListener('click', () => switchView('home'));
    navButtons.study.addEventListener('click', () => {
        switchView('study');
        renderStudyQuestion();
    });
    navButtons.reference.addEventListener('click', () => switchView('reference'));
    navButtons.exam.addEventListener('click', () => startNewExam());
    
    document.getElementById('app-logo-title').addEventListener('click', () => switchView('home'));
    
    // Hero buttons
    document.getElementById('btn-hero-study').addEventListener('click', () => {
        switchView('study');
        renderStudyQuestion();
    });
    document.getElementById('btn-hero-exam').addEventListener('click', () => startNewExam());
    
    // Data sync
    document.getElementById('btn-export-progress').addEventListener('click', exportProgress);
    
    const btnImport = document.getElementById('btn-import-progress');
    const inputImport = document.getElementById('input-import-file');
    btnImport.addEventListener('click', () => inputImport.click());
    inputImport.addEventListener('change', importProgress);
    
    // Study Filter Buttons
    const filterButtons = document.querySelectorAll('.study-sidebar .filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const parentSection = btn.closest('.filter-section');
            parentSection.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            applyStudyFilters();
        });
    });
    
    // Reference View Sidebar Tab buttons
    const refTabs = document.querySelectorAll('.reference-sidebar .filter-btn');
    refTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            refTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderReferenceMaterial(btn.getAttribute('data-ref-sec'));
        });
    });
    
    // Study Mode Actions
    document.getElementById('btn-reveal-answer').addEventListener('click', () => {
        const box = document.getElementById('study-answer-box');
        box.classList.toggle('active');
    });
    
    document.getElementById('btn-mark-mastered').addEventListener('click', () => {
        const currentQ = state.filteredQuestions[state.currentStudyIndex];
        if (currentQ) {
            state.mastery[currentQ.id] = 'mastered';
            saveProgress();
            renderQuestionList(); // Update dots
            updateStudyButtonStates();
            showToast(`Soal No. ${currentQ.id} ditandai Paham`, "success");
        }
    });
    
    document.getElementById('btn-mark-review').addEventListener('click', () => {
        const currentQ = state.filteredQuestions[state.currentStudyIndex];
        if (currentQ) {
            state.mastery[currentQ.id] = 'review';
            saveProgress();
            renderQuestionList(); // Update dots
            updateStudyButtonStates();
            showToast(`Soal No. ${currentQ.id} ditandai Perlu Review`, "info");
        }
    });
    
    document.getElementById('btn-study-prev').addEventListener('click', () => {
        if (state.currentStudyIndex > 0) {
            state.currentStudyIndex--;
            renderStudyQuestion();
        }
    });
    
    document.getElementById('btn-study-next').addEventListener('click', () => {
        if (state.currentStudyIndex < state.filteredQuestions.length - 1) {
            state.currentStudyIndex++;
            renderStudyQuestion();
        }
    });
    
    // Exam Navigation Buttons
    document.getElementById('btn-exam-prev').addEventListener('click', () => {
        if (state.currentExamIndex > 0) {
            state.currentExamIndex--;
            renderExamQuestion();
        }
    });
    
    document.getElementById('btn-exam-next').addEventListener('click', () => {
        const totalExamQuestions = state.examQuestions.length;
        if (state.currentExamIndex < totalExamQuestions - 1) {
            state.currentExamIndex++;
            renderExamQuestion();
        }
    });
    
    document.getElementById('btn-exam-finish').addEventListener('click', () => {
        showConfirmModal();
    });
    
    // Modal buttons
    document.getElementById('btn-modal-cancel').addEventListener('click', hideConfirmModal);
    document.getElementById('btn-modal-confirm').addEventListener('click', () => {
        hideConfirmModal();
        finishExam();
    });
    
    // Result View Action Buttons
    document.getElementById('btn-result-study').addEventListener('click', () => {
        switchView('study');
        renderStudyQuestion();
    });
    
    document.getElementById('btn-result-retry').addEventListener('click', startNewExam);
}

// ==================== STUDY VIEW LOGIC ====================
function applyStudyFilters() {
    const activeProgressBtn = document.querySelector('.filter-section:nth-of-type(1) .filter-btn.active');
    const activeCatBtn = document.querySelector('.filter-section:nth-of-type(2) .filter-btn.active');
    const activeModBtn = document.querySelector('.filter-section:nth-of-type(3) .filter-btn.active');
    
    const progressFilter = activeProgressBtn ? activeProgressBtn.getAttribute('data-progress-filter') : 'all';
    const categoryFilter = activeCatBtn ? activeCatBtn.getAttribute('data-category') : 'all';
    const moduleFilter = activeModBtn ? activeModBtn.getAttribute('data-module') : 'all';
    
    state.filteredQuestions = state.questions.filter(q => {
        const catMatch = (categoryFilter === 'all' || q.category === categoryFilter);
        const modMatch = (moduleFilter === 'all' || q.module.toString() === moduleFilter);
        
        let progressMatch = true;
        const status = state.mastery[q.id];
        if (progressFilter === 'review') {
            progressMatch = (status === 'review');
        } else if (progressFilter === 'unstudied') {
            progressMatch = (!status || status === 'none');
        }
        
        return catMatch && modMatch && progressMatch;
    });
    
    state.currentStudyIndex = 0;
    
    renderQuestionList();
    renderStudyQuestion();
}

function renderQuestionList() {
    const listContainer = document.getElementById('study-question-list');
    listContainer.innerHTML = '';
    
    if (state.filteredQuestions.length === 0) {
        listContainer.innerHTML = '<div style="padding: 1.5rem; color: var(--text-muted); text-align: center; font-size: 0.9rem;">Tidak ada soal yang cocok dengan filter.</div>';
        return;
    }
    
    state.filteredQuestions.forEach((q, index) => {
        const item = document.createElement('div');
        item.className = 'question-list-item';
        if (index === state.currentStudyIndex) {
            item.classList.add('active');
        }
        
        let dotClass = '';
        const status = state.mastery[q.id];
        if (status === 'mastered') dotClass = 'mastered';
        else if (status === 'review') dotClass = 'review';
        
        let shortText = q.question;
        if (shortText.length > 55) {
            shortText = shortText.substring(0, 52) + '...';
        }
        
        item.innerHTML = `
            <div class="status-dot ${dotClass}"></div>
            <div style="flex-grow: 1;">
                <div style="font-weight: 600; font-size: 0.78rem; opacity: 0.6; margin-bottom: 0.1rem;">Modul ${q.module} - No. ${q.id}</div>
                <div style="line-height: 1.3;">${shortText}</div>
            </div>
        `;
        
        item.addEventListener('click', () => {
            state.currentStudyIndex = index;
            renderStudyQuestion();
            
            document.querySelectorAll('.question-list-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
        });
        
        listContainer.appendChild(item);
    });
    
    const activeItem = listContainer.querySelector('.question-list-item.active');
    if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function renderStudyQuestion() {
    const currentQ = state.filteredQuestions[state.currentStudyIndex];
    if (!currentQ) {
        document.getElementById('study-question-title').textContent = "Filter ini kosong. Pilih filter lain di sidebar.";
        document.getElementById('study-question-image').style.display = 'none';
        document.getElementById('study-answer-box').classList.remove('active');
        document.getElementById('study-answer-text').textContent = '';
        return;
    }
    
    const badgeCategory = document.getElementById('study-badge-category');
    badgeCategory.textContent = currentQ.category;
    badgeCategory.className = 'badge';
    if (currentQ.category === "Persepsi Bahaya") badgeCategory.classList.add('badge-pb');
    else if (currentQ.category === "Wawasan") badgeCategory.classList.add('badge-wawasan');
    else if (currentQ.category === "Pengetahuan") badgeCategory.classList.add('badge-pengetahuan');
    
    document.getElementById('study-badge-module').textContent = `Modul ${currentQ.module}`;
    document.getElementById('study-badge-page').textContent = `Hal. ${currentQ.page}`;
    
    document.getElementById('study-question-title').textContent = currentQ.question;
    
    const imgEl = document.getElementById('study-question-image');
    if (currentQ.image) {
        imgEl.src = currentQ.image;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }
    
    document.getElementById('study-answer-text').textContent = currentQ.explanation;
    document.getElementById('study-answer-box').classList.remove('active');
    
    updateStudyButtonStates();
    
    document.querySelectorAll('.question-list-item').forEach((el, index) => {
        if (index === state.currentStudyIndex) el.classList.add('active');
        else el.classList.remove('active');
    });
    
    document.getElementById('btn-study-prev').disabled = (state.currentStudyIndex === 0);
    document.getElementById('btn-study-next').disabled = (state.currentStudyIndex === state.filteredQuestions.length - 1);
}

function updateStudyButtonStates() {
    const currentQ = state.filteredQuestions[state.currentStudyIndex];
    const btnMastered = document.getElementById('btn-mark-mastered');
    const btnReview = document.getElementById('btn-mark-review');
    
    btnMastered.style.opacity = '0.5';
    btnReview.style.opacity = '0.5';
    btnMastered.style.transform = '';
    btnReview.style.transform = '';
    
    if (currentQ) {
        const status = state.mastery[currentQ.id];
        if (status === 'mastered') {
            btnMastered.style.opacity = '1';
            btnMastered.style.transform = 'scale(1.05)';
        } else if (status === 'review') {
            btnReview.style.opacity = '1';
            btnReview.style.transform = 'scale(1.05)';
        }
    }
}

// ==================== REFERENCE MATERIAL VIEW ====================
const referenceData = {
    peringatan: {
        title: "Rambu Peringatan (Warning Signs)",
        intro: "Rambu peringatan digunakan untuk memberikan informasi peringatan kepada pengguna jalan tentang adanya bahaya di jalan raya di depan mereka. Ciri khas rambu ini adalah berbentuk belah ketupat, dengan warna dasar kuning, garis tepi hitam, dan lambang atau huruf berwarna hitam.",
        items: [
            { image: "images/ref_clean/m1_p11_1.png", title: "Tikungan Tajam Ke Kanan", desc: "Memberi peringatan kepada pengendara bahwa akan ada tikungan tajam ke arah kanan di depan. Pengendara wajib mengurangi kecepatan sebelum memasuki belokan." },
            { image: "images/ref_clean/m1_p12_4.png", title: "Penyempitan Badan Jalan", desc: "Peringatan bahwa jalan di depan akan menyempit dari sisi kiri, sisi kanan, atau kedua sisi. Bersiap mengurangi kecepatan dan berbagi lajur." },
            { image: "images/ref_clean/m1_p14_0.png", title: "Permukaan Jalan Licin", desc: "Peringatan bahwa permukaan jalan di depan rawan licin (terutama saat basah/hujan). Pengendara harus memperlambat motor dan menghindari pengereman mendadak." },
            { image: "images/ref_clean/m1_p21_0.png", title: "Perlintasan Kereta Api", desc: "Peringatan bahwa di depan terdapat perlintasan sebidang rel kereta api (dengan atau tanpa pintu perlintasan). Kurangi kecepatan dan berhati-hati." },
            { image: "images/ref_clean/m1_p15_3.png", title: "Persimpangan Empat Lengan", desc: "Peringatan bahwa di depan terdapat persimpangan jalan bersilang empat. Pengendara wajib memperlambat kendaraan dan meningkatkan kewaspadaan." },
            { image: "images/ref_clean/m1_p13_3.png", title: "Jalan Menurun Curam", desc: "Peringatan bahwa jalan di depan memiliki turunan yang curam. Pengendara wajib bersiap mengendalikan laju sepeda motor dengan rem depan-belakang dan engine brake." },
            { image: "images/ref_clean/m1_p15_2.png", title: "Persimpangan Bundaran", desc: "Peringatan bahwa terdapat persimpangan yang dilengkapi bundaran lalu lintas di depan. Pengendara wajib mendahulukan kendaraan yang sudah berada di dalam bundaran." }
        ]
    },
    larangan: {
        title: "Rambu Larangan (Prohibition Signs)",
        intro: "Rambu larangan melarang pengguna jalan melakukan tindakan tertentu untuk menjaga keselamatan bersama. Ciri khas rambu larangan adalah berbentuk lingkaran, dengan warna dasar putih, garis tepi berwarna merah, dan lambang atau kata-kata berwarna hitam/merah.",
        items: [
            { image: "images/ref_clean/m1_p29_2.png", title: "Larangan Parkir", desc: "Dilarang memarkirkan kendaraan bermotor di area sepanjang jalan setelah rambu ini dipasang hingga rambu pembatal terdekat." },
            { image: "images/ref_clean/m1_p29_0.png", title: "Larangan Berhenti", desc: "Dilarang menghentikan kendaraan bermotor sekecil apa pun di sepanjang area jalan setelah rambu ini terpasang." },
            { image: "images/ref_clean/m1_p29_6.png", title: "Larangan Putar Balik", desc: "Dilarang memutar balik arah kendaraan bermotor pada persimpangan atau bukaan median jalan di area setelah rambu ini." },
            { image: "images/ref_clean/m1_p29_4.png", title: "Larangan Belok Kanan", desc: "Dilarang membelokkan kendaraan ke arah kanan pada persimpangan di depan demi kelancaran lalu lintas." },
            { image: "images/ref_clean/m1_p24_1.png", title: "Larangan Masuk Sepeda Motor", desc: "Dilarang masuk bagi semua kendaraan bermotor roda dua (sepeda motor) pada lajur atau kawasan jalan tertentu." },
            { image: "images/ref_clean/m1_p24_2.png", title: "Larangan Masuk Kendaraan Bermotor", desc: "Dilarang masuk bagi semua kendaraan bermotor baik roda dua maupun roda empat dari arah rambu ini dipasang." },
            { image: "images/m1_p103_2.png", title: "Larangan Kecepatan Maksimum 60 km/jam", desc: "Dilarang melajukan kendaraan bermotor melebihi kecepatan maksimum 60 kilometer per jam demi keselamatan di area tersebut." },
            { image: "images/ref_clean/m1_p31_0.png", title: "Batas Akhir Larangan Kecepatan", desc: "Menandakan batas akhir berlakunya larangan kecepatan maksimum sebelumnya, pengendara kembali ke batas kecepatan umum." }
        ]
    },
    perintah: {
        title: "Rambu Perintah (Mandatory Signs)",
        intro: "Rambu perintah mewajibkan tindakan tertentu yang harus dilakukan oleh pengguna jalan demi kelancaran lalu lintas. Ciri khas rambu perintah adalah berbentuk lingkaran, berwarna dasar biru, garis tepi berwarna putih, dan lambang berwarna putih.",
        items: [
            { image: "images/ref_clean/m1_p34_0.png", title: "Perintah Batas Kecepatan Minimum", desc: "Perintah bagi pengguna jalan untuk melaju dengan kecepatan minimal sesuai angka tertulis (misal: 30 km/jam) demi kelancaran." },
            { image: "images/ref_clean/m1_p33_1.png", title: "Perintah Memasuki Lajur Kiri", desc: "Perintah wajib bagi pengendara untuk berjalan di lajur atau sebelah kiri rambu ini (menghindari pulau jalan atau median)." },
            { image: "images/ref_clean/m1_p32_0.png", title: "Perintah Wajib Mengikuti Arah", desc: "Pengendara wajib mengikuti salah satu arah yang ditunjuk oleh panah perintah (misalnya berbelok ke arah kiri atau kanan)." }
        ]
    },
    petunjuk: {
        title: "Rambu Petunjuk (Directional & Info Signs)",
        intro: "Rambu petunjuk memberikan arah jalan, batas daerah, letak fasilitas umum, atau informasi rute perjalanan bagi pengendara. Rambu petunjuk jalan arah rute biasanya berbentuk persegi/panjang berwarna hijau atau biru.",
        items: [
            { image: "images/ref_clean/m1_p46_1.png", title: "Petunjuk Rumah Sakit", desc: "Menunjukkan keberadaan rumah sakit atau fasilitas pelayanan kesehatan darurat di dekat jalan raya tersebut." },
            { image: "images/ref_clean/m1_p42_0.png", title: "Petunjuk Batas Wilayah", desc: "Menunjukkan batas administratif wilayah kota atau kabupaten yang sedang dimasuki oleh pengendara (misal: Batas Kota Kediri)." },
            { image: "images/ref_clean/m1_p50_6.png", title: "Petunjuk Jalan Buntu", desc: "Memberikan informasi kepada pengendara bahwa lajur jalan di depan merupakan jalan buntu (tidak dapat ditembus/dilalui terus)." },
            { image: "images/ref_clean/m1_p50_1.png", title: "Petunjuk Prioritas Arah Depan", desc: "Menunjukkan bahwa kendaraan dari arah Anda berhak mendapatkan prioritas utama saat melewati jalan menyempit." }
        ]
    },
    marka: {
        title: "Marka Jalan (Road Markings)",
        intro: "Marka jalan adalah tanda yang berada di permukaan jalan raya yang berfungsi mengatur dan menuntun pergerakan arus lalu lintas.",
        items: [
            { image: "images/m1_p94_0.png", title: "Marka Garis Utuh / Garis Stop", desc: "Berfungsi sebagai batas berhenti kendaraan saat Alat Pemberi Isyarat Lalu Lintas (APILL) menyala merah. Dilarang melintasi garis utuh membujur ini." },
            { image: "images/m1_p94_1.png", title: "Yellow Box Junction (YBJ)", desc: "Marka kotak kuning di persimpangan. Dilarang masuk ke dalam kotak kuning jika kondisi jalan keluar simpang macet, meskipun lampu hijau." },
            { image: "images/m4_p80_1.png", title: "Zebra Cross", desc: "Marka garis membujur putih-hitam sebagai penanda area penyeberangan jalan yang memberikan prioritas utama kepada pejalan kaki." }
        ]
    },
    apill: {
        title: "APILL (Alat Pemberi Isyarat Lalu Lintas)",
        intro: "APILL atau lampu lalu lintas adalah alat elektronik yang dipasang di simpang jalan untuk mengatur giliran gerak kendaraan secara tertib.",
        items: [
            { image: "images/m3_p85_0.png", title: "Alat Pemberi Isyarat Lalu Lintas", desc: "Lampu pengatur persimpangan. Lampu Merah wajib berhenti penuh di belakang garis stop. Kuning bersiap berhenti atau hati-hati. Hijau diperbolehkan melaju." }
        ]
    },
    kendaraan: {
        title: "Komponen Kendaraan Bermotor (SIM C)",
        intro: "Sebelum berkendara, pengendara sepeda motor wajib memeriksa komponen kelengkapan kendaraan bermotor sesuai standar keselamatan jalan raya.",
        items: [
            { image: "images/ref_spion.png", title: "Kaca Spion Motor", desc: "Wajib terpasang ganda di kiri dan kanan. Berfungsi membantu melihat area blind spot di belakang pengendara agar aman saat berpindah lajur." },
            { image: "images/ref_ban.png", title: "Kondisi Fisik Ban", desc: "Wajib memeriksa ketebalan alur ban (minimal 1mm) dan tekanan angin. Ban botak/halus dapat memicu slip saat jalan licin/hujan." },
            { image: "images/m4_p94_2.png", title: "Lampu Penunjuk Arah (Sein)", desc: "Lampu kuning kelap-kelip wajib dinyalakan minimal 30 meter sebelum berbelok atau berpindah lajur sebagai isyarat pengendara lain." },
            { image: "images/ref_speedometer.png", title: "Speedometer (Penunjuk Kecepatan)", desc: "Alat penunjuk kecepatan wajib terpasang dan berfungsi dengan baik agar pengendara dapat menjaga laju kendaraan sesuai batas kecepatan." },
            { image: "images/ref_klakson.png", title: "Klakson Motor", desc: "Alat pemberi isyarat suara wajib berfungsi baik dengan intensitas kebisingan suara di antara 83 desibel hingga 118 desibel." },
            { image: "images/ref_helm.png", title: "Helm Standar (SNI)", desc: "Setiap pengendara dan penumpang sepeda motor wajib menggunakan helm berstandar nasional Indonesia (SNI) demi keselamatan kepala." }
        ]
    }
};

function renderReferenceMaterial(sectionKey) {
    const panel = document.getElementById('reference-content-panel');
    const data = referenceData[sectionKey];
    if (!data) return;
    
    let html = `
        <div class="ref-section">
            <h2 class="ref-section-title">${data.title}</h2>
            <p class="ref-intro">${data.intro}</p>
            <div class="ref-grid">
    `;
    
    data.items.forEach(item => {
        html += `
            <div class="ref-card">
                <div class="ref-sign-icon-container">
                    <img src="${item.image}" alt="${item.title}" class="ref-sign-image">
                </div>
                <h3 class="ref-sign-title">${item.title}</h3>
                <p class="ref-sign-desc">${item.desc}</p>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    panel.innerHTML = html;
}


// ==================== EXAM MODE LOGIC ====================
function startNewExam() {
    if (state.examTimerInterval) {
        clearInterval(state.examTimerInterval);
    }
    
    const examType = document.getElementById('select-exam-type').value;
    
    let examPool = [];
    let numQuestions = 30;
    let durationSeconds = 1800; // default 30 min
    
    if (examType === 'official') {
        const pbPool = state.questions.filter(q => q.category === "Persepsi Bahaya");
        const wawasanPool = state.questions.filter(q => q.category === "Wawasan");
        const pengetahuanPool = state.questions.filter(q => q.category === "Pengetahuan");
        
        const pbDrawn = getRandomElements(pbPool, 12);
        const wawasanDrawn = getRandomElements(wawasanPool, 9);
        const pengetahuanDrawn = getRandomElements(pengetahuanPool, 9);
        
        examPool = [...pbDrawn, ...wawasanDrawn, ...pengetahuanDrawn];
        numQuestions = 30;
        durationSeconds = 1800;
    } else if (examType === 'sprint') {
        const pbPool = state.questions.filter(q => q.category === "Persepsi Bahaya");
        const wawasanPool = state.questions.filter(q => q.category === "Wawasan");
        const pengetahuanPool = state.questions.filter(q => q.category === "Pengetahuan");
        
        const pbDrawn = getRandomElements(pbPool, 6);
        const wawasanDrawn = getRandomElements(wawasanPool, 5);
        const pengetahuanDrawn = getRandomElements(pengetahuanPool, 4);
        
        examPool = [...pbDrawn, ...wawasanDrawn, ...pengetahuanDrawn];
        numQuestions = 15;
        durationSeconds = 900; // 15 min
    } else if (examType === 'focus-pb') {
        examPool = getRandomElements(state.questions.filter(q => q.category === "Persepsi Bahaya"), 15);
        numQuestions = 15;
        durationSeconds = 900;
    } else if (examType === 'focus-wawasan') {
        examPool = getRandomElements(state.questions.filter(q => q.category === "Wawasan"), 15);
        numQuestions = 15;
        durationSeconds = 900;
    } else if (examType === 'focus-pengetahuan') {
        examPool = getRandomElements(state.questions.filter(q => q.category === "Pengetahuan"), 15);
        numQuestions = 15;
        durationSeconds = 900;
    }
    
    state.examQuestions = shuffleArray(examPool);
    state.examAnswers = Array(numQuestions).fill(null);
    state.currentExamIndex = 0;
    state.examTimeRemaining = durationSeconds;
    state.examTotalTime = durationSeconds;
    
    // Setup stable options
    state.examShuffledOptions = [];
    state.examQuestions.forEach(q => {
        const opts = q.options.map((optText, index) => ({ text: optText, originalIndex: index }));
        state.examShuffledOptions.push(shuffleArray(opts));
    });
    
    // Timer Loop
    updateExamTimerDisplay();
    state.examTimerInterval = setInterval(() => {
        state.examTimeRemaining--;
        updateExamTimerDisplay();
        if (state.examTimeRemaining <= 0) {
            clearInterval(state.examTimerInterval);
            finishExam();
            showToast("Waktu ujian habis! Hasil ujian dikirim otomatis.", "error");
        }
    }, 1000);
    
    renderExamGridMap();
    switchView('exam');
    renderExamQuestion();
    
    showToast(`Ujian dimulai! Terdiri dari ${numQuestions} soal.`, "info");
}

function getRandomElements(arr, n) {
    const shuffled = shuffleArray([...arr]);
    return shuffled.slice(0, Math.min(n, arr.length));
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function updateExamTimerDisplay() {
    const minutes = Math.floor(state.examTimeRemaining / 60);
    const seconds = state.examTimeRemaining % 60;
    const formatted = `⏱ ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const timerEl = document.getElementById('exam-txt-timer');
    timerEl.textContent = formatted;
    
    if (state.examTimeRemaining < 120) { // 2 mins warning
        timerEl.style.color = 'var(--accent-rose)';
        timerEl.style.animation = 'pulse 1s infinite';
    } else {
        timerEl.style.color = '';
        timerEl.style.animation = '';
    }
}

function renderExamGridMap() {
    const grid = document.getElementById('exam-grid-map');
    grid.innerHTML = '';
    
    const totalExamQuestions = state.examQuestions.length;
    for (let i = 0; i < totalExamQuestions; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.textContent = i + 1;
        
        if (i === state.currentExamIndex) cell.classList.add('active');
        else if (state.examAnswers[i] !== null) cell.classList.add('answered');
        
        cell.addEventListener('click', () => {
            state.currentExamIndex = i;
            renderExamQuestion();
        });
        
        grid.appendChild(cell);
    }
}

function renderExamQuestion() {
    const currentQ = state.examQuestions[state.currentExamIndex];
    if (!currentQ) return;
    
    const totalExamQuestions = state.examQuestions.length;
    document.getElementById('exam-txt-progress').textContent = `Soal ${state.currentExamIndex + 1} dari ${totalExamQuestions}`;
    
    const catBadge = document.getElementById('exam-badge-category');
    catBadge.textContent = currentQ.category;
    catBadge.className = 'badge';
    if (currentQ.category === "Persepsi Bahaya") catBadge.classList.add('badge-pb');
    else if (currentQ.category === "Wawasan") catBadge.classList.add('badge-wawasan');
    else if (currentQ.category === "Pengetahuan") catBadge.classList.add('badge-pengetahuan');
    
    let qTextText = currentQ.question;
    if (currentQ.category === "Persepsi Bahaya") {
        qTextText = `Situasi: ${currentQ.question}. Tindakan apa yang paling tepat dilakukan pengendara sepeda motor?`;
    }
    document.getElementById('exam-txt-question').textContent = qTextText;
    
    const imgEl = document.getElementById('exam-question-image');
    if (currentQ.image) {
        imgEl.src = currentQ.image;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }
    
    const optionsContainer = document.getElementById('exam-options-list');
    optionsContainer.innerHTML = '';
    
    const shuffledOpts = state.examShuffledOptions[state.currentExamIndex];
    const selectedAnswerIndex = state.examAnswers[state.currentExamIndex];
    
    shuffledOpts.forEach((opt, index) => {
        const item = document.createElement('div');
        item.className = 'option-item';
        if (selectedAnswerIndex === index) {
            item.classList.add('selected');
        }
        
        const letter = String.fromCharCode(65 + index);
        item.innerHTML = `
            <div class="option-circle">${letter}</div>
            <div class="option-text">${opt.text}</div>
        `;
        
        item.addEventListener('click', () => {
            state.examAnswers[state.currentExamIndex] = index;
            
            // Audio Feedback
            if (opt.originalIndex === 0) {
                playSound('correct');
            } else {
                playSound('incorrect');
            }
            
            renderExamQuestion();
            renderExamGridMap();
        });
        
        optionsContainer.appendChild(item);
    });
    
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach((cell, idx) => {
        cell.classList.remove('active');
        cell.classList.remove('answered');
        
        if (idx === state.currentExamIndex) cell.classList.add('active');
        else if (state.examAnswers[idx] !== null) cell.classList.add('answered');
    });
    
    document.getElementById('btn-exam-prev').disabled = (state.currentExamIndex === 0);
    document.getElementById('btn-exam-next').disabled = (state.currentExamIndex === totalExamQuestions - 1);
}

function showConfirmModal() {
    const unansweredCount = state.examAnswers.filter(ans => ans === null).length;
    const modalDesc = document.getElementById('modal-desc');
    
    if (unansweredCount > 0) {
        modalDesc.innerHTML = `Anda masih menyisakan <strong style="color: var(--accent-rose);">${unansweredCount} soal belum terjawab</strong>. Apakah Anda yakin ingin mengakhiri ujian sekarang?`;
    } else {
        modalDesc.textContent = "Apakah Anda yakin ingin menyelesaikan ujian sekarang? Jawaban Anda akan langsung dikalkulasikan dan dinilai.";
    }
    
    document.getElementById('confirm-modal').classList.add('active');
}

function hideConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
}

function finishExam() {
    if (state.examTimerInterval) {
        clearInterval(state.examTimerInterval);
        state.examTimerInterval = null;
    }
    
    const totalExamQuestions = state.examQuestions.length;
    let correctCount = 0;
    
    state.examQuestions.forEach((q, idx) => {
        const userSelectedShuffledIndex = state.examAnswers[idx];
        if (userSelectedShuffledIndex !== null) {
            const selectedOpt = state.examShuffledOptions[idx][userSelectedShuffledIndex];
            if (selectedOpt.originalIndex === 0) {
                correctCount++;
            }
        }
    });
    
    // Passing score criteria: >= 70%
    const threshold = Math.ceil(totalExamQuestions * 0.7);
    const passed = correctCount >= threshold;
    const percentage = Math.round((correctCount / totalExamQuestions) * 100);
    
    const examResult = {
        score: correctCount,
        total: totalExamQuestions,
        percentage: percentage,
        passed: passed,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('sim_c_last_exam', JSON.stringify(examResult));
    
    // Update dashboard stats
    updateDashboardStats();
    
    // Render Results View details
    const txtStatus = document.getElementById('txt-result-status');
    const circleScore = document.getElementById('circle-result-score');
    const txtScore = document.getElementById('txt-result-score');
    const txtDetails = document.getElementById('txt-result-details');
    
    txtScore.textContent = correctCount;
    document.querySelector('#circle-result-score .score-total').textContent = `dari ${totalExamQuestions} benar`;
    
    if (passed) {
        txtStatus.textContent = "LULUS";
        txtStatus.className = "result-status status-passed";
        circleScore.className = "result-score-circle passed";
        txtDetails.innerHTML = `Selamat! Anda <strong>LULUS</strong> ujian simulasi teori SIM C dengan skor <strong>${percentage}%</strong> (${correctCount} dari ${totalExamQuestions} soal benar). Anda siap menghadapi ujian teori asli!`;
        
        // Run Confetti celebration
        startConfetti();
    } else {
        txtStatus.textContent = "TIDAK LULUS";
        txtStatus.className = "result-status status-failed";
        circleScore.className = "result-score-circle failed";
        txtDetails.innerHTML = `Maaf, Anda <strong>BELUM LULUS</strong>. Skor Anda <strong>${percentage}%</strong> (${correctCount} dari ${totalExamQuestions} soal benar). Standar kelulusan minimum adalah <strong>70% (${threshold} soal benar)</strong>. Latih kembali di Mode Belajar.`;
        
        stopConfetti();
    }
    
    renderResultReviewList();
    switchView('result');
}

function renderResultReviewList() {
    const list = document.getElementById('result-review-list');
    list.innerHTML = '';
    
    state.examQuestions.forEach((q, idx) => {
        const userSelectedShuffledIndex = state.examAnswers[idx];
        const shuffledOpts = state.examShuffledOptions[idx];
        
        let isCorrect = false;
        let userAnsText = "Tidak Dijawab";
        
        if (userSelectedShuffledIndex !== null) {
            const selectedOpt = shuffledOpts[userSelectedShuffledIndex];
            userAnsText = selectedOpt.text;
            if (selectedOpt.originalIndex === 0) {
                isCorrect = true;
            }
        }
        
        const correctOptText = shuffledOpts.find(o => o.originalIndex === 0).text;
        
        const reviewItem = document.createElement('div');
        reviewItem.className = `card review-item ${isCorrect ? 'correct' : 'incorrect'}`;
        
        const statusBadge = isCorrect 
            ? `<span class="badge badge-pengetahuan">Benar</span>` 
            : `<span class="badge badge-danger">Salah</span>`;
            
        let qText = q.question;
        if (q.category === "Persepsi Bahaya") {
            qText = `Situasi: ${q.question}. Tindakan apa yang paling tepat dilakukan pengendara sepeda motor?`;
        }
            
        reviewItem.innerHTML = `
            <div class="review-item-header">
                <div>
                    <span class="badge badge-module" style="margin-right: 0.5rem;">Soal ${idx + 1}</span>
                    <span class="badge ${q.category === "Persepsi Bahaya" ? 'badge-pb' : q.category === "Wawasan" ? 'badge-wawasan' : 'badge-pengetahuan'}">${q.category}</span>
                </div>
                ${statusBadge}
            </div>
            
            <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1rem; line-height: 1.4;">${qText}</h3>
            
            ${q.image ? `
            <div class="media-container" style="max-height: 250px; margin-bottom: 1.25rem;">
                <img src="${q.image}" alt="Review Visual" style="max-height: 250px;">
            </div>` : ''}
            
            <div class="review-user-answer ${isCorrect ? 'correct-bg' : 'incorrect-bg'}">
                <strong>Jawaban Anda:</strong> ${userAnsText}
            </div>
            
            ${!isCorrect ? `
            <div class="review-correct-answer">
                <strong>Jawaban Benar:</strong> ${correctOptText}
            </div>` : ''}
            
            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; font-size: 0.95rem; line-height: 1.5;">
                <strong style="color: var(--primary); display: block; margin-bottom: 0.25rem;">Pembahasan Resmi:</strong>
                ${q.explanation}
            </div>
        `;
        
        list.appendChild(reviewItem);
    });
}

// ==================== CONFETTI ENGINE (PURE JAVASCRIPT) ====================
let confettiCanvas = null;
let confettiCtx = null;
let confettiActive = false;
let confettiParticles = [];
let confettiAnimationId = null;

function startConfetti() {
    confettiCanvas = document.getElementById('confetti-canvas');
    if (!confettiCanvas) return;
    
    confettiCtx = confettiCanvas.getContext('2d');
    
    // Set size
    const resizeCanvas = () => {
        const rect = confettiCanvas.parentElement.getBoundingClientRect();
        confettiCanvas.width = rect.width;
        confettiCanvas.height = rect.height;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    confettiActive = true;
    confettiParticles = [];
    
    // Generate particles
    const colors = ['#6366f1', '#8b5cf6', '#10b981', '#fbbf24', '#f43f5e', '#3b82f6'];
    for (let i = 0; i < 150; i++) {
        confettiParticles.push({
            x: Math.random() * confettiCanvas.width,
            y: Math.random() * -100 - 20,
            r: Math.random() * 6 + 4,
            d: Math.random() * confettiCanvas.height,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.random() * 10 - 5,
            tiltAngleIncremental: Math.random() * 0.07 + 0.02,
            tiltAngle: 0,
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 2 - 1
        });
    }
    
    function drawConfetti() {
        if (!confettiActive) return;
        
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        
        let remaining = 0;
        confettiParticles.forEach(p => {
            p.tiltAngle += p.tiltAngleIncremental;
            p.y += p.speedY;
            p.x += p.speedX;
            p.tilt = Math.sin(p.tiltAngle) * 12;
            
            if (p.y <= confettiCanvas.height) {
                remaining++;
            } else {
                // reset to top
                p.y = -20;
                p.x = Math.random() * confettiCanvas.width;
            }
            
            confettiCtx.beginPath();
            confettiCtx.lineWidth = p.r;
            confettiCtx.strokeStyle = p.color;
            confettiCtx.moveTo(p.x + p.tilt + p.r / 2, p.y);
            confettiCtx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
            confettiCtx.stroke();
        });
        
        if (remaining > 0 && confettiActive) {
            confettiAnimationId = requestAnimationFrame(drawConfetti);
        }
    }
    
    drawConfetti();
}

function stopConfetti() {
    confettiActive = false;
    if (confettiAnimationId) {
        cancelAnimationFrame(confettiAnimationId);
        confettiAnimationId = null;
    }
    if (confettiCtx && confettiCanvas) {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
}
