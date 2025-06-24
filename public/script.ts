// script.ts
declare const marked: any;

document.addEventListener('DOMContentLoaded', () => {
    console.log("--- script.ts loaded and DOM is ready ---");
    console.log('DOM Content Loaded event fired.');

    // --- DOM Elements ---
    const chatMessages = document.getElementById('chatMessages') as HTMLDivElement;
    const textPromptInput = document.getElementById('promptInput') as HTMLTextAreaElement;
    const includeNarrationText = document.getElementById('includeNarrationText') as HTMLInputElement;
    const generateVideoFromTextBtn = document.getElementById('sendPromptBtn') as HTMLButtonElement;

    const imageUploadInput = document.getElementById('imageUpload') as HTMLInputElement;
    const uploadImageTriggerBtn = document.getElementById('uploadImageBtn') as HTMLButtonElement;
    const fileNameDisplay = document.getElementById('fileNameDisplay') as HTMLSpanElement;
    const additionalPromptInput = document.getElementById('additionalPromptInput') as HTMLTextAreaElement;
    const includeNarrationImage = document.getElementById('includeNarrationImage') as HTMLInputElement;
    const generateVideoFromImageBtn = document.getElementById('sendImagePromptBtn') as HTMLButtonElement;
    const extractTextBtn = document.getElementById('extractTextBtn') as HTMLButtonElement;

    const imageActionButtons = document.getElementById('imageActionButtons') as HTMLDivElement;

    const loadingSpinner = document.getElementById('loadingSpinner') as HTMLDivElement;

    // NEW VIDEO MODAL ELEMENTS
    const videoModal = document.getElementById('videoModal') as HTMLDivElement;
    const closeVideoModal = document.getElementById('closeVideoModal') as HTMLSpanElement;
    const modalVideoPlayer = document.getElementById('modalVideoPlayer') as HTMLVideoElement;
    const modalDownloadVideoLink = document.getElementById('modalDownloadVideoLink') as HTMLAnchorElement;
    const modalOutputAudioPlayer = document.getElementById('modalOutputAudioPlayer') as HTMLAudioElement;
    const modalDownloadAudioLink = document.getElementById('modalDownloadAudioLink') as HTMLAnchorElement;

    const extractedTextOutputSection = document.getElementById('extractedTextOutputSection') as HTMLDivElement;
    const extractedTextContent = document.getElementById('extractedTextContent') as HTMLParagraphElement;
    const extractedWordCount = document.getElementById('extractedWordCount') as HTMLParagraphElement;

    // --- NEW: Variable to store the selected image file ---
    let currentSelectedImageFile: File | null = null;
    // --- END NEW ---

    // --- Configuration ---
    const API_BASE_URL = 'http://localhost:3000'; // IMPORTANT: Make sure this URL matches your Node.js server's address and port

    // --- UI Update Functions ---
    function addMessage(sender: 'User' | 'AI', text: string, isError: boolean = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'User' ? 'user-message' : 'ai-message');
        if (isError) {
            messageDiv.classList.add('error-message');
        }

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

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    const showSpinner = (message: string = 'Processing your request...') => {
        loadingSpinner.style.display = 'flex';
        loadingSpinner.querySelector('p')!.textContent = message;
    };

    const hideSpinner = () => {
        loadingSpinner.style.display = 'none';
        loadingSpinner.querySelector('p')!.textContent = '';
    };

    const resetUI = () => {
        // Hide the video modal and clear its content
        videoModal.style.display = 'none';
        modalVideoPlayer.src = '';
        modalOutputAudioPlayer.src = '';
        modalDownloadVideoLink.href = '#';
        modalDownloadAudioLink.href = '#';
        modalDownloadAudioLink.style.display = 'none'; // Hide audio download link
        modalOutputAudioPlayer.style.display = 'none'; // Hide audio player

        // Clear extracted text output
        extractedTextOutputSection.style.display = 'none';
        extractedTextContent.textContent = '';
        extractedWordCount.textContent = '';

        // Reset file input display and stored file
        currentSelectedImageFile = null; // Clear the stored file!
        fileNameDisplay.textContent = '';
        // imageUploadInput.value = ''; // DO NOT RESET THIS HERE, it can trigger unintended change events
        imageActionButtons.style.display = 'none';
        additionalPromptInput.value = '';
        additionalPromptInput.style.height = 'auto';

        hideSpinner(); // Ensure spinner is hidden on reset
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
        const fullMessage = `Error: ${message}${details ? ` (${details})` : ''}`;
        setButtonsDisabled(false);
        addMessage('AI', `An error occurred: ${message}. ${details || ''}`, true);
        hideSpinner();
    };

    const displaySuccess = (message: string) => {
        setButtonsDisabled(false);
        hideSpinner();
    };

    // --- Event Listeners ---

    // Adjust textarea height on input
    textPromptInput.addEventListener('input', () => {
        textPromptInput.style.height = 'auto';
        textPromptInput.style.height = textPromptInput.scrollHeight + 'px';
    });

    additionalPromptInput.addEventListener('input', () => {
        additionalPromptInput.style.height = 'auto';
        additionalPromptInput.style.height = additionalPromptInput.scrollHeight + 'px';
    });

    // Handle Enter key for text prompt
    textPromptInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            generateVideoFromTextBtn.click();
        }
    });

    // Trigger hidden file input click
    uploadImageTriggerBtn.addEventListener('click', () => {
        console.log('UPLOAD IMAGE button clicked.');
        imageUploadInput.click();
    });

    // Display selected file name and show relevant buttons
    imageUploadInput.addEventListener('change', () => {
        console.log('IMAGE FILE INPUT changed. File selected:', imageUploadInput.files?.[0]?.name);
        if (imageUploadInput.files && imageUploadInput.files.length > 0) {
            currentSelectedImageFile = imageUploadInput.files[0]; // STORE THE FILE HERE
            fileNameDisplay.textContent = currentSelectedImageFile.name;
            imageActionButtons.style.display = 'flex';
            console.log('Image selected, action buttons should now be visible. Stored file:', currentSelectedImageFile);
            addMessage('AI', `Image selected: \`${currentSelectedImageFile.name}\`. You can now generate a video or extract text.`);
        } else {
            currentSelectedImageFile = null; // CLEAR THE STORED FILE
            fileNameDisplay.textContent = '';
            imageActionButtons.style.display = 'none';
            console.log('No image selected or selection cleared. Stored file cleared.');
        }
    });

    // Close video modal when close button is clicked
    closeVideoModal.addEventListener('click', () => {
        videoModal.style.display = 'none';
        modalVideoPlayer.pause(); // Pause video when closing
        modalOutputAudioPlayer.pause(); // Pause audio when closing
    });

    // Close video modal when clicking outside of the modal content
    window.addEventListener('click', (event) => {
        if (event.target === videoModal) {
            videoModal.style.display = 'none';
            modalVideoPlayer.pause();
            modalOutputAudioPlayer.pause();
        }
    });


    // Generate video from Text Prompt
    generateVideoFromTextBtn.addEventListener('click', async () => {
        // ... (this part remains unchanged from previous script.ts) ...
        console.log('>>> "GENERATE VIDEO FROM IMAGE" button clicked! <<<');
        resetUI();
        setButtonsDisabled(true);

        const prompt = textPromptInput.value.trim();
        const includeNarration = includeNarrationText.checked;

        if (!prompt) {
            displayError('Please enter a text prompt.');
            setButtonsDisabled(false);
            return;
        }

        addMessage('User', prompt);
        showSpinner('Generating video from text...');

        try {
            const response = await fetch(`${API_BASE_URL}/generate-video`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, includeNarration })
            });

            const data = await response.json();

            if (response.ok) {
                displaySuccess('Video generated successfully!');
                addMessage('AI', `Video generated successfully! Click below to watch and download:`);
                const watchButton = document.createElement('button');
                watchButton.textContent = 'Watch Video';
                watchButton.classList.add('modal-trigger-btn');
                watchButton.onclick = () => {
                    videoModal.style.display = 'flex';
                    modalVideoPlayer.play();
                };
                addMessage('AI', '', false);
                chatMessages.lastElementChild?.querySelector('.message-content')?.appendChild(watchButton);

                modalVideoPlayer.src = `${API_BASE_URL}${data.videoPath}`;
                modalDownloadVideoLink.href = `${API_BASE_URL}${data.videoPath}`;

                if (data.audioPath) {
                    modalOutputAudioPlayer.src = `${API_BASE_URL}${data.audioPath}`;
                    modalDownloadAudioLink.href = `${API_BASE_URL}${data.audioPath}`;
                    modalDownloadAudioLink.style.display = 'inline-flex';
                    modalOutputAudioPlayer.style.display = 'block';
                } else {
                    modalDownloadAudioLink.style.display = 'none';
                    modalOutputAudioPlayer.style.display = 'none';
                }

                videoModal.style.display = 'flex';

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

    // Generate video from Image Upload
    generateVideoFromImageBtn.addEventListener('click', async () => {
        console.log('>>> "GENERATE VIDEO FROM IMAGE" button clicked! <<<');
        setButtonsDisabled(true);

        // --- IMPORTANT CHANGE: Use the stored variable instead of re-reading input.files ---
        const imageFile = currentSelectedImageFile;
        // --- END IMPORTANT CHANGE ---

        const additionalPrompt = additionalPromptInput.value.trim();
        const includeNarration = includeNarrationImage.checked;

        console.log('   - imageFile (from stored variable):', imageFile);
        console.log('   - additionalPrompt:', additionalPrompt);
        console.log('   - includeNarration:', includeNarration);


        if (!imageFile) {
            displayError('Please select an image file to generate video from.');
            setButtonsDisabled(false);
            console.error('ERROR: imageFile is missing. Execution stopped before fetch.');
            return;
        }

        addMessage('User', `Generating video from image: \`${imageFile.name}\`${additionalPrompt ? ` with additional prompt: "${additionalPrompt}"` : ''}`);
        showSpinner('Uploading image and generating video...');

        const formData = new FormData();
        formData.append('image', imageFile);
        formData.append('includeNarration', String(includeNarration));
        if (additionalPrompt) {
            formData.append('additionalPrompt', additionalPrompt);
        }

        console.log('Sending FormData:');
        for (let [key, value] of formData.entries()) {
            console.log(`    - FormData Key: ${key}, Value: ${value}`);
        }

        try {
            console.log('Attempting to FETCH to /generate-video-from-image...');
            const response = await fetch(`${API_BASE_URL}/generate-video-from-image`, {
                method: 'POST',
                body: formData
            });
            console.log('Fetch response received.');

            const responseText = await response.text();
            console.log('Raw server response text:', responseText);

            let data;
            try {
                data = JSON.parse(responseText);
                console.log('Parsed JSON data:', data);
            } catch (jsonError) {
                console.error('ERROR: Failed to parse server response as JSON.', jsonError);
                displayError('Server returned non-JSON response.', responseText.substring(0, 500) + '...');
                return;
            }

            if (response.ok) {
                displaySuccess('Video generated from image successfully!');
                let aiMessage = `Video generated from image successfully!`;
                if (data.extractedText) {
                    aiMessage += `\n\n**Extracted Text:**\n\`\`\`\n${data.extractedText.substring(0, 500)}${data.extractedText.length > 500 ? '...' : ''}\n\`\`\``;
                    extractedTextOutputSection.style.display = 'block';
                    extractedTextContent.textContent = data.extractedText;
                    extractedWordCount.textContent = `Word Count: ${data.wordCount}`;
                }
                aiMessage += `\n\nClick below to watch and download:`;
                addMessage('AI', aiMessage);

                const watchButton = document.createElement('button');
                watchButton.textContent = 'Watch Video';
                watchButton.classList.add('modal-trigger-btn');
                watchButton.onclick = () => {
                    videoModal.style.display = 'flex';
                    modalVideoPlayer.play();
                };
                addMessage('AI', '', false);
                chatMessages.lastElementChild?.querySelector('.message-content')?.appendChild(watchButton);


                modalVideoPlayer.src = `${API_BASE_URL}${data.videoPath}`;
                modalDownloadVideoLink.href = `${API_BASE_URL}${data.videoPath}`;

                if (data.audioPath) {
                    modalOutputAudioPlayer.src = `${API_BASE_URL}${data.audioPath}`;
                    modalDownloadAudioLink.href = `${API_BASE_URL}${data.audioPath}`;
                    modalDownloadAudioLink.style.display = 'inline-flex';
                    modalOutputAudioPlayer.style.display = 'block';
                } else {
                    modalDownloadAudioLink.style.display = 'none';
                    modalOutputAudioPlayer.style.display = 'none';
                }

                videoModal.style.display = 'flex';

            } else {
                displayError(data.error || 'Failed to generate video from image.', data.details);
            }
        } catch (error: any) {
            console.error('FATAL ERROR during fetch or processing:', error);
            displayError(`Network error or processing issue: ${error.message}`);
        } finally {
            resetUI(); // resetUI will now clear currentSelectedImageFile
            setButtonsDisabled(false);
            // Clear the file input's value only if you want to visually reset it,
            // but the `currentSelectedImageFile = null;` in `resetUI` is what truly matters.
            imageUploadInput.value = ''; // This line is fine to keep for visual reset.
            fileNameDisplay.textContent = ''; // Clear the text display
            currentSelectedImageFile = null; // Ensure the stored file is cleared after a submit attempt
            additionalPromptInput.value = '';
            additionalPromptInput.style.height = 'auto';
            imageActionButtons.style.display = 'none';
            hideSpinner();
            console.log('--- "Generate Video from Image" button handler finished ---');
        }
    });

    // Extract Text from Image Only
    extractTextBtn.addEventListener('click', async () => {
        console.log('>>> "EXTRACT TEXT" button clicked! <<<');
        setButtonsDisabled(true);

        // --- IMPORTANT CHANGE: Use the stored variable ---
        const imageFile = currentSelectedImageFile;
        // --- END IMPORTANT CHANGE ---

        if (!imageFile) {
            displayError('Please select an image file to extract text from.');
            setButtonsDisabled(false);
            console.error('ERROR: imageFile is missing for text extraction.');
            return;
        }

        addMessage('User', `Extracting text from image: \`${imageFile.name}\``);
        showSpinner('Uploading image and extracting text...');

        const formData = new FormData();
        formData.append('image', imageFile);

        console.log('Sending FormData for text extraction:');
        for (let [key, value] of formData.entries()) {
            console.log(`    - FormData Key: ${key}, Value: ${value}`);
        }

        try {
            console.log('Attempting to FETCH to /extract-text...');
            const response = await fetch(`${API_BASE_URL}/extract-text`, {
                method: 'POST',
                body: formData
            });
            console.log('Fetch response received.');

            const responseText = await response.text();
            console.log('Raw server response text:', responseText);

            let data;
            try {
                data = JSON.parse(responseText);
                console.log('Parsed JSON data for text extraction:', data);
            } catch (jsonError) {
                console.error('ERROR: Failed to parse server response as JSON for text extraction.', jsonError);
                displayError('Server returned non-JSON response.', responseText.substring(0, 500) + '...');
                return;
            }

            if (response.ok) {
                displaySuccess('Text extracted successfully!');
                let aiMessage = `Text extracted successfully!`;
                if (data.extractedText) {
                    aiMessage += `\n\n\`\`\`\n${data.extractedText}\n\`\`\`\n`;
                    extractedTextOutputSection.style.display = 'block';
                    extractedTextContent.textContent = data.extractedText;
                    extractedWordCount.textContent = `Word Count: ${data.wordCount}`;
                }
                addMessage('AI', aiMessage);
            } else {
                displayError(data.error || 'Failed to extract text.', data.details);
            }
        } catch (error: any) {
            console.error('FATAL ERROR during text extraction fetch or processing:', error);
            displayError(`Network error or processing issue: ${error.message}`);
        } finally {
            resetUI();
            setButtonsDisabled(false);
            imageUploadInput.value = ''; // Visual reset
            fileNameDisplay.textContent = '';
            currentSelectedImageFile = null; // Ensure stored file is cleared
            imageActionButtons.style.display = 'none';
            hideSpinner();
            console.log('--- "Extract Text" button handler finished ---');
        }
    });

    // Initial UI setup when page loads
    resetUI();
    setButtonsDisabled(false);
    addMessage('AI', "Hello! I'm your Manimatic AI Assistant. Tell me what math or coding concept you'd like a video explanation for, or upload an image to extract text!");
    console.log('Initial UI setup complete.');
});