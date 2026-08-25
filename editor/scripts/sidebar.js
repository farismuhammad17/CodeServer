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

const langMap = {
    'cpp'  : 'cpp',
    'cc'   : 'cpp',
    'h'    : 'cpp',
    'js'   : 'javascript',
    'html' : 'html',
    'css'  : 'css',
    'py'   : 'python',
    'json' : 'json'
};

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
        const iconElement = clone.querySelector('.file-icon');
        const nameElement = clone.querySelector('.file-name');

        nameElement.textContent = file.name;

        if (file.is_directory) {
            itemElement.style.fontWeight = 'bold';
            itemElement.addEventListener('click', () => {
                folderHistory.push(currentFolderNode);
                currentFolderNode = file;
                renderFolder(currentFolderNode);
            });
        } else {
            itemElement.addEventListener('click', () => {
                fetch(`/api/file?path=${encodeURIComponent(file.path)}`)
                    .then(res => res.text())
                    .then(code => {
                        editor.setValue(code);
                        document.getElementById('breadcrumbs').textContent = '/' + file.path;

                        const ext = file.path.split('.').pop();
                        if (langMap[ext]) {
                            monaco.editor.setModelLanguage(editor.getModel(), langMap[ext]);
                        }
                    });
            });
        }

        treeContainer.appendChild(clone);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchFileTree();
});
