# Manimatic AI: Visualize Your Math & Problems with AI! ✨

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-✓-blue.svg)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://www.python.org/)
[![Manim](https://img.shields.io/badge/Manim-Community-brightgreen.svg)](https://www.manim.community/)

---

https://github.com/user-attachments/assets/029a0a90-d20e-4ce3-b405-b4972feeb122

## 🚀 Overview

**Manimatic AI** is an innovative web application that bridges the gap between natural language problem statements and beautiful mathematical visualizations. Simply describe a math problem or a concept in plain English, and our AI-powered backend will interpret, solve, and generate a stunning animation using the Manim animation engine, presented right in your browser!

This project aims to make complex mathematical and scientific concepts more accessible and understandable through dynamic visual explanations.

---

## ✨ Features

* **Natural Language Processing:** Understands diverse mathematical problem statements.
* **AI-Powered Problem Solving:** Solves various algebraic, geometric, and arithmetic problems based on natural language input.
* **Dynamic Visualization:** Generates high-quality animated solutions using the Manim Community Edition.
* **Real-time Interaction:** Input prompts directly via a user-friendly web interface.
* **Node.js Backend:** Robust and scalable server-side processing for orchestrating AI and Manim.
* **TypeScript Frontend & Backend:** Modern, type-safe development for both client and server.
* **Persistent Storage:** Stores generated video and audio files on the server (for demonstration purposes, if deployed on a suitable platform).

---

## 💡 How It Works

Manimatic AI operates through a sophisticated integration of technologies:

1.  **Frontend (HTML, CSS, JavaScript/TypeScript):** Users enter their problem statement into the intuitive web interface.
2.  **Backend (Node.js with Express & TypeScript):**
    * Receives the natural language prompt from the frontend.
    * Utilizes the power of a large language model (LLM, e.g., OpenAI API) to interpret the problem, devise a step-by-step solution, and generate a precise Manim-compatible Python script.
    * Executes the generated Python script by invoking the Manim command-line tool.
    * Handles audio narration generation (if implemented) and seamlessly integrates it with the Manim output.
    * Serves the final generated video file back to the frontend for playback.
3.  **Manim (Python):** Executes the dynamically generated Python script, rendering the mathematical visualization into a high-quality video file (`.mp4`).
4.  **System Utilities:** Leverages `FFmpeg` for powerful video/audio encoding/decoding, `LaTeX` for beautiful mathematical typesetting within Manim, and `Tesseract OCR` for any image-to-text functionality (if integrated).

---

## 🛠️ Getting Started

Follow these steps to set up and run Manimatic AI on your local machine for development, or on a Linux-based VPS for deployment.

### Prerequisites

Before you begin, ensure you have the following installed on your system:

* **Git:** For cloning the repository.
    * [Download Git](https://git-scm.com/downloads)
* **Node.js (v18+ recommended):** This includes `npm`, which is used for managing Node.js packages.
    * [Download Node.js](https://nodejs.org/en/download/)
* **Python (v3.9+ recommended):** The environment for Manim and other Python libraries.
    * [Download Python](https://www.python.org/downloads/)
* **pip:** Python's package installer (usually comes with Python).
* **FFmpeg:** Essential for Manim's video rendering and processing.
    * **Linux:** `sudo apt install ffmpeg`
    * **macOS:** `brew install ffmpeg` (using Homebrew)
    * **Windows:** [Download from official site](https://ffmpeg.org/download.html) and add to PATH.
* **LaTeX (TeX Live):** For high-quality mathematical typesetting in Manim.
    * **Linux:** `sudo apt install texlive-full` (comprehensive install) or `sudo apt install texlive-latex-recommended texlive-fonts-extra texlive-pictures` (smaller, often sufficient)
    * **macOS:** [MacTeX](https://www.tug.org/mactex/)
    * **Windows:** [MiKTeX](https://miktex.org/download) or [TeX Live](https://www.tug.org/texlive/acquire-iso.html)
* **Tesseract OCR:** Required for any image-to-text processing functionalities (e.g., if AI parses images for text).
    * **Linux:** `sudo apt install tesseract-ocr`
    * **macOS:** `brew install tesseract`
    * **Windows:** [Download from UB Mannheim](https://tesseract-ocr.github.io/tessdoc/Downloads.html) and add to PATH.

### Installation Steps

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/adithyanotfound/Manimatic.git
    cd Manimatic
    ```

2.  **Set Up Node.js Dependencies:**
    This installs all the packages required for your backend server.
    ```bash
    npm install
    ```

3.  **Set Up Python Environment (Manim & Libraries):**
    * Create a Python virtual environment to isolate project dependencies:
        ```bash
        python3 -m venv manim_env
        ```
    * Activate the environment:
        ```bash
        source manim_env/bin/activate   # macOS/Linux
        # .\manim_env\Scripts\activate # Windows (in PowerShell/Cmd)
        ```
    * Install Python dependencies listed in `requirements.txt`:
        ```bash
        pip install -r requirements.txt
        ```
    * Deactivate the environment when done with Python-specific tasks:
        ```bash
        deactivate
        ```

4.  **Compile TypeScript:**
    This step transpiles your `src/` TypeScript code into executable JavaScript in the `dist/` folder.
    ```bash
    npx tsc
    ```
    Verify that a `dist/` folder now exists in your project root.

### Environment Variables

You need to set up your API keys and other sensitive configurations. Create a `.env` file in the **root** of your project (the `Manimatic/` folder):
