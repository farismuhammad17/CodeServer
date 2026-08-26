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

const sidebar = document.getElementById('main-sidebar');

// Hamburger Toggle
const toggleBtn = document.getElementById('btn-toggle-sidebar');
if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
}

// Nested View Switcher Tabs
const navTabs = document.querySelectorAll('.nav-tab');
navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetView = tab.getAttribute('data-view');

        navTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.sidebar-view').forEach(view => {
            view.classList.remove('active');
        });

        const activeViewPanel = document.getElementById(`view-${targetView}`);
        if (activeViewPanel) {
            activeViewPanel.classList.add('active');
        }
    });
});
