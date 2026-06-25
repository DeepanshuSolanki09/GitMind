document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - General Setup
  const apiKeyInput = document.getElementById('api-key-input');
  const toggleKeyBtn = document.getElementById('toggle-key-btn');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const keyStatus = document.getElementById('key-status');
  const patInput = document.getElementById('pat-input');
  const togglePatBtn = document.getElementById('toggle-pat-btn');
  const patStatus = document.getElementById('pat-status');
  const statusCard = document.getElementById('status-card');
  const analyzeBtn = document.getElementById('analyze-btn');
  const loader = document.getElementById('loader');
  const loaderText = document.getElementById('loader-text');
  const resultsPanel = document.getElementById('results-panel');
  const resultsContent = document.getElementById('results-content');
  const eyeIcon = document.getElementById('eye-icon');
  const eyeIconPat = document.getElementById('eye-icon-pat');
  const modelSelect = document.getElementById('model-select');

  // DOM Elements - Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // DOM Elements - Languages Dashboard
  const languagesDashboard = document.getElementById('languages-dashboard');
  const languagesBar = document.getElementById('languages-bar');
  const languagesList = document.getElementById('languages-list');

  // DOM Elements - Explorer
  const explorerTree = document.getElementById('explorer-tree');
  const explorerInfo = document.getElementById('explorer-info');

  // DOM Elements - Chat
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-btn');

  // DOM Elements - Export Guide Button
  const exportGuideBtn = document.getElementById('export-guide-btn');

  // DOM Elements - Inspector Modal
  const fileInspectorModal = document.getElementById('file-inspector-modal');
  const inspectorFileName = document.getElementById('inspector-file-name');
  const inspectorCloseBtn = document.getElementById('inspector-close-btn');
  const inspectorLoader = document.getElementById('inspector-loader');
  const inspectorContent = document.getElementById('inspector-content');

  // State Variables
  let owner = '';
  let repo = '';
  let prNumber = '';
  let issueNumber = '';
  let pageMode = 'repo'; // 'repo' | 'pr' | 'issue'
  let isGitHubRepo = false;
  
  let repoStructureText = ''; // Stored structure string for Chat context
  let readmeText = ''; // Stored readme context
  let fileTreeData = []; // Full recursive tree nodes array
  let chatHistory = []; // Simple array to track chat logs [{role: 'user'|'model', text: ''}]
  let lastOverviewMarkdown = ''; // Stores generated overview markdown for export

  // Language color map for visual bar
  const langColors = {
    'JavaScript': '#f1e05a',
    'TypeScript': '#3178c6',
    'HTML': '#e34c26',
    'CSS': '#563d7c',
    'Python': '#3572a5',
    'C++': '#f34b7d',
    'Java': '#b07219',
    'Rust': '#dea584',
    'Go': '#00add8',
    'Ruby': '#701516',
    'PHP': '#4f5d95',
    'Shell': '#89e051',
    'Vue': '#41b883',
    'Swift': '#f05138',
    'Kotlin': '#a97bff',
    'C#': '#178600'
  };

  // 1. Initialize API Keys & PAT Tokens from Chrome Storage
  const DEFAULT_API_KEY = 'please replace_with_your_own_gemini_api_key';
  chrome.storage.local.get(['geminiApiKey', 'githubPat'], (result) => {
    const activeKey = result.geminiApiKey || DEFAULT_API_KEY;
    if (activeKey) {
      apiKeyInput.value = activeKey;
      keyStatus.textContent = 'Saved';
      keyStatus.style.color = '#10b981'; // Success Green
      if (!result.geminiApiKey) {
        chrome.storage.local.set({ geminiApiKey: DEFAULT_API_KEY });
      }
    }
    if (result.githubPat) {
      patInput.value = result.githubPat;
      patStatus.textContent = 'Saved';
      patStatus.style.color = '#10b981';
    }
    updateAnalyzeBtnState();
  });

  // 2. Detect Active Tab URL & Extract Context (Repo, PR, or Issue)
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      updateStatusCard('error-state', 'Could not access active tab.');
      return;
    }
    const currentUrl = tabs[0].url;
    parseGitHubUrl(currentUrl);
  });

  // 3. Parse GitHub URL for Owner, Repository, PR #, or Issue #
  function parseGitHubUrl(url) {
    if (!url) {
      updateStatusCard('error-state', 'No active tab URL detected.');
      return;
    }

    // Matches pull request pages
    const prRegex = /^https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9-._]+)\/([a-zA-Z0-9-._]+)\/pull\/(\d+)/;
    const prMatch = url.match(prRegex);

    // Matches issue pages
    const issueRegex = /^https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9-._]+)\/([a-zA-Z0-9-._]+)\/issues\/(\d+)/;
    const issueMatch = url.match(issueRegex);

    // Matches repository main paths
    const repoRegex = /^https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9-._]+)\/([a-zA-Z0-9-._]+)/;
    const repoMatch = url.match(repoRegex);

    if (prMatch) {
      owner = prMatch[1];
      repo = prMatch[2];
      prNumber = prMatch[3];
      pageMode = 'pr';
      isGitHubRepo = true;
      updateStatusCard('detected', `PR Page Detected:<br><span class="repo-name">${owner} / ${repo} (PR #${prNumber})</span>`);
      // Toggle dynamic tabs
      document.getElementById('tab-btn-pr').style.display = 'block';
      document.getElementById('tab-btn-issue').style.display = 'none';
      loadLanguagesDashboard(owner, repo);
    } else if (issueMatch) {
      owner = issueMatch[1];
      repo = issueMatch[2];
      issueNumber = issueMatch[3];
      pageMode = 'issue';
      isGitHubRepo = true;
      updateStatusCard('detected', `Issue Page Detected:<br><span class="repo-name">${owner} / ${repo} (Issue #${issueNumber})</span>`);
      // Toggle dynamic tabs
      document.getElementById('tab-btn-issue').style.display = 'block';
      document.getElementById('tab-btn-pr').style.display = 'none';
      loadLanguagesDashboard(owner, repo);
    } else if (repoMatch) {
      owner = repoMatch[1];
      repo = repoMatch[2];
      pageMode = 'repo';
      isGitHubRepo = true;
      updateStatusCard('detected', `Repository detected:<br><span class="repo-name">${owner} / ${repo}</span>`);
      // Hide dynamic tabs
      document.getElementById('tab-btn-pr').style.display = 'none';
      document.getElementById('tab-btn-issue').style.display = 'none';
      loadLanguagesDashboard(owner, repo);
    } else {
      isGitHubRepo = false;
      updateStatusCard('error-state', 'Not on a GitHub repository.<br><span style="font-size: 11px; color: var(--text-muted);">Open a repo, PR, or Issue page (e.g. github.com/owner/repo).</span>');
      document.getElementById('tab-btn-pr').style.display = 'none';
      document.getElementById('tab-btn-issue').style.display = 'none';
    }
    updateAnalyzeBtnState();
  }

  // Helper to update Repository status card
  function updateStatusCard(state, htmlContent) {
    statusCard.className = `status-card ${state}`;
    statusCard.innerHTML = htmlContent;
  }

  // 4. Load Languages Dashboard
  async function loadLanguagesDashboard(owner, repo) {
    const token = patInput.value.trim();
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/languages`;
      const response = await fetch(url, { headers: getGitHubHeaders(token) });
      if (!response.ok) return;

      const data = await response.json();
      const languages = Object.entries(data);
      if (languages.length === 0) return;

      const totalBytes = languages.reduce((sum, [_, bytes]) => sum + bytes, 0);

      // Reset
      languagesBar.innerHTML = '';
      languagesList.innerHTML = '';

      languages.forEach(([lang, bytes]) => {
        const percentage = ((bytes / totalBytes) * 100).toFixed(1);
        if (parseFloat(percentage) < 1.0) return;

        const color = langColors[lang] || '#4b5563';

        // Create segment bar block
        const segment = document.createElement('div');
        segment.style.width = `${percentage}%`;
        segment.style.backgroundColor = color;
        segment.style.height = '100%';
        segment.title = `${lang}: ${percentage}%`;
        languagesBar.appendChild(segment);

        // Create text indicator
        const item = document.createElement('span');
        item.style.display = 'inline-flex';
        item.style.alignItems = 'center';
        item.style.gap = '4px';
        item.innerHTML = `
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${color};"></span>
          <span>${lang} <strong>${percentage}%</strong></span>
        `;
        languagesList.appendChild(item);
      });

      languagesDashboard.style.display = 'flex';
    } catch (e) {
      console.warn('Failed to load languages dashboard:', e);
    }
  }

  // 5. Tabs Switching Event Handlers
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      tabContents.forEach(content => {
        content.classList.remove('active-content');
      });
      document.getElementById(`tab-${targetTab}`).classList.add('active-content');
    });
  });

  // 6. Handle Save API Key & Token Click
  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    const pat = patInput.value.trim();

    const saveObj = { geminiApiKey: key, githubPat: pat };

    chrome.storage.local.set(saveObj, () => {
      keyStatus.textContent = 'Saved';
      keyStatus.style.color = '#10b981';
      if (pat) {
        patStatus.textContent = 'Saved';
        patStatus.style.color = '#10b981';
      } else {
        patStatus.textContent = 'Not Saved';
        patStatus.style.color = '';
      }

      // Animation feedback
      const originalHtml = saveKeyBtn.innerHTML;
      saveKeyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg> Keys Updated!
      `;
      saveKeyBtn.style.background = 'rgba(255, 255, 255, 0.08)';
      saveKeyBtn.style.color = '#ffffff';
      saveKeyBtn.style.borderColor = 'rgba(255, 255, 255, 0.3)';

      setTimeout(() => {
        saveKeyBtn.innerHTML = originalHtml;
        saveKeyBtn.style.background = '';
        saveKeyBtn.style.color = '';
        saveKeyBtn.style.borderColor = '';
      }, 1500);

      updateAnalyzeBtnState();
    });
  });

  // 7. Toggle Inputs Visibility
  toggleKeyBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    eyeIcon.innerHTML = isPassword 
      ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`
      : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
  });

  togglePatBtn.addEventListener('click', () => {
    const isPassword = patInput.type === 'password';
    patInput.type = isPassword ? 'text' : 'password';
    eyeIconPat.innerHTML = isPassword 
      ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`
      : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
  });

  apiKeyInput.addEventListener('input', updateAnalyzeBtnState);

  function updateAnalyzeBtnState() {
    const hasKey = apiKeyInput.value.trim().length > 0;
    analyzeBtn.disabled = !(isGitHubRepo && hasKey);
  }

  // 8. Centralized Headers Getter
  function getGitHubHeaders(token) {
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }
    return headers;
  }

  // 9. Centralized Gemini Fetch Handler with Fallbacks
  async function queryGemini(apiKey, prompt, selectedModel) {
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    const defaultModels = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    const models = [selectedModel, ...defaultModels.filter(m => m !== selectedModel)];
    let lastError = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          let errorMessage = `HTTP Error ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData?.error?.message) {
              errorMessage = errorData.error.message;
            }
          } catch (e) {}
          throw new Error(errorMessage);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Gemini API returned an empty response.');
        return text;
      } catch (error) {
        lastError = error;
        console.warn(`Model ${model} failed: ${error.message}. Trying next...`);
      }
    }
    throw new Error(lastError.message);
  }

  // 10. Handle Analyze Button Click
  analyzeBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const token = patInput.value.trim();
    const selectedModel = modelSelect.value;
    if (!apiKey || !owner || !repo) return;

    // Auto-save key & PAT to storage
    const saveObj = { geminiApiKey: apiKey, githubPat: token };
    chrome.storage.local.set(saveObj, () => {
      keyStatus.textContent = 'Saved';
      keyStatus.style.color = '#10b981';
      if (token) {
        patStatus.textContent = 'Saved';
        patStatus.style.color = '#10b981';
      }
    });

    // Reset results & show loader
    resultsPanel.style.display = 'none';
    resultsContent.innerHTML = '';
    loader.style.display = 'flex';
    loaderText.textContent = 'Fetching recursive repository tree...';
    analyzeBtn.disabled = true;

    // Clear dynamic sub-panels
    document.getElementById('pr-review-container').innerHTML = `<div style="text-align: center; padding: 24px 0; font-style: italic; color: var(--text-muted);">Analyzing PR modifications...</div>`;
    document.getElementById('issue-solve-container').innerHTML = `<div style="text-align: center; padding: 24px 0; font-style: italic; color: var(--text-muted);">Solving Issue context...</div>`;
    document.getElementById('commits-summary-panel').style.display = 'none';
    exportGuideBtn.style.display = 'none';

    // Route active view based on Page Mode
    if (pageMode === 'pr') {
      document.getElementById('tab-btn-pr').click();
    } else if (pageMode === 'issue') {
      document.getElementById('tab-btn-issue').click();
    } else {
      document.querySelector('[data-tab="overview"]').click();
    }

    try {
      // Step A: Fetch folder structure (Recursive)
      const contents = await fetchRepoContents(owner, repo, token);
      fileTreeData = contents; 
      
      // Step B: Fetch README file (Grounding context)
      loaderText.textContent = 'Fetching codebase documentation...';
      readmeText = await fetchRepoReadme(owner, repo, token);

      loaderText.textContent = 'Analyzing architecture overview...';
      repoStructureText = formatRepoStructure(contents);

      // Step C: Send main prompt to Gemini
      const geminiResult = await callGeminiAPI(apiKey, repoStructureText, readmeText, selectedModel);
      lastOverviewMarkdown = geminiResult; // Save for download
      resultsContent.innerHTML = formatMarkdownToHTML(geminiResult);
      exportGuideBtn.style.display = 'flex'; // reveal download

      // Populate file explorer tree & Q&A
      renderExplorerTree(contents);
      enableChat();

      // Step D: Fetch and Summarize Commits (Optional, doesn't block main response)
      loaderText.textContent = 'Fetching recent commit history...';
      try {
        const commits = await fetchRepoCommits(owner, repo, token);
        if (commits && commits.length > 0) {
          loaderText.textContent = 'Summarizing commit updates...';
          const commitsText = commits.map(c => `- ${c.commit.author.name}: ${c.commit.message.split('\n')[0]}`).join('\n');
          const commitsSummary = await callCommitsSummarizerAPI(apiKey, commitsText, selectedModel);
          document.getElementById('commits-summary-content').innerHTML = formatMarkdownToHTML(commitsSummary);
          document.getElementById('commits-summary-panel').style.display = 'flex';
        }
      } catch (ce) {
        console.warn('Commits fetch/summary ignored:', ce);
      }

      // Step E: PR Review (if in PR mode)
      if (pageMode === 'pr') {
        loaderText.textContent = 'Fetching Pull Request diff...';
        const prDiff = await fetchPRDiff(owner, repo, prNumber, token);
        loaderText.textContent = 'Analyzing PR modifications...';
        const reviewResult = await callPRReviewerAPI(apiKey, prDiff, selectedModel);
        document.getElementById('pr-review-container').innerHTML = formatMarkdownToHTML(reviewResult);
      }

      // Step F: Issue Solver (if in Issue mode)
      if (pageMode === 'issue') {
        loaderText.textContent = 'Fetching Issue details...';
        const issueData = await fetchIssueDetails(owner, repo, issueNumber, token);
        loaderText.textContent = 'Drafting AI fix solution...';
        const solverResult = await callIssueSolverAPI(apiKey, issueData.title, issueData.body, repoStructureText, selectedModel);
        document.getElementById('issue-solve-container').innerHTML = formatMarkdownToHTML(solverResult);
      }

      loader.style.display = 'none';
      resultsPanel.style.display = 'block';

    } catch (error) {
      loader.style.display = 'none';
      resultsContent.innerHTML = `
        <div style="color: #ef4444; font-weight: 500; display: flex; align-items: flex-start; gap: 6px;">
          <span>⚠️</span>
          <span>${escapeHtml(error.message)}</span>
        </div>
      `;
      resultsPanel.style.display = 'block';
    } finally {
      updateAnalyzeBtnState();
    }
  });

  // 11. GitHub API Fetchers
  async function fetchRepoContents(owner, repo, token) {
    const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const repoResponse = await fetch(repoUrl, { headers: getGitHubHeaders(token) });

    if (!repoResponse.ok) {
      if (repoResponse.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Please configure a GitHub Token (PAT).');
      } else if (repoResponse.status === 404) {
        throw new Error('Repository not found. Is it private? Please save a valid GitHub PAT.');
      }
      throw new Error(`GitHub error: ${repoResponse.statusText} (${repoResponse.status})`);
    }

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch || 'main';

    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`;
    const treeResponse = await fetch(treeUrl, { headers: getGitHubHeaders(token) });

    if (!treeResponse.ok) {
      if (treeResponse.status === 403) {
        throw new Error('GitHub API rate limit exceeded while loading repository file structure.');
      }
      throw new Error(`Failed to fetch tree structure: ${treeResponse.statusText}`);
    }

    const treeData = await treeResponse.json();
    return treeData.tree || [];
  }

  async function fetchRepoReadme(owner, repo, token) {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3.raw',
          ...(token ? { 'Authorization': `token ${token}` } : {})
        }
      });
      if (!response.ok) return '';
      const text = await response.text();
      return text.slice(0, 2000); // 2k limit
    } catch (e) {
      return '';
    }
  }

  async function fetchRepoCommits(owner, repo, token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`;
    const response = await fetch(url, { headers: getGitHubHeaders(token) });
    if (!response.ok) throw new Error('Commits fetch failed');
    return await response.json();
  }

  async function fetchPRDiff(owner, repo, number, token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3.diff',
        ...(token ? { 'Authorization': `token ${token}` } : {})
      }
    });
    if (!response.ok) throw new Error('PR diff fetch failed');
    const text = await response.text();
    return text.slice(0, 4000); // 4k diff limit
  }

  async function fetchIssueDetails(owner, repo, number, token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${number}`;
    const response = await fetch(url, { headers: getGitHubHeaders(token) });
    if (!response.ok) throw new Error('Issue fetch failed');
    return await response.json();
  }

  // 12. Structure Formatter (Filter out assets)
  function formatRepoStructure(tree) {
    if (!Array.isArray(tree)) return '';

    const items = [];
    const ignoredExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.eot',
      '.ico', '.mp3', '.mp4', '.pdf', '.zip', '.tar', '.gz', '.dmg', '.exe'
    ];

    for (const node of tree) {
      const isDir = node.type === 'tree';
      const path = node.path;
      
      if (!isDir && ignoredExtensions.some(ext => path.toLowerCase().endsWith(ext))) {
        continue;
      }

      if (isDir) {
        items.push(`📁 ${path}/`);
      } else {
        items.push(`📄 ${path}`);
      }
    }

    const totalCount = items.length;
    if (items.length > 250) {
      const slicedItems = items.slice(0, 250);
      slicedItems.push(`... [Truncated ${totalCount - 250} more files to fit token limit]`);
      return slicedItems.join('\n');
    }

    return items.join('\n');
  }

  // 13. Gemini Prompt Generators
  async function callGeminiAPI(apiKey, structureText, readmeContext, selectedModel) {
    let prompt = `You are a world-class code architect. Analyze the root and nested directory structure of this GitHub repository: "${owner}/${repo}".
Here are the files and folders found in the repository:
\`\`\`
${structureText}
\`\`\`
`;
    if (readmeContext) {
      prompt += `
Here is a snippet of the repository README.md for extra startup and configuration context:
\`\`\`
${readmeContext}
\`\`\`
`;
    }
    prompt += `
Based on these files, generate a clean, developer-focused summary with the following four sections:
1. "### Architecture Overview"
   Provide exactly 3 concise, information-rich bullet points identifying:
   - What kind of project this is (e.g., React SPA, Node.js backend, Python library) and its main technologies based on configuration files (like package.json, requirements.txt, Cargo.toml).
   - How the codebase is structurally organized (e.g., source folders, config layout).
   - The primary programming languages being used.

2. "### Key Components & Modules"
   Provide a detailed, bulleted explanation identifying and explaining the main components or functional modules present in this repository (e.g. database models, backend API controllers/routes, frontend UI components/pages, utility helpers, test suites, deployment scripts) based on the subfolders and files shown. Explain their role in the application architecture.

3. "### File & Folder Breakdown"
   Provide a bulleted list explaining the purpose of the primary files and folders detected in the root (e.g. what \`src/\`, \`tests/\`, \`package.json\`, \`tsconfig.json\`, or \`Dockerfile\` represent in this specific repository). Only explain files and folders that are actually present in the list above.

4. "### Where to Start Reading"
   Provide a single concise, practical paragraph outlining exactly which files or folders a developer should look at first to understand the entry point or core logic of this codebase.

Formatting rules:
- Do NOT add any preamble or sign-offs. Start directly with the first header.
- Use '###' for headers.
- Use '*' for bullet points.
- Wrap file names, folder names, and code symbols in single backticks (e.g. \`src/\`, \`index.js\`).`;

    return await queryGemini(apiKey, prompt, selectedModel);
  }

  async function callCommitsSummarizerAPI(apiKey, commitsText, selectedModel) {
    const prompt = `You are a technical lead. Summarize the recent work done in the repository based on the following commit logs in exactly 2 or 3 concise sentences. Focus on major updates, fixes, and updates.
    
Commits:
${commitsText}`;
    return await queryGemini(apiKey, prompt, selectedModel);
  }

  async function callPRReviewerAPI(apiKey, prDiff, selectedModel) {
    const prompt = `You are a senior software engineer doing a Pull Request code review. Analyze this PR diff:
\`\`\`diff
${prDiff}
\`\`\`

Provide a high-quality code review structured exactly with these three headings:
1. "### Changes Summary"
   A 2-3 sentence overview of what this Pull Request modifies.
2. "### Quality & Bugs"
   A bulleted list identifying potential issues, syntax mistakes, or edge cases. If changes look clean, state that they look clean.
3. "### Performance & Security"
   Any optimizations or security concerns to address.`;
    return await queryGemini(apiKey, prompt, selectedModel);
  }

  async function callIssueSolverAPI(apiKey, issueTitle, issueBody, structureText, selectedModel) {
    const prompt = `You are a principal software engineer. Recommend a fix for this GitHub issue inside the repository:
Issue Title: "${issueTitle}"
Description:
${issueBody}

Here is the codebase directory tree layout:
\`\`\`
${structureText}
\`\`\`

Provide a practical solution with these headings:
1. "### Recommended Files to Modify"
   List the specific files from the tree that likely need modifications to fix this issue.
2. "### Step-by-Step Fix Solution"
   Provide a brief, logical guide of changes or pseudocode showing how the fix should be implemented.`;
    return await queryGemini(apiKey, prompt, selectedModel);
  }

  // 14. Render Explorer Tree
  function renderExplorerTree(tree) {
    explorerTree.innerHTML = '';
    explorerInfo.textContent = 'Explore the directory tree below. Click on any file path to load an AI summary explaining its purpose.';

    const files = tree.filter(node => node.type === 'blob');
    
    if (files.length === 0) {
      explorerTree.innerHTML = '<div style="color: var(--text-muted); font-style: italic;">No files found in repository.</div>';
      return;
    }

    files.sort((a, b) => a.path.localeCompare(b.path));
    const displayFiles = files.slice(0, 100);

    displayFiles.forEach(file => {
      const item = document.createElement('div');
      item.className = 'explorer-item file';
      item.innerHTML = `📄 <span style="text-decoration: underline;">${escapeHtml(file.path)}</span>`;
      
      item.addEventListener('click', () => {
        openFileInspector(file.path);
      });
      explorerTree.appendChild(item);
    });

    if (files.length > 100) {
      const msg = document.createElement('div');
      msg.style.padding = '8px';
      msg.style.fontSize = '11px';
      msg.style.color = 'var(--text-muted)';
      msg.style.textAlign = 'center';
      msg.textContent = `... showing first 100 of ${files.length} files`;
      explorerTree.appendChild(msg);
    }
  }

  // 15. File Inspector Modal Overlay Popup
  async function openFileInspector(filePath) {
    const apiKey = apiKeyInput.value.trim();
    const token = patInput.value.trim();
    const selectedModel = modelSelect.value;
    if (!apiKey) return;

    fileInspectorModal.style.display = 'flex';
    inspectorFileName.textContent = filePath;
    inspectorLoader.style.display = 'flex';
    inspectorContent.innerHTML = '';

    try {
      const codeContent = await fetchFileRawContent(owner, repo, filePath, token);
      const prompt = `You are a code examiner. Summarize this code file in exactly 3 concise, information-rich bullet points. Identify what it exports/does, its core functions, and its role in the overall project.
File name: "${filePath}"

Code content:
\`\`\`
${codeContent}
\`\`\`

Formatting rules:
- Provide ONLY the 3 bullet points, starting directly with the first bullet.
- Do NOT add any preamble headers.
- Use '*' for bullet points.
- Wrap symbols, functions, or files in single backticks.`;

      const summaryResult = await queryGemini(apiKey, prompt, selectedModel);

      inspectorLoader.style.display = 'none';
      inspectorContent.innerHTML = formatMarkdownToHTML(summaryResult);
    } catch (e) {
      inspectorLoader.style.display = 'none';
      inspectorContent.innerHTML = `
        <div style="color: #ef4444; font-weight: 500;">
          ❌ Could not summarize file:<br>
          <span style="font-size: 11px; font-weight: normal; color: var(--text-secondary);">${escapeHtml(e.message)}</span>
        </div>
      `;
    }
  }

  inspectorCloseBtn.addEventListener('click', () => {
    fileInspectorModal.style.display = 'none';
  });

  fileInspectorModal.addEventListener('click', (e) => {
    if (e.target === fileInspectorModal) {
      fileInspectorModal.style.display = 'none';
    }
  });

  // 16. Chat Setup & Loops
  function enableChat() {
    chatInput.disabled = false;
    chatSendBtn.disabled = false;
    chatMessages.innerHTML = '';
    
    const welcome = document.createElement('div');
    welcome.className = 'chat-bubble ai';
    welcome.innerHTML = `<p>Hi! I've loaded <strong>${owner}/${repo}</strong>'s codebase structure into my context. Ask me anything about its modules, files, or architecture!</p>`;
    chatMessages.appendChild(welcome);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    chatHistory = [];
  }

  chatSendBtn.addEventListener('click', submitChatMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitChatMessage();
  });

  async function submitChatMessage() {
    const question = chatInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const selectedModel = modelSelect.value;

    if (!question || !apiKey) return;

    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble user';
    userBubble.textContent = question;
    chatMessages.appendChild(userBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatInput.value = '';

    const thinkingBubble = document.createElement('div');
    thinkingBubble.className = 'chat-bubble ai';
    thinkingBubble.id = 'chat-thinking';
    thinkingBubble.innerHTML = '<span style="opacity: 0.6; font-style: italic;">Assistant is typing...</span>';
    chatMessages.appendChild(thinkingBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const chatPrompt = `You are a helpful software engineering assistant chat bot. You are explaining the GitHub repository "${owner}/${repo}".
Here is the codebase file layout structure:
\`\`\`
${repoStructureText}
\`\`\`
${readmeText ? `Here is the README context:\n${readmeText}\n` : ''}

Conversation history:
${chatHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n')}

User question: ${question}

Please answer the user's question about the repository based on the codebase structure and README. Answer concisely and use standard markdown formatting (using ### for headers, * for lists, and backticks for files/symbols).`;

      const aiReply = await queryGemini(apiKey, chatPrompt, selectedModel);

      const thinkingNode = document.getElementById('chat-thinking');
      if (thinkingNode) thinkingNode.remove();

      const aiBubble = document.createElement('div');
      aiBubble.className = 'chat-bubble ai';
      aiBubble.innerHTML = formatMarkdownToHTML(aiReply);
      chatMessages.appendChild(aiBubble);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      chatHistory.push({ role: 'user', text: question });
      chatHistory.push({ role: 'model', text: aiReply });

      if (chatHistory.length > 8) {
        chatHistory = chatHistory.slice(chatHistory.length - 8);
      }
    } catch (err) {
      const thinkingNode = document.getElementById('chat-thinking');
      if (thinkingNode) thinkingNode.remove();

      const errBubble = document.createElement('div');
      errBubble.className = 'chat-bubble ai';
      errBubble.innerHTML = `<span style="color: #ef4444; font-weight: 500;">⚠️ Chat error: ${escapeHtml(err.message)}</span>`;
      chatMessages.appendChild(errBubble);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  // 17. Onboarding Guide Export File download
  exportGuideBtn.addEventListener('click', () => {
    if (!lastOverviewMarkdown) return;
    const blob = new Blob([lastOverviewMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${owner}_${repo}_onboarding_guide.md`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // 18. Simple Markdown-to-HTML parser
  function formatMarkdownToHTML(markdown) {
    let html = markdown.replace(/\r/g, '');

    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');

    const lines = html.split('\n');
    let inList = false;
    const parsedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const listItemMatch = line.match(/^[\*\-]\s+(.*)$/);

      if (listItemMatch) {
        if (!inList) {
          parsedLines.push('<ul>');
          inList = true;
        }
        parsedLines.push(`<li>${listItemMatch[1]}</li>`);
      } else {
        if (inList) {
          parsedLines.push('</ul>');
          inList = false;
        }
        
        if (line.startsWith('<h') && line.endsWith('</h>')) {
          parsedLines.push(line);
        } else if (line) {
          parsedLines.push(`<p>${line}</p>`);
        }
      }
    }

    if (inList) {
      parsedLines.push('</ul>');
    }

    return parsedLines.join('\n');
  }

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }
});
