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

let globalFileTreeData = null;
let currentFolderNode = null;
let folderHistory = [];

function markFileDirty(filePath, isDirty) {
    const item = document.querySelector(`[data-path="${CSS.escape(filePath)}"]`);
    if (item) {
        if (isDirty) item.classList.add('is-dirty');
        else item.classList.remove('is-dirty');
    }
    renderUnsavedSection();
}

async function fetchFileTree() {
    try {
        const response = await fetch('/api/tree');
        if (!response.ok) throw new Error(`Server status: ${response.status}`);

        const flatObject = await response.json();
        const flatArray = Object.values(flatObject);

        // Build a hierarchical tree structure from the flat list client-side
        globalFileTreeData = buildTreeFromFlatList(flatArray);
        currentFolderNode = globalFileTreeData;

        renderFolder(currentFolderNode);
    } catch (error) {
        console.error("Failed to fetch file tree:", error);
    }
}

// Helper to convert flat relative paths into a nested tree object
function buildTreeFromFlatList(flatList) {
    const root = { path: "", name: "", is_directory: true, children: [] };

    flatList.forEach(item => {
        if (!item || !item.path) return;
        const parts = item.path.split('/');
        let currentNode = root;

        parts.forEach((part, index) => {
            const isLast = (index === parts.length - 1);
            const currentPath = parts.slice(0, index + 1).join('/');

            let existingChild = currentNode.children.find(c => c.name === part);

            if (!existingChild) {
                existingChild = {
                    path: currentPath,
                    name: part,
                    is_directory: isLast ? item.is_directory : true,
                    children: []
                };
                currentNode.children.push(existingChild);
            }
            currentNode = existingChild;
        });
    });

    return root;
}

function renderUnsavedSection() {
    const unsavedListContainer = document.getElementById('unsaved-list');
    const unsavedSection = document.getElementById('unsaved-section');
    const template = document.getElementById('file-item-template');

    unsavedListContainer.innerHTML = '';

    // Find all localStorage items starting with our cache prefix
    const dirtyPaths = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cs_cache:')) {
            dirtyPaths.push(key.replace('cs_cache:', ''));
        }
    }

    if (dirtyPaths.length === 0) {
        unsavedSection.style.display = 'none';
        return;
    }

    unsavedSection.style.display = 'block';

    dirtyPaths.forEach(path => {
        const clone = template.content.cloneNode(true);
        const itemElement = clone.querySelector('.file-item');
        const nameElement = clone.querySelector('.file-name');

        // Show just the filename or relative path
        nameElement.textContent = path.split('/').pop();
        itemElement.setAttribute('data-path', path);
        itemElement.classList.add('is-dirty');

        itemElement.addEventListener('click', () => openFile(path));
        unsavedListContainer.appendChild(clone);
    });
}

function renderFolder(node) {
    const treeContainer = document.getElementById('file-tree');
    const template = document.getElementById('file-item-template');

    treeContainer.innerHTML = '';

    // Add "Back" button if inside a subfolder
    if (folderHistory.length > 0) {
        const backClone = template.content.cloneNode(true);
        const backItem = backClone.querySelector('.file-item');
        backItem.querySelector('.file-name').textContent = ".. (Back)";

        backItem.addEventListener('click', () => {
            currentFolderNode = folderHistory.pop();
            renderFolder(currentFolderNode);
        });
        treeContainer.appendChild(backClone);
    }

    if (!node || !node.children) return;

    // Sort items: Directories first, then files alphabetically
    const sortedChildren = [...node.children].sort((a, b) => {
        if (a.is_directory === b.is_directory) {
            return a.name.localeCompare(b.name);
        }
        return a.is_directory ? -1 : 1;
    });

    sortedChildren.forEach(file => {
        const clone = template.content.cloneNode(true);
        const itemElement = clone.querySelector('.file-item');
        const nameElement = clone.querySelector('.file-name');

        nameElement.textContent = file.name;
        itemElement.setAttribute('data-path', file.path);

        // Check if it's currently cached as dirty
        if (localStorage.getItem('cs_cache:' + file.path) !== null) {
            itemElement.classList.add('is-dirty');
        }

        if (file.is_directory) {
            itemElement.style.fontWeight = '500';
            itemElement.addEventListener('click', () => {
                folderHistory.push(currentFolderNode);
                currentFolderNode = file;
                renderFolder(currentFolderNode);
            });
        } else {
            itemElement.addEventListener('click', () => openFile(file.path));
        }

        treeContainer.appendChild(clone);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchFileTree();
    renderUnsavedSection();

    // Refresh button event listener
    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            fetchFileTree();
            renderUnsavedSection();
        });
    }

    // Placeholders for future buttons
    document.getElementById('btn-new-file').addEventListener('click', () => {
        cs_alert("Action not yet implemented");
    });

    document.getElementById('btn-new-folder').addEventListener('click', () => {
        cs_alert("Action not yet implemented");
    });
});
