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

#include <iostream>
#include <fstream>
#include <string>
#include <filesystem>

#include "crow.h"

#define CS_VERSION "0.1.0"

namespace fs = std::filesystem;

fs::path HOST_DIR;
int SERVER_PORT = 8000; // Default fallback
std::vector<std::string> IGNORED_ITEMS;

// Ensures any requested path stays strictly inside HOST_DIR
bool is_safe_path(const fs::path& target_path) {
    try {
        // Resolve absolute canonical paths to resolve any "../" tricks
        fs::path canonical_host = fs::canonical(HOST_DIR);
        fs::path canonical_target = fs::canonical(target_path);

        // Check if the target path starts with the host path prefix
        auto host_it = canonical_host.begin();
        auto target_it = canonical_target.begin();

        while (host_it != canonical_host.end() && target_it != canonical_target.end()) {
            if (*host_it != *target_it) return false;
            ++host_it;
            ++target_it;
        }

        // If host path ran out, it means target is inside or equal to host
        return host_it == canonical_host.end();
    } catch (...) {
        // If file doesn't exist yet or path is invalid
        return false;
    }
}

int main() {
    // --- CONFIG PARSING ---

    std::cout << "[INIT] Looking for config.txt...\n";

    // Check if config.txt exists next to the binary
    if (!fs::exists("config.txt")) {
        std::cerr << "[ERROR] 'config.txt' not found in the current directory!\n";
        std::cerr << "[HINT] Create a 'config.txt' file containing the absolute path of the folder to host.\n";
        return 1;
    }

    // Parse config.txt to read the absolute path
    std::ifstream config_file("config.txt");
    if (!config_file.is_open()) {
        std::cerr << "[ERROR] Failed to open 'config.txt' for reading.\n";
        return 1;
    }

    std::string raw_path;
    std::string line;

    while (std::getline(config_file, line)) {
        // Trim leading spaces/tabs
        line.erase(0, line.find_first_not_of(" \t\r"));

        // Skip comments or empty lines
        if (line.empty() || line[0] == '#') {
            continue;
        }

        // Check for PATH=
        if (line.rfind("PATH=", 0) == 0) {
            raw_path = line.substr(5);
        }

        // Check for PORT=
        else if (line.rfind("PORT=", 0) == 0) {
            try {
                SERVER_PORT = std::stoi(line.substr(5));
            } catch (...) {
                std::cerr << "[WARNING] Invalid PORT in config.txt, falling back to 8000.\n";
            }
        }

        // Check for IGNORE=
        else if (line.rfind("IGNORE=", 0) == 0) {
            std::string ignores_raw = line.substr(7);
            size_t start = 0, end = 0;

            while ((end = ignores_raw.find(',', start)) != std::string::npos) {
                std::string item = ignores_raw.substr(start, end - start);
                // Trim spaces
                item.erase(0, item.find_first_not_of(" \t\r"));
                item.erase(item.find_last_not_of(" \t\r") + 1);
                if (!item.empty()) IGNORED_ITEMS.push_back(item);
                start = end + 1;
            }

            std::string last_item = ignores_raw.substr(start);
            last_item.erase(0, last_item.find_first_not_of(" \t\r"));
            last_item.erase(last_item.find_last_not_of(" \t\r") + 1);

            if (!last_item.empty()) IGNORED_ITEMS.push_back(last_item);
        }
    }

    config_file.close();

    if (raw_path.empty()) {
        std::cerr << "[ERROR] PATH not found in 'config.txt'\n";
        return 1;
    }

    // Trim trailing carriage returns, spaces, or newlines from the path
    size_t end = raw_path.find_last_not_of(" \n\r\t");
    if (end != std::string::npos) {
        raw_path = raw_path.substr(0, end + 1);
    } else {
        raw_path.clear();
    }

    // Validate the target directory path
    HOST_DIR = fs::absolute(raw_path);

    if (!fs::exists(HOST_DIR)) {
        std::cerr << "[ERROR] Path specified in config.txt does not exist: " << HOST_DIR << "\n";
        return 1;
    }

    if (!fs::is_directory(HOST_DIR)) {
        std::cerr << "[ERROR] Path specified in config.txt is not a directory: " << HOST_DIR << "\n";
        return 1;
    }

    std::cout << "[SUCCESS] Config loaded. Hosting boundary locked to:\n  -> " << fs::canonical(HOST_DIR) << "\n";

    // Ensure local hidden metadata directory exists inside the hosted workspace
    fs::path codeserver_dir = HOST_DIR / ".codeserver";
    if (!fs::exists(codeserver_dir)) {
        fs::create_directory(codeserver_dir);
        std::cout << "[INIT] Created hidden .codeserver metadata folder.\n";
    }

    // --- CROW WEB SERVER INITIALIZATION ---

    crow::SimpleApp app;

    // Routing editor website to root
    CROW_ROUTE(app, "/")([](){
        std::ifstream file("editor/index.html");

        if (!file.is_open()) {
            return crow::response(404, "index.html not found in editor folder");
        }

        std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());

        // Create response and set Content-Type to HTML
        crow::response res(content);
        res.set_header("Content-Type", "text/html");
        return res;
    });

    // Serve CSS files
    CROW_ROUTE(app, "/styles/<string>")([](std::string filename){
        std::string filepath = "editor/styles/" + filename;
        std::ifstream file(filepath);
        if (!file.is_open()) return crow::response(404);
        std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
        crow::response res(content);
        res.set_header("Content-Type", "text/css");
        return res;
    });

    // Serve JS files
    CROW_ROUTE(app, "/scripts/<string>")([](std::string filename){
        std::string filepath = "editor/scripts/" + filename;
        std::ifstream file(filepath);
        if (!file.is_open()) return crow::response(404);
        std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
        crow::response res(content);
        res.set_header("Content-Type", "application/javascript");
        return res;
    });

    // API: List workspace files as a flat array
    CROW_ROUTE(app, "/api/tree")([](){
        crow::json::wvalue res;
        int idx = 0;

        try {
            for (const auto& entry : fs::recursive_directory_iterator(HOST_DIR)) {
                std::string rel_path = fs::relative(entry.path(), HOST_DIR).string();

                // Check against config ignores
                bool ignored = false;
                for (const auto& ignore_pattern : IGNORED_ITEMS) {
                    if (rel_path.rfind(ignore_pattern, 0) == 0 || rel_path.find("/" + ignore_pattern) != std::string::npos) {
                        ignored = true;
                        break;
                    }
                }
                if (ignored) continue;

                res[idx]["path"] = rel_path;
                res[idx]["is_directory"] = entry.is_directory();
                idx++;
            }
        } catch (...) {
            return crow::response(500, "Error scanning directory");
        }

        return crow::response(res);
    });

    // API: Read a specific file's contents safely
    CROW_ROUTE(app, "/api/file").methods(crow::HTTPMethod::GET)([](const crow::request& req){
        char* filepath_param = req.url_params.get("path");
        if (!filepath_param) {
            return crow::response(400, "Missing 'path' query parameter");
        }

        fs::path target_file = HOST_DIR / filepath_param;

        // Enforce sandbox security boundary
        if (!is_safe_path(target_file) || !fs::exists(target_file) || fs::is_directory(target_file)) {
            return crow::response(403, "Access denied or file not found");
        }

        std::ifstream file(target_file);
        if (!file.is_open()) {
            return crow::response(500, "Failed to open file");
        }

        std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
        return crow::response(content);
    });

    std::cout << "[INFO] Starting web server on http://localhost:" << SERVER_PORT << "\n";
    app.port(SERVER_PORT).multithreaded().run();

    return 0;
}
