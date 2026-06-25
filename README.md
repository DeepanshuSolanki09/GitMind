# 🤖 GitMind Explainer — AI-Powered GitHub Assistant

GitMind Explainer is a production-ready **Chrome Extension (Manifest V3)** built to accelerate developer onboarding and streamline code reviews directly within the GitHub UI. By leveraging the **Gemini API** and **GitHub REST API**, it breaks down massive repositories into digestible architectural summaries and actionable insights.

## ✨ Key Features
- **Project Architecture Mapping:** Generates high-level structural overviews and smart "where-to-start" reading guides for any public or private repository.
- **Context-Aware Page Detection:** Dynamically adapts its interface when navigating to Pull Requests or Issues, adding dedicated panels for specialized workflows.
- **Automated PR Reviews:** Parses raw git patches (`application/vnd.github.v3.diff`) up to 4,000 characters to highlight potential bugs and performance issues.
- **Issue Solver & File Recommender:** Maps recursive file trees against issue descriptions to recommend exact files requiring modification.
- **Secure Key Management:** Uses `chrome.storage.local` to securely handle user Gemini API keys and GitHub Personal Access Tokens (PAT).
- **Onboarding Guide Export:** Allows developers to download generated summaries instantly as offline Markdown (`.md`) manuals.

## 🛠️ Tech Stack
- **Frontend:** HTML5, CSS3 (Modern/Minimal UI), JavaScript (ES6+)
- **APIs & Core:** Chrome Extensions API (MV3), GitHub REST API, Google Gemini API
- **Storage:** Client-side local storage (`chrome.storage.local`)
