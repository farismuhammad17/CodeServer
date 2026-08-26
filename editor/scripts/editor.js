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

let editor;

let currentOpenFilePath = null;
let isProgrammaticChange = false;

const editorLangMap = {
    // C / C++
    'c'    : 'c',
    'h'    : 'c',
    'cpp'  : 'cpp',
    'cc'   : 'cpp',
    'cxx'  : 'cpp',
    'hpp'  : 'cpp',

    // Web Development
    'js'   : 'javascript',
    'jsx'  : 'javascript',
    'ts'   : 'typescript',
    'tsx'  : 'typescript',
    'html' : 'html',
    'css'  : 'css',
    'json' : 'json',

    // Systems & Backend
    'py'   : 'python',
    'rs'   : 'rust',
    'go'   : 'go',
    'java' : 'java',
    'sh'   : 'shell',
    'bash' : 'shell',

    // Data & Config
    'yml'  : 'yaml',
    'yaml' : 'yaml',
    'xml'  : 'xml',
    'sql'  : 'sql',

    // Docs
    'txt'  : 'plaintext',
    'md'   : 'markdown'
};

require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('main-code'), {
        value: "",
        language: 'cpp',
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    });

    initEditorListeners();

    editor.addAction({
        id: 'save-file-action',
        label: 'Save File',
        keybindings: [
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS // Triggers on Ctrl+S (Windows/Linux) or Cmd+S (Mac)
        ],
        run: function(ed) {
            saveCurrentFile();
        }
    });
});

function initEditorListeners() {
    editor.onDidChangeModelContent((event) => {
        // If this change was triggered by code (like setValue), ignore it completely
        if (isProgrammaticChange || !currentOpenFilePath) return;

        const content = editor.getValue();

        // Save instantly to localStorage as fail-safe
        localStorage.setItem('cs_cache:' + currentOpenFilePath, content);

        // Mark dirty in UI
        markFileDirty(currentOpenFilePath, true);
    });
}

async function openFile(filePath) {
    // If we were looking at another file, its content is already auto-saved via change listener to localStorage.
    currentOpenFilePath = filePath;
    document.getElementById('breadcrumbs').textContent = '/' + filePath;

    let fileContent = "";
    const cached = localStorage.getItem('cs_cache:' + filePath);

    /*
    TODO: There is a concern if a user writes some unsaved changes,
    goes away, closes the editor, comes back, and the file has been
    modified on the server in the meantime. In that case, we should
    ideally show a warning to the user that their unsaved changes
    may conflict with the server version. This can be implemented by
    checking the last modified timestamp of the file on the server and
    comparing it with a stored timestamp in localStorage, or by storing
    hashes of the file contents for faster comparisons. We should also
    then only write the diff to the client's localStorage instead of the
    entire file.

    For now, we will just load the cached version if it exists, as the
    editor is currently, still, in singleplayer.
    */

    if (cached !== null) {
        fileContent = cached;
    } else {
        try {
            const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
            if (!res.ok) throw new Error("Failed to load file");
            fileContent = await res.text();
        } catch (err) {
            console.error(err);
            return;
        }
    }

    isProgrammaticChange = true;
    editor.setValue(fileContent);
    isProgrammaticChange = false;

    // Set syntax language
    const ext = filePath.split('.').pop();
    if (editorLangMap && editorLangMap[ext]) {
        monaco.editor.setModelLanguage(editor.getModel(), editorLangMap[ext]);
    }
}

async function saveCurrentFile() {
    if (!currentOpenFilePath) {
        console.warn("No active file to save.");
        return;
    }

    const content = editor.getValue();

    /*
    The client sends the entire file over to the server,
    which then writes the whole file to the disk. This
    works well for medium sized files, but we will implement
    a diff-based saving mechanism in the future for larger
    files to reduce bandwidth usage.
    */

    try {
        const response = await fetch(`/api/save?path=${encodeURIComponent(currentOpenFilePath)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: content
        });

        if (!response.ok) {
            throw new Error(`Server returned status: ${response.status}`);
        }

        /*
        Once the file is saved, the server responds back with a positive.
        This can mean that the cache the client stored can be completely
        deleted. If it is not the case, then the client should hold onto
        it, as some networking error has occured (client offline or server
        down may be the case).
        */

        // Remove from localStorage
        localStorage.removeItem('cs_cache:' + currentOpenFilePath);

        // Remove the dirty blue dot indicator from the UI
        markFileDirty(currentOpenFilePath, false);

    } catch (error) {
        console.error("Failed to save file to server:", error);
        cs_alert("Save failed. Check your connection or server status.");
    }
}
