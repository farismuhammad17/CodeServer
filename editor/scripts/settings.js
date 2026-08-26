/*
=====================================================================
Copyright 2026 Faris Muhammad

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
=====================================================================
*/

// Define theme color mappings
const themes = {
    dark: {
        "--bg-main": "#1e1e1e",
        "--bg-sidebar": "#252526",
        "--bg-card": "#2d2d2d",
        "--bg-hover": "#37373d",
        "--text-main": "#cccccc",
        "--text-muted": "#858585",
        "--accent-primary": "#007acc",
        "--accent-hover": "#1f8ad2",
        "--accent-success": "#4ec9b0",
        "--accent-warning": "#cca700",
        "--accent-danger": "#f44747",
        "--border-color": "#3f3f46",
        "monacoTheme": "vs-dark"
    },
    light: {
        "--bg-main": "#ffffff",
        "--bg-sidebar": "#f3f3f3",
        "--bg-card": "#ececec",
        "--bg-hover": "#e5e5e5",
        "--text-main": "#333333",
        "--text-muted": "#666666",
        "--accent-primary": "#0066cc",
        "--accent-hover": "#0052a3",
        "--accent-success": "#2e7d32",
        "--accent-warning": "#ed6c02",
        "--accent-danger": "#d32f2f",
        "--border-color": "#dcdcdc",
        "monacoTheme": "vs"
    },
    hc_dark: {
        "--bg-main": "#000000",
        "--bg-sidebar": "#000000",
        "--bg-card": "#121212",
        "--bg-hover": "#222222",
        "--text-main": "#ffffff",
        "--text-muted": "#dddddd",
        "--accent-primary": "#3794ff",
        "--accent-hover": "#4285f4",
        "--accent-success": "#73c991",
        "--accent-warning": "#cca700",
        "--accent-danger": "#f48771",
        "--border-color": "#6fc3df",
        "monacoTheme": "hc-black"
    }
};

function changeTheme(themeName) {
    const selectedTheme = themes[themeName];

    if (!selectedTheme) {
        console.warn(`Theme "${themeName}" not found!`);
        return;
    }

    const root = document.documentElement;

    for (const [property, value] of Object.entries(selectedTheme)) {
        if (property.startsWith("--")) {
            root.style.setProperty(property, value);
        }
    }

    if (window.monaco && selectedTheme.monacoTheme) {
        monaco.editor.setTheme(selectedTheme.monacoTheme);
    }

    localStorage.setItem('cs_theme', themeName);
}

const usernameInput = document.getElementById('username-input');
const saveUsernameBtn = document.getElementById('btn-save-username');
const statusLabel = document.getElementById('settings-status');

// Pre-fill input if saved locally
const cachedName = localStorage.getItem('cs_username');
if (cachedName) {
    usernameInput.value = cachedName;
}

saveUsernameBtn.addEventListener('click', async () => {
    const newUsername = usernameInput.value.trim();
    if (!newUsername) return;

    statusLabel.style.color = '#858585';
    statusLabel.textContent = 'Saving...';

    try {
        const response = await fetch('/api/settings/username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: newUsername })
        });

        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }

        localStorage.setItem('cs_username', newUsername);
        statusLabel.style.color = '#4ec9b0';
        statusLabel.textContent = 'Saved successfully!';

        setTimeout(() => {
            statusLabel.textContent = '';
        }, 3000);

    } catch (error) {
        console.error("Failed to save username:", error);
        statusLabel.style.color = '#f14c4c';
        statusLabel.textContent = 'Failed to save changes.';
    }
});

// Set theme to stored preference or default to dark
const theme = localStorage.getItem('cs_theme') || 'dark'
const themeSelect = document.getElementById('theme-select');

if (themeSelect) {
    themeSelect.value = theme;
}

changeTheme(theme);
