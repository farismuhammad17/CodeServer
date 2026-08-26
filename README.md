# CodeServer

> [!IMPORTANT]
> The project is still under construction (v0.2.0), and still a works in concept. Testing is still pending.

A C++ backend, browser code editor built with the Crow framework, designed to let you instantly host a coding workspace right from your own machine. Inspired by the live-editting feature of Google Docs (and other notable code editors), I built CodeServer as a medium to collaborate with fellow programmers, and to let you code from anywhere, without the need to install any IDEs or editors. It can also double as a remote work station, where you can edit, test, and view your code from anywhere, as long as you server is up.

## Features

* **Editor**
    * Monaco Editor (the same editor that powers VS Code) provides syntax highlighting, code folding, and bracket matching.
    * Automatically maps file extensions to the correct Monaco language parser on the fly.
* **Sidebar**
    * Provides all required actions.
    * Simple file explorer to navigate through folders.
    * Keeps mention of your unsaved work.
* **Safe Saving**
    * In the event where the server is unreachable or client connection has dropped, your unsaved work is never lost, due to the local caching mechanism.
    * All client changes are stored into `localStorage` first.
    * When you press `CTRL+S`, the client sends the file to the server, which writes it to the disk, and then sends back the `OK` response.
    * Only once the client recieves the `OK` response is the unsaved work cache cleared.
* **Server safety**
    * The C++ server ensures that any edits made by the client would not fall outside the `PATH` provided by the server configuration file.

# Roadmap

* **Network Interruption & Auto-Recovery:**
    * If the connection drops, UI displays an offline indicator while local changes continue saving safely to browser cache.
    * Server should implement a simple WebSocket ping/pong interval (e.g., every 30 seconds). If a client drops offline, the server can immediately clean up, and inform the user is offline.
    * Upon reconnecting, the client automatically pushes its cached buffer back to the server.
* **Collision Detection & Fail-Safe Injection:**
    * Instead of a complex diff algorithm, just run diff on the client side and put the old code and the new code together, and let the user deal with the conflict.

* **Inter-User system**
    * Preferences for theme, font, etc., where you can add username, "update" sends to server the IP to update the username of.
    * Store user name inside codeserver folder, use IP addresses to remember
    * Chat system; store chat messages (msg, user, time) inside `.codeserver` folder
    * Track every IP (and username) that came in, so we can have nice "Online"/"Offline" show up.

* **Workspace ZIP download endpoint** for instant export.

* **Sidebar**
    * Make sidebar toggleable.
    * Add menus to it: file explorer, settings, chat, etc.

* Only broadcast every character (throttled to half seconds) if two users are viewing the exact same file, else, don't bother sending change data.
    * Store vector of users(ip, name, current_file, uint32_t current_file_hash), and hash file relative path from `PATH` from config.
    * When a user opens a file, use binary search to determine the position to put the user in ascending, then, once found, plop the new hash in required place, search right, then left, and `strcmp` all file names, to find real duplicates. Once found, only then update every character.
* If two users are found to be on the same file:
    * Client: Enable listeners for inputs for every 500 ms to send back to server.
    * Server: Get update to file, send back to common clients to update on their screen.
    * Saving: They both see the same thing, just write to disk whatever is stored.
    * Updates should be stored on server RAM, and saving just dumps all that memory into the file.
    * Surprisingly, sending the whole file back every 500 ms is just fine, and, furthermore, only store the file once, not a sequence of them, and, when writing, use the one that we have, which would be the latest.
* **Potential problem:** If two users at typing at the same time, one of them will send their 500 ms before the other, and even if by mere nanoseconds, it would overwrite the text of the other user. Perhaps a couple characters would dissappear in that time, but it still overwrites it. Only update individual lines and newlines therefore, or smth, idk. Figure out later when we reach here.

* Safe execution via backend process spawning (`fork`/`exec`).
    * Let server config choose allowed commands (`python`, `touch`, etc.), as long as commands wont go outside the directory.
    * Resource throttling using `MAX_RAM_MB` and CPU execution limits. (use `setrlimit`)
    * **GUI Apps:** Headless virtual framebuffer (**Xvfb**), frame capture, and real-time streaming over WebSockets to a browser `<canvas>`.

* Send only every 100 KB of text till the end of the file from server.

* **OS Support:** Native Linux/WSL (recommended), with a **Docker** fallback for Windows users.

* **TUI:** Backend should run on one thread, while we have a TUI for the following server commands:
    * shutdown: Cleanly closes everything, saves all user progress, and informs all users.
    * reboot: saves all user progress, and asks users to wait for reboot.
    * ip: Get the IP of where the server is running
    * tailscale: To connect to tailscale automatically
    * version: Output server version
    * update: Check GitHub repository for updates, if so, fetch new update.
    * users: List all users and user information
    * mem: RAM used by program

**Other media:** Currently, viewing PNG, JPG, etc., just dumps the raw bytes (which looks like gibberish) into the editor. We should implement a simple image viewer, and perhaps even a video player, that can stream the media from the server to the client. This is obviously a low priority, but it would be nice to have.

---

*This project is licensed under the Apache 2.0 license. See [LICENSE](./LICENSE) for more information.*
