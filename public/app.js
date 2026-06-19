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
    examTimerInterval: null,
    
    // Progress
    mastery: {} // Maps questionId (1-260) to 'mastered', 'review', or 'none'
};

// DOM Elements
const views = {
    home: document.getElementById('home-view'),
    study: document.getElementById('study-view'),
    exam: document.getElementById('exam-view'),
    result: document.getElementById('result-view')
};

const navButtons = {
    home: document.getElementById('btn-nav-home'),
    study: document.getElementById('btn-nav-study'),
    exam: document.getElementById('btn-nav-exam')
};

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
        
    } catch (error) {
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
        
    // Update Home Progress elements
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
            txtLastScore.textContent = `${res.score} / 30`;
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
    // Deactivate all views
    Object.values(views).forEach(v => v.classList.remove('active'));
    // Deactivate nav button active states
    Object.values(navButtons).forEach(b => b.classList.remove('btn-primary'));
    Object.values(navButtons).forEach(b => b.classList.add('btn-secondary'));
    
    // Activate requested view
    if (views[viewName]) {
        views[viewName].classList.add('active');
    }
    
    // Set active nav button color (except for results view which has no button)
    if (navButtons[viewName]) {
        navButtons[viewName].classList.remove('btn-secondary');
        navButtons[viewName].classList.add('btn-primary');
    }
    
    // Stop exam timer if exiting exam view
    if (viewName !== 'exam' && state.examTimerInterval) {
        clearInterval(state.examTimerInterval);
        state.examTimerInterval = null;
    }
    
    // Auto scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Setup Event Listeners
function setupEventListeners() {
    // Navigation click events
    navButtons.home.addEventListener('click', () => switchView('home'));
    navButtons.study.addEventListener('click', () => {
        switchView('study');
        renderStudyQuestion();
    });
    navButtons.exam.addEventListener('click', () => {
        startNewExam();
    });
    
    document.getElementById('app-logo-title').addEventListener('click', () => switchView('home'));
    
    // Hero buttons
    document.getElementById('btn-hero-study').addEventListener('click', () => {
        switchView('study');
        renderStudyQuestion();
    });
    document.getElementById('btn-hero-exam').addEventListener('click', () => {
        startNewExam();
    });
    
    // Study Filter Buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Find sibling buttons in same category
            const parentSection = btn.closest('.filter-section');
            parentSection.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            applyStudyFilters();
        });
    });
    
    // Study Mode Action Buttons
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
        }
    });
    
    document.getElementById('btn-mark-review').addEventListener('click', () => {
        const currentQ = state.filteredQuestions[state.currentStudyIndex];
        if (currentQ) {
            state.mastery[currentQ.id] = 'review';
            saveProgress();
            renderQuestionList(); // Update dots
            updateStudyButtonStates();
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
        if (state.currentExamIndex < 29) {
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
    
    // Result Action Buttons
    document.getElementById('btn-result-study').addEventListener('click', () => {
        switchView('study');
        renderStudyQuestion();
    });
    
    document.getElementById('btn-result-retry').addEventListener('click', () => {
        startNewExam();
    });
}

// ==================== STUDY MODE LOGIC ====================

// Filter questions and reload the browser sidebar list
function applyStudyFilters() {
    const activeCatBtn = document.querySelector('.filter-section:nth-of-type(1) .filter-btn.active');
    const activeModBtn = document.querySelector('.filter-section:nth-of-type(2) .filter-btn.active');
    
    const categoryFilter = activeCatBtn ? activeCatBtn.getAttribute('data-category') : 'all';
    const moduleFilter = activeModBtn ? activeModBtn.getAttribute('data-module') : 'all';
    
    state.filteredQuestions = state.questions.filter(q => {
        const catMatch = (categoryFilter === 'all' || q.category === categoryFilter);
        const modMatch = (moduleFilter === 'all' || q.module.toString() === moduleFilter);
        return catMatch && modMatch;
    });
    
    state.currentStudyIndex = 0;
    
    renderQuestionList();
    renderStudyQuestion();
}

// Render Left Sidebar list of questions
function renderQuestionList() {
    const listContainer = document.getElementById('study-question-list');
    listContainer.innerHTML = '';
    
    if (state.filteredQuestions.length === 0) {
        listContainer.innerHTML = '<div style="padding: 1rem; color: var(--text-muted); text-align: center;">Tidak ada soal yang cocok dengan filter.</div>';
        return;
    }
    
    state.filteredQuestions.forEach((q, index) => {
        const item = document.createElement('div');
        item.className = 'question-list-item';
        if (index === state.currentStudyIndex) {
            item.classList.add('active');
        }
        
        // Status dot class
        let dotClass = '';
        const status = state.mastery[q.id];
        if (status === 'mastered') dotClass = 'mastered';
        else if (status === 'review') dotClass = 'review';
        
        // Get short title
        let shortText = q.question;
        if (shortText.length > 55) {
            shortText = shortText.substring(0, 52) + '...';
        }
        
        item.innerHTML = `
            <div class="status-dot ${dotClass}"></div>
            <div style="flex-grow: 1;">
                <div style="font-weight: 600; font-size: 0.8rem; opacity: 0.7; margin-bottom: 0.1rem;">Modul ${q.module} - No. ${q.id}</div>
                <div>${shortText}</div>
            </div>
        `;
        
        item.addEventListener('click', () => {
            state.currentStudyIndex = index;
            renderStudyQuestion();
            
            // Highlight active item
            document.querySelectorAll('.question-list-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
        });
        
        listContainer.appendChild(item);
    });
    
    // Auto scroll list item into view if possible
    const activeItem = listContainer.querySelector('.question-list-item.active');
    if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

// Render the currently active question details card
function renderStudyQuestion() {
    const currentQ = state.filteredQuestions[state.currentStudyIndex];
    if (!currentQ) {
        // Clear card details
        document.getElementById('study-question-title').textContent = "Pilih soal dari daftar sidebar";
        document.getElementById('study-question-image').style.display = 'none';
        document.getElementById('study-answer-box').classList.remove('active');
        document.getElementById('study-answer-text').textContent = '';
        return;
    }
    
    // Set Badges
    const badgeCategory = document.getElementById('study-badge-category');
    badgeCategory.textContent = currentQ.category;
    // Set badge style
    badgeCategory.className = 'badge';
    if (currentQ.category === "Persepsi Bahaya") badgeCategory.classList.add('badge-pb');
    else if (currentQ.category === "Wawasan") badgeCategory.classList.add('badge-wawasan');
    else if (currentQ.category === "Pengetahuan") badgeCategory.classList.add('badge-pengetahuan');
    
    document.getElementById('study-badge-module').textContent = `Modul ${currentQ.module}`;
    document.getElementById('study-badge-page').textContent = `Hal. ${currentQ.page}`;
    
    // Set Question Title
    document.getElementById('study-question-title').textContent = currentQ.question;
    
    // Set Image
    const imgEl = document.getElementById('study-question-image');
    if (currentQ.image) {
        imgEl.src = currentQ.image;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }
    
    // Set Answer Text
    document.getElementById('study-answer-text').textContent = currentQ.explanation;
    
    // Reset Answer Reveal box
    document.getElementById('study-answer-box').classList.remove('active');
    
    // Update Button Highlights
    updateStudyButtonStates();
    
    // Update list selection highlight
    document.querySelectorAll('.question-list-item').forEach((el, index) => {
        if (index === state.currentStudyIndex) el.classList.add('active');
        else el.classList.remove('active');
    });
    
    // Enable/disable prev/next buttons
    document.getElementById('btn-study-prev').disabled = (state.currentStudyIndex === 0);
    document.getElementById('btn-study-next').disabled = (state.currentStudyIndex === state.filteredQuestions.length - 1);
}

// Highlight the mark states
function updateStudyButtonStates() {
    const currentQ = state.filteredQuestions[state.currentStudyIndex];
    const btnMastered = document.getElementById('btn-mark-mastered');
    const btnReview = document.getElementById('btn-mark-review');
    
    btnMastered.style.opacity = '0.6';
    btnReview.style.opacity = '0.6';
    
    if (currentQ) {
        const status = state.mastery[currentQ.id];
        if (status === 'mastered') {
            btnMastered.style.opacity = '1';
        } else if (status === 'review') {
            btnReview.style.opacity = '1';
        }
    }
}


// ==================== EXAM MODE LOGIC ====================

// Start a new test drawing 30 random questions proportionally
function startNewExam() {
    // Stop old timer
    if (state.examTimerInterval) {
        clearInterval(state.examTimerInterval);
    }
    
    // Filter questions by category
    const pbPool = state.questions.filter(q => q.category === "Persepsi Bahaya");
    const wawasanPool = state.questions.filter(q => q.category === "Wawasan");
    const pengetahuanPool = state.questions.filter(q => q.category === "Pengetahuan");
    
    // Draw proportionally: 12 PB, 9 Wawasan, 9 Pengetahuan = 30 questions
    const pbDrawn = getRandomElements(pbPool, 12);
    const wawasanDrawn = getRandomElements(wawasanPool, 9);
    const pengetahuanDrawn = getRandomElements(pengetahuanPool, 9);
    
    // Combine and shuffle the drawn list
    state.examQuestions = shuffleArray([...pbDrawn, ...wawasanDrawn, ...pengetahuanDrawn]);
    
    // Reset answers
    state.examAnswers = Array(30).fill(null);
    state.currentExamIndex = 0;
    
    // Generate and store stable shuffled options for each exam question
    state.examShuffledOptions = [];
    state.examQuestions.forEach(q => {
        // Options in questions are: index 0 is Correct answer, index 1 & 2 are distractors.
        // We create option objects: { text, originalIndex }
        const opts = q.options.map((optText, index) => ({ text: optText, originalIndex: index }));
        // Shuffle the array of option objects
        const shuffled = shuffleArray(opts);
        state.examShuffledOptions.push(shuffled);
    });
    
    // Reset Timer: 30 minutes = 1800 seconds
    state.examTimeRemaining = 1800;
    updateExamTimerDisplay();
    state.examTimerInterval = setInterval(() => {
        state.examTimeRemaining--;
        updateExamTimerDisplay();
        if (state.examTimeRemaining <= 0) {
            clearInterval(state.examTimerInterval);
            finishExam(); // Automatically submit
        }
    }, 1000);
    
    // Render the grid map
    renderExamGridMap();
    
    // Go to view
    switchView('exam');
    
    // Render first question
    renderExamQuestion();
}

// Draw N random elements from pool
function getRandomElements(arr, n) {
    const shuffled = shuffleArray([...arr]);
    return shuffled.slice(0, Math.min(n, arr.length));
}

// Durstenfeld shuffle algorithm
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Update Timer Text
function updateExamTimerDisplay() {
    const minutes = Math.floor(state.examTimeRemaining / 60);
    const seconds = state.examTimeRemaining % 60;
    const formatted = `⏱ ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const timerEl = document.getElementById('exam-txt-timer');
    timerEl.textContent = formatted;
    
    // Warning state
    if (state.examTimeRemaining < 120) { // 2 minutes left
        timerEl.style.color = 'var(--accent-rose)';
        timerEl.style.animation = 'pulse 1s infinite';
    } else {
        timerEl.style.color = '';
        timerEl.style.animation = '';
    }
}

// Render the sidebar list of 30 navigation cells
function renderExamGridMap() {
    const grid = document.getElementById('exam-grid-map');
    grid.innerHTML = '';
    
    for (let i = 0; i < 30; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.textContent = i + 1;
        
        // Classes
        if (i === state.currentExamIndex) cell.classList.add('active');
        else if (state.examAnswers[i] !== null) cell.classList.add('answered');
        
        cell.addEventListener('click', () => {
            state.currentExamIndex = i;
            renderExamQuestion();
        });
        
        grid.appendChild(cell);
    }
}

// Render the active quiz question page
function renderExamQuestion() {
    const currentQ = state.examQuestions[state.currentExamIndex];
    if (!currentQ) return;
    
    // Update Header Row
    document.getElementById('exam-txt-progress').textContent = `Soal ${state.currentExamIndex + 1} dari 30`;
    
    const catBadge = document.getElementById('exam-badge-category');
    catBadge.textContent = currentQ.category;
    catBadge.className = 'badge';
    if (currentQ.category === "Persepsi Bahaya") catBadge.classList.add('badge-pb');
    else if (currentQ.category === "Wawasan") catBadge.classList.add('badge-wawasan');
    else if (currentQ.category === "Pengetahuan") catBadge.classList.add('badge-pengetahuan');
    
    // Set Question Text
    // Note: For Persepsi Bahaya, we parsed the title as the question. Let's make it look like a real exam question:
    let qTextText = currentQ.question;
    if (currentQ.category === "Persepsi Bahaya") {
        qTextText = `Situasi: ${currentQ.question}. Tindakan apa yang paling tepat dilakukan pengendara sepeda motor?`;
    }
    document.getElementById('exam-txt-question').textContent = qTextText;
    
    // Set Image
    const imgEl = document.getElementById('exam-question-image');
    if (currentQ.image) {
        imgEl.src = currentQ.image;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }
    
    // Render Options List
    const optionsContainer = document.getElementById('exam-options-list');
    optionsContainer.innerHTML = '';
    
    const shuffledOpts = state.examShuffledOptions[state.currentExamIndex];
    const selectedAnswerIndex = state.examAnswers[state.currentExamIndex]; // index (0-2) of selected options in the shuffled list
    
    shuffledOpts.forEach((opt, index) => {
        const item = document.createElement('div');
        item.className = 'option-item';
        if (selectedAnswerIndex === index) {
            item.classList.add('selected');
        }
        
        const letter = String.fromCharCode(65 + index); // A, B, C
        item.innerHTML = `
            <div class="option-circle">${letter}</div>
            <div class="option-text">${opt.text}</div>
        `;
        
        item.addEventListener('click', () => {
            // Select this option
            state.examAnswers[state.currentExamIndex] = index;
            
            // Re-render options to show highlight
            renderExamQuestion();
            
            // Update grid cell
            renderExamGridMap();
        });
        
        optionsContainer.appendChild(item);
    });
    
    // Update navigation grid active highlight
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach((cell, idx) => {
        cell.classList.remove('active');
        cell.classList.remove('answered');
        
        if (idx === state.currentExamIndex) cell.classList.add('active');
        else if (state.examAnswers[idx] !== null) cell.classList.add('answered');
    });
    
    // Enable/disable prev/next buttons
    document.getElementById('btn-exam-prev').disabled = (state.currentExamIndex === 0);
    document.getElementById('btn-exam-next').disabled = (state.currentExamIndex === 29);
}

// Modal handling
function showConfirmModal() {
    // Count unanswered questions
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

// End exam, grade, and display results
function finishExam() {
    // Stop Timer
    if (state.examTimerInterval) {
        clearInterval(state.examTimerInterval);
        state.examTimerInterval = null;
    }
    
    // Grade exam
    let correctCount = 0;
    state.examQuestions.forEach((q, idx) => {
        const userSelectedShuffledIndex = state.examAnswers[idx];
        if (userSelectedShuffledIndex !== null) {
            const selectedOpt = state.examShuffledOptions[idx][userSelectedShuffledIndex];
            // The correct option in our parsed DB originally had index 0
            if (selectedOpt.originalIndex === 0) {
                correctCount++;
            }
        }
    });
    
    const passed = correctCount >= 21; // 70% threshold
    const percentage = Math.round((correctCount / 30) * 100);
    
    // Save to localStorage
    const examResult = {
        score: correctCount,
        percentage: percentage,
        passed: passed,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('sim_c_last_exam', JSON.stringify(examResult));
    
    // Update stats on Home
    updateDashboardStats();
    
    // Render Results View
    const txtStatus = document.getElementById('txt-result-status');
    const circleScore = document.getElementById('circle-result-score');
    const txtScore = document.getElementById('txt-result-score');
    const txtDetails = document.getElementById('txt-result-details');
    
    txtScore.textContent = correctCount;
    
    if (passed) {
        txtStatus.textContent = "LULUS";
        txtStatus.className = "result-status status-passed";
        circleScore.className = "result-score-circle passed";
        txtDetails.innerHTML = `Selamat! Anda <strong>LULUS</strong> ujian teori SIM C dengan skor <strong>${percentage}%</strong> (${correctCount} dari 30 soal benar). Pertahankan pemahaman Anda dan bersiaplah untuk ujian praktik!`;
    } else {
        txtStatus.textContent = "TIDAK LULUS";
        txtStatus.className = "result-status status-failed";
        circleScore.className = "result-score-circle failed";
        txtDetails.innerHTML = `Maaf, Anda <strong>BELUM LULUS</strong> ujian teori SIM C. Skor Anda <strong>${percentage}%</strong> (${correctCount} dari 30 soal benar). Standar kelulusan minimum adalah <strong>70% (21 soal benar)</strong>. Pelajari kembali materi di Mode Belajar.`;
    }
    
    // Render Review List
    renderResultReviewList();
    
    // Switch View
    switchView('result');
}

// Render the final exam review questions listing
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
        
        // Find correct option text (originalIndex === 0)
        const correctOptText = shuffledOpts.find(o => o.originalIndex === 0).text;
        
        const reviewItem = document.createElement('div');
        reviewItem.className = `card review-item ${isCorrect ? 'correct' : 'incorrect'}`;
        
        // Header
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
