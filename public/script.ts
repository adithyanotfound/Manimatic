// Enhanced script.ts with fixed video functionality and v0.dev-style UI
declare const marked: any;

interface ChatMessage {
    id: string;
    sender: 'User' | 'AI';
    text: string;
    timestamp: number;
    isError?: boolean;
    videoPath?: string;
    audioPath?: string;
}

interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
}

interface AppSettings {
    theme: 'dark' | 'light' | 'auto';
    autoSaveChats: boolean;
    showTimestamps: boolean;
}

class ChatManager {
    private currentSessionId: string | null = null;
    private sessions: Map<string, ChatSession> = new Map();
    private settings: AppSettings;

    constructor() {
        this.settings = this.loadSettings();
        this.loadSessions();
        this.applySettings();
    }

    private loadSettings(): AppSettings {
        const defaultSettings: AppSettings = {
            theme: 'light',
            autoSaveChats: true,
            showTimestamps: false
        };

        try {
            const saved = localStorage.getItem('manimatic_settings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch {
            return defaultSettings;
        }
    }

    private saveSettings(): void {
        localStorage.setItem('manimatic_settings', JSON.stringify(this.settings));
    }

    private loadSessions(): void {
        try {
            const saved = localStorage.getItem('manimatic_sessions');
            if (saved) {
                const sessionsData = JSON.parse(saved);
                this.sessions = new Map(Object.entries(sessionsData));
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
        }
    }

    private saveSessions(): void {
        if (!this.settings.autoSaveChats) return;
        
        try {
            const sessionsData = Object.fromEntries(this.sessions);
            localStorage.setItem('manimatic_sessions', JSON.stringify(sessionsData));
        } catch (error) {
            console.error('Failed to save sessions:', error);
        }
    }

    public applySettings(): void {
        document.documentElement.setAttribute('data-theme', this.settings.theme);
    }

    public updateSettings(newSettings: Partial<AppSettings>): void {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
        this.applySettings();
    }

    public getSettings(): AppSettings {
        return { ...this.settings };
    }

    public createNewSession(): string {
        const sessionId = this.generateId();
        const session: ChatSession = {
            id: sessionId,
            title: 'New Chat',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.sessions.set(sessionId, session);
        this.currentSessionId = sessionId;
        this.saveSessions();
        return sessionId;
    }

    public switchToSession(sessionId: string): boolean {
        if (this.sessions.has(sessionId)) {
            this.currentSessionId = sessionId;
            return true;
        }
        return false;
    }

    public getCurrentSession(): ChatSession | null {
        if (!this.currentSessionId) return null;
        return this.sessions.get(this.currentSessionId) || null;
    }

    public addMessage(sender: 'User' | 'AI', text: string, isError: boolean = false, videoPath?: string, audioPath?: string): void {
        if (!this.currentSessionId) {
            this.createNewSession();
        }

        const session = this.getCurrentSession();
        if (!session) return;

        const message: ChatMessage = {
            id: this.generateId(),
            sender,
            text,
            timestamp: Date.now(),
            isError,
            videoPath,
            audioPath
        };

        session.messages.push(message);
        session.updatedAt = Date.now();

        // Update session title based on first user message
        if (sender === 'User' && session.messages.filter(m => m.sender === 'User').length === 1) {
            session.title = text.substring(0, 50) + (text.length > 50 ? '...' : '');
        }

        this.saveSessions();
    }

    public deleteSession(sessionId: string): boolean {
        if (this.sessions.delete(sessionId)) {
            if (this.currentSessionId === sessionId) {
                this.currentSessionId = null;
            }
            this.saveSessions();
            return true;
        }
        return false;
    }

    public clearAllSessions(): void {
        this.sessions.clear();
        this.currentSessionId = null;
        this.saveSessions();
    }

    public getAllSessions(): ChatSession[] {
        return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    public exportSession(sessionId: string): string | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        const exportData = {
            title: session.title,
            createdAt: new Date(session.createdAt).toISOString(),
            messages: session.messages.map(msg => ({
                sender: msg.sender,
                text: msg.text,
                timestamp: new Date(msg.timestamp).toISOString()
            }))
        };

        return JSON.stringify(exportData, null, 2);
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("--- Enhanced v0.dev-style script loaded ---");

    // Initialize chat manager
    const chatManager = new ChatManager();

    // --- DOM Elements ---
    const chatMessages = document.getElementById('chatMessages') as HTMLDivElement;
    const textPromptInput = document.getElementById('promptInput') as HTMLTextAreaElement;
    const generateVideoFromTextBtn = document.getElementById('sendPromptBtn') as HTMLButtonElement;

    const imageUploadInput = document.getElementById('imageUpload') as HTMLInputElement;
    const uploadImageTriggerBtn = document.getElementById('uploadImageBtn') as HTMLButtonElement;
    const fileNameDisplay = document.getElementById('fileNameDisplay') as HTMLSpanElement;
    const clearImageBtn = document.getElementById('clearImageBtn') as HTMLButtonElement;
    const additionalPromptInput = document.getElementById('additionalPromptInput') as HTMLTextAreaElement;
    const generateVideoFromImageBtn = document.getElementById('sendImagePromptBtn') as HTMLButtonElement;
    const extractTextBtn = document.getElementById('extractTextBtn') as HTMLButtonElement;

    const fileUploadSection = document.getElementById('fileUploadSection') as HTMLDivElement;
    const imageActionButtons = document.getElementById('imageActionButtons') as HTMLDivElement;
    const loadingSpinner = document.getElementById('loadingSpinner') as HTMLDivElement;

    // Chat history elements
    const newChatBtn = document.getElementById('newChatBtn') as HTMLButtonElement;
    const recentChats = document.getElementById('recentChats') as HTMLDivElement;
    const clearHistoryBtn = document.getElementById('clearHistoryBtn') as HTMLButtonElement;
    const chatTitle = document.getElementById('chatTitle') as HTMLHeadingElement;

    // Settings elements
    const settingsBtn = document.getElementById('settingsBtn') as HTMLButtonElement;
    const settingsModal = document.getElementById('settingsModal') as HTMLDivElement;
    const closeSettingsModal = document.getElementById('closeSettingsModal') as HTMLSpanElement;

    // Modal elements
    const videoModal = document.getElementById('videoModal') as HTMLDivElement;
    const closeVideoModal = document.getElementById('closeVideoModal') as HTMLSpanElement;
    const modalVideoPlayer = document.getElementById('modalVideoPlayer') as HTMLVideoElement;
    const modalDownloadVideoLink = document.getElementById('modalDownloadVideoLink') as HTMLAnchorElement;
    const modalOutputAudioPlayer = document.getElementById('modalOutputAudioPlayer') as HTMLAudioElement;
    const modalDownloadAudioLink = document.getElementById('modalDownloadAudioLink') as HTMLAnchorElement;

    // Text output modal
    const textOutputModal = document.getElementById('textOutputModal') as HTMLDivElement;
    const closeTextModal = document.getElementById('closeTextModal') as HTMLSpanElement;
    const extractedTextContent = document.getElementById('extractedTextContent') as HTMLParagraphElement;
    const extractedWordCount = document.getElementById('extractedWordCount') as HTMLSpanElement;

    // Export and share buttons
    const exportChatBtn = document.getElementById('exportChatBtn') as HTMLButtonElement;
    const shareChatBtn = document.getElementById('shareChatBtn') as HTMLButtonElement;

    // --- Variables ---
    let currentSelectedImageFile: File | null = null;
    const API_BASE_URL = 'http://localhost:3000';

    // --- UI Update Functions ---
    function addMessage(sender: 'User' | 'AI', text: string, isError: boolean = false, videoPath?: string, audioPath?: string): void {
        // Add to chat manager
        chatManager.addMessage(sender, text, isError, videoPath, audioPath);

        // Create DOM element
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'User' ? 'user-message' : 'ai-message');

        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('message-avatar');
        avatarDiv.textContent = sender === 'User' ? 'U' : 'AI';

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');

        if (sender === 'AI' && typeof marked !== 'undefined') {
            contentDiv.innerHTML = marked.parse(text);
        } else {
            contentDiv.textContent = text;
        }

        // Add video button if video path is provided
        if (videoPath) {
            const videoBtn = document.createElement('button');
            videoBtn.classList.add('watch-video-btn');
            videoBtn.innerHTML = '<i class="fas fa-play"></i> Watch Video';
            videoBtn.onclick = () => {
                showVideoModal(videoPath, audioPath);
            };
            contentDiv.appendChild(videoBtn);
        }

        // Add timestamp if enabled
        if (chatManager.getSettings().showTimestamps) {
            const timestampDiv = document.createElement('div');
            timestampDiv.style.fontSize = '12px';
            timestampDiv.style.color = 'var(--text-muted)';
            timestampDiv.style.marginTop = '8px';
            timestampDiv.textContent = new Date().toLocaleTimeString();
            contentDiv.appendChild(timestampDiv);
        }

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);

        chatMessages.scrollTop = chatMessages.scrollHeight;
        updateChatHistory();
    }

    function showVideoModal(videoPath: string, audioPath?: string): void {
        modalVideoPlayer.src = `${API_BASE_URL}${videoPath}`;
        modalDownloadVideoLink.href = `${API_BASE_URL}${videoPath}`;

        if (audioPath) {
            modalOutputAudioPlayer.src = `${API_BASE_URL}${audioPath}`;
            modalDownloadAudioLink.href = `${API_BASE_URL}${audioPath}`;
            modalDownloadAudioLink.style.display = 'inline-flex';
        } else {
            modalDownloadAudioLink.style.display = 'none';
        }

        videoModal.style.display = 'flex';
    }

    function clearMessages(): void {
        chatMessages.innerHTML = '';
        showWelcomeMessage();
    }

    function showWelcomeMessage(): void {
        const welcomeDiv = document.createElement('div');
        welcomeDiv.classList.add('welcome-message');
        welcomeDiv.innerHTML = `
            <div class="welcome-content">
                <h2>How can I help you today?</h2>
                <p>I can help you with math, coding concepts, and image analysis.</p>
            </div>
            <div class="example-prompts">
                <button class="example-prompt" data-prompt="Explain the concept of recursion in programming">
                    <span class="prompt-title">Recursion in Programming</span>
                    <span class="prompt-desc">Learn about recursive functions</span>
                </button>
                <button class="example-prompt" data-prompt="How do I solve quadratic equations?">
                    <span class="prompt-title">Quadratic Equations</span>
                    <span class="prompt-desc">Step-by-step math solutions</span>
                </button>
                <button class="example-prompt" data-prompt="Explain machine learning basics">
                    <span class="prompt-title">Machine Learning</span>
                    <span class="prompt-desc">AI and ML fundamentals</span>
                </button>
            </div>
        `;
        chatMessages.appendChild(welcomeDiv);

        // Add event listeners to example prompts
        welcomeDiv.querySelectorAll('.example-prompt').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const prompt = (e.currentTarget as HTMLButtonElement).dataset.prompt;
                if (prompt) {
                    textPromptInput.value = prompt;
                    generateVideoFromTextBtn.click();
                }
            });
        });
    }

    function updateChatHistory(): void {
        const sessions = chatManager.getAllSessions();
        recentChats.innerHTML = '';

        sessions.forEach(session => {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            if (session.id === chatManager.getCurrentSession()?.id) {
                historyItem.classList.add('active');
            }

            historyItem.innerHTML = `
                <span class="history-item-text">${session.title}</span>
                <span class="history-item-delete" data-session-id="${session.id}">
                    <i class="fas fa-trash"></i>
                </span>
            `;

            // Click to switch session
            historyItem.addEventListener('click', (e) => {
                if (!(e.target as Element).closest('.history-item-delete')) {
                    switchToSession(session.id);
                }
            });

            // Delete session
            const deleteBtn = historyItem.querySelector('.history-item-delete');
            deleteBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this conversation?')) {
                    chatManager.deleteSession(session.id);
                    updateChatHistory();
                    if (session.id === chatManager.getCurrentSession()?.id) {
                        startNewChat();
                    }
                }
            });

            recentChats.appendChild(historyItem);
        });
    }

    function switchToSession(sessionId: string): void {
        if (chatManager.switchToSession(sessionId)) {
            loadCurrentSession();
            updateChatHistory();
            updateChatTitle();
        }
    }

    function loadCurrentSession(): void {
        const session = chatManager.getCurrentSession();
        clearMessages();

        if (session && session.messages.length > 0) {
            session.messages.forEach(message => {
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message', message.sender === 'User' ? 'user-message' : 'ai-message');

                const avatarDiv = document.createElement('div');
                avatarDiv.classList.add('message-avatar');
                avatarDiv.textContent = message.sender === 'User' ? 'U' : 'AI';

                const contentDiv = document.createElement('div');
                contentDiv.classList.add('message-content');

                if (message.sender === 'AI' && typeof marked !== 'undefined') {
                    contentDiv.innerHTML = marked.parse(message.text);
                } else {
                    contentDiv.textContent = message.text;
                }

                // Add video button if video path exists
                if (message.videoPath) {
                    const videoBtn = document.createElement('button');
                    videoBtn.classList.add('watch-video-btn');
                    videoBtn.innerHTML = '<i class="fas fa-play"></i> Watch Video';
                    videoBtn.onclick = () => {
                        showVideoModal(message.videoPath!, message.audioPath);
                    };
                    contentDiv.appendChild(videoBtn);
                }

                // Add timestamp if enabled
                if (chatManager.getSettings().showTimestamps) {
                    const timestampDiv = document.createElement('div');
                    timestampDiv.style.fontSize = '12px';
                    timestampDiv.style.color = 'var(--text-muted)';
                    timestampDiv.style.marginTop = '8px';
                    timestampDiv.textContent = new Date(message.timestamp).toLocaleTimeString();
                    contentDiv.appendChild(timestampDiv);
                }

                messageDiv.appendChild(avatarDiv);
                messageDiv.appendChild(contentDiv);
                chatMessages.appendChild(messageDiv);
            });
        } else {
            showWelcomeMessage();
        }

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function startNewChat(): void {
        chatManager.createNewSession();
        clearMessages();
        updateChatHistory();
        updateChatTitle();
        resetUI();
    }

    function updateChatTitle(): void {
        const session = chatManager.getCurrentSession();
        if (session) {
            chatTitle.textContent = session.title;
        } else {
            chatTitle.textContent = 'Manimatic AI Assistant';
        }
    }

    const showSpinner = (message: string = 'Processing your request...') => {
        loadingSpinner.style.display = 'flex';
        loadingSpinner.querySelector('p')!.textContent = message;
    };

    const hideSpinner = () => {
        loadingSpinner.style.display = 'none';
    };

    const resetUI = () => {
        videoModal.style.display = 'none';
        textOutputModal.style.display = 'none';
        modalVideoPlayer.src = '';
        modalOutputAudioPlayer.src = '';
        modalDownloadVideoLink.href = '#';
        modalDownloadAudioLink.href = '#';

        currentSelectedImageFile = null;
        fileNameDisplay.textContent = 'No file selected';
        fileUploadSection.style.display = 'none';
        additionalPromptInput.value = '';
        additionalPromptInput.style.height = 'auto';

        hideSpinner();
    };

    const setButtonsDisabled = (disabled: boolean) => {
        generateVideoFromTextBtn.disabled = disabled;
        generateVideoFromImageBtn.disabled = disabled;
        extractTextBtn.disabled = disabled;
        uploadImageTriggerBtn.disabled = disabled;
        textPromptInput.disabled = disabled;
        additionalPromptInput.disabled = disabled;
        imageUploadInput.disabled = disabled;
    };

    const displayError = (message: string, details?: string) => {
        setButtonsDisabled(false);
        addMessage('AI', `Error: ${message}. ${details || ''}`, true);
        hideSpinner();
    };

    // --- Event Listeners ---

    // New chat button
    newChatBtn.addEventListener('click', startNewChat);

    // Clear history button
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Clear all conversations? This cannot be undone.')) {
            chatManager.clearAllSessions();
            updateChatHistory();
            startNewChat();
        }
    });

    // Settings button
    settingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'flex';
        
        const settings = chatManager.getSettings();
        (document.getElementById('themeSelect') as HTMLSelectElement).value = settings.theme;
        (document.getElementById('autoSaveChats') as HTMLInputElement).checked = settings.autoSaveChats;
        (document.getElementById('showTimestamps') as HTMLInputElement).checked = settings.showTimestamps;
    });

    // Close modals
    closeSettingsModal.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    closeVideoModal.addEventListener('click', () => {
        videoModal.style.display = 'none';
        modalVideoPlayer.pause();
        modalOutputAudioPlayer.pause();
    });

    closeTextModal.addEventListener('click', () => {
        textOutputModal.style.display = 'none';
    });

    // Settings handlers
    document.getElementById('themeSelect')?.addEventListener('change', (e) => {
        const theme = (e.target as HTMLSelectElement).value as 'dark' | 'light' | 'auto';
        chatManager.updateSettings({ theme });
    });

    document.getElementById('autoSaveChats')?.addEventListener('change', (e) => {
        const autoSaveChats = (e.target as HTMLInputElement).checked;
        chatManager.updateSettings({ autoSaveChats });
    });

    document.getElementById('showTimestamps')?.addEventListener('change', (e) => {
        const showTimestamps = (e.target as HTMLInputElement).checked;
        chatManager.updateSettings({ showTimestamps });
        loadCurrentSession();
    });

    // Export chat button
    exportChatBtn.addEventListener('click', () => {
        const session = chatManager.getCurrentSession();
        if (session) {
            const exportData = chatManager.exportSession(session.id);
            if (exportData) {
                const blob = new Blob([exportData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_chat.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        }
    });

    // Share chat button
    shareChatBtn.addEventListener('click', async () => {
        const session = chatManager.getCurrentSession();
        if (session && navigator.share) {
            try {
                await navigator.share({
                    title: session.title,
                    text: `Check out this chat: ${session.title}`,
                    url: window.location.href
                });
            } catch (error) {
                console.log('Error sharing:', error);
            }
        }
    });

    // Auto-resize textareas
    textPromptInput.addEventListener('input', () => {
        textPromptInput.style.height = 'auto';
        textPromptInput.style.height = Math.min(textPromptInput.scrollHeight, 120) + 'px';
    });

    additionalPromptInput.addEventListener('input', () => {
        additionalPromptInput.style.height = 'auto';
        additionalPromptInput.style.height = Math.min(additionalPromptInput.scrollHeight, 80) + 'px';
    });

    // Handle Enter key
    textPromptInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            generateVideoFromTextBtn.click();
        }
    });

    // File upload
    uploadImageTriggerBtn.addEventListener('click', () => {
        imageUploadInput.click();
    });

    imageUploadInput.addEventListener('change', () => {
        if (imageUploadInput.files && imageUploadInput.files.length > 0) {
            currentSelectedImageFile = imageUploadInput.files[0];
            fileNameDisplay.textContent = currentSelectedImageFile.name;
            fileUploadSection.style.display = 'block';
            addMessage('AI', `Image selected: ${currentSelectedImageFile.name}. Choose an action below.`);
        } else {
            currentSelectedImageFile = null;
            fileNameDisplay.textContent = 'No file selected';
            fileUploadSection.style.display = 'none';
        }
    });

    clearImageBtn.addEventListener('click', () => {
        currentSelectedImageFile = null;
        fileNameDisplay.textContent = 'No file selected';
        fileUploadSection.style.display = 'none';
        imageUploadInput.value = '';
        additionalPromptInput.value = '';
        additionalPromptInput.style.height = 'auto';
    });

    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === videoModal) {
            videoModal.style.display = 'none';
            modalVideoPlayer.pause();
            modalOutputAudioPlayer.pause();
        }
        if (event.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
        if (event.target === textOutputModal) {
            textOutputModal.style.display = 'none';
        }
    });

    // Generate video from text
    generateVideoFromTextBtn.addEventListener('click', async () => {
        if (!chatManager.getCurrentSession()) {
            chatManager.createNewSession();
        }

        resetUI();
        setButtonsDisabled(true);

        const prompt = textPromptInput.value.trim();

        if (!prompt) {
            displayError('Please enter a message.');
            setButtonsDisabled(false);
            return;
        }

        addMessage('User', prompt);
        showSpinner('Generating video from text...');

        try {
            const response = await fetch(`${API_BASE_URL}/generate-video`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, includeNarration: true })
            });

            const data = await response.json();

            if (response.ok) {
                addMessage('AI', 'Video generated successfully! Click the button below to watch:', false, data.videoPath, data.audioPath);
            } else {
                displayError(data.error || 'Failed to generate video from text.', data.details);
            }
        } catch (error: any) {
            console.error('Network error:', error);
            displayError(`Network error: ${error.message}`);
        } finally {
            setButtonsDisabled(false);
            textPromptInput.value = '';
            textPromptInput.style.height = 'auto';
            hideSpinner();
        }
    });

    // Generate video from image
    generateVideoFromImageBtn.addEventListener('click', async () => {
        if (!chatManager.getCurrentSession()) {
            chatManager.createNewSession();
        }

        setButtonsDisabled(true);

        const imageFile = currentSelectedImageFile;
        const additionalPrompt = additionalPromptInput.value.trim();

        if (!imageFile) {
            displayError('Please select an image file.');
            setButtonsDisabled(false);
            return;
        }

        addMessage('User', `Generating video from image: ${imageFile.name}${additionalPrompt ? ` with prompt: "${additionalPrompt}"` : ''}`);
        showSpinner('Uploading image and generating video...');

        const formData = new FormData();
        formData.append('image', imageFile);
        formData.append('includeNarration', 'true');
        if (additionalPrompt) {
            formData.append('additionalPrompt', additionalPrompt);
        }

        try {
            const response = await fetch(`${API_BASE_URL}/generate-video-from-image`, {
                method: 'POST',
                body: formData
            });

            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (jsonError) {
                displayError('Server returned invalid response.', responseText.substring(0, 200));
                return;
            }

            if (response.ok) {
                let aiMessage = 'Video generated from image successfully!';
                if (data.extractedText) {
                    aiMessage += `\n\nExtracted text: "${data.extractedText.substring(0, 100)}${data.extractedText.length > 100 ? '...' : ''}"`;
                }
                addMessage('AI', aiMessage, false, data.videoPath, data.audioPath);
            } else {
                displayError(data.error || 'Failed to generate video from image.', data.details);
            }
        } catch (error: any) {
            console.error('Error:', error);
            displayError(`Network error: ${error.message}`);
        } finally {
            resetUI();
            setButtonsDisabled(false);
            hideSpinner();
        }
    });

    // Extract text from image
    extractTextBtn.addEventListener('click', async () => {
        if (!chatManager.getCurrentSession()) {
            chatManager.createNewSession();
        }

        setButtonsDisabled(true);

        const imageFile = currentSelectedImageFile;

        if (!imageFile) {
            displayError('Please select an image file.');
            setButtonsDisabled(false);
            return;
        }

        addMessage('User', `Extracting text from image: ${imageFile.name}`);
        showSpinner('Uploading image and extracting text...');

        const formData = new FormData();
        formData.append('image', imageFile);

        try {
            const response = await fetch(`${API_BASE_URL}/extract-text`, {
                method: 'POST',
                body: formData
            });

            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (jsonError) {
                displayError('Server returned invalid response.', responseText.substring(0, 200));
                return;
            }

            if (response.ok) {
                if (data.extractedText) {
                    extractedTextContent.textContent = data.extractedText;
                    extractedWordCount.textContent = `Word count: ${data.wordCount || 0}`;
                    textOutputModal.style.display = 'flex';
                    addMessage('AI', `Text extracted successfully!\n\n"${data.extractedText.substring(0, 200)}${data.extractedText.length > 200 ? '...' : ''}"`);
                } else {
                    addMessage('AI', 'No text found in the image.');
                }
            } else {
                displayError(data.error || 'Failed to extract text.', data.details);
            }
        } catch (error: any) {
            console.error('Error:', error);
            displayError(`Network error: ${error.message}`);
        } finally {
            resetUI();
            setButtonsDisabled(false);
            hideSpinner();
        }
    });

    // Initialize the application
    function initializeApp(): void {
        // Start with a new session if none exists
        if (!chatManager.getCurrentSession()) {
            chatManager.createNewSession();
        }

        // Load current session
        loadCurrentSession();
        updateChatHistory();
        updateChatTitle();

        // Show welcome message if no messages
        const session = chatManager.getCurrentSession();
        if (!session || session.messages.length === 0) {
            showWelcomeMessage();
        }

        console.log('Application initialized successfully.');
    }

    // Auto-save functionality
    setInterval(() => {
        if (chatManager.getSettings().autoSaveChats) {
            const session = chatManager.getCurrentSession();
            if (session) {
                session.updatedAt = Date.now();
            }
        }
    }, 30000);

    // Handle system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (chatManager.getSettings().theme === 'auto') {
            chatManager.applySettings();
        }
    });

    // Initialize the application
    initializeApp();
});