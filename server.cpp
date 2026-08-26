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

#include <string>
#include <chrono>
#include <vector>
#include <mutex>

#include "crow.h"

#define CS_VERSION "0.3.0"

namespace fs = std::filesystem;

struct User {
    std::string ip;
    std::string name;
    std::string current_file;
    uint32_t current_file_hash;
};

std::vector<User> active_users;
std::mutex users_mutex;

fs::path HOST_DIR;
int SERVER_PORT = 8000; // Default fallback
std::vector<std::string> IGNORED_ITEMS;

// --- LIBRARY ---

// Ensures any requested path stays strictly inside HOST_DIR
bool is_safe_path(const fs::path& target_path) {
    try {
        // Get the absolute of our workspace
        fs::path canonical_host = fs::absolute(HOST_DIR).lexically_normal();

        // Get the absolute path of the target
        fs::path absolute_target = fs::absolute(target_path).lexically_normal();

        // Iterate through both paths to ensure absolute_target starts with canonical_host
        auto host_it = canonical_host.begin();
        auto target_it = absolute_target.begin();

        while (host_it != canonical_host.end()) {
            // If target runs out of parts before host, or parts don't match, it's outside!
            if (target_it == absolute_target.end() || *host_it != *target_it) {
                return false;
            }
            ++host_it;
            ++target_it;
        }

        return true;
    } catch (...) {
        return false;
    }
}

uint32_t hash_str_to_int(const std::string& text) {
    uint32_t hash = 2166136261u;
    for (char c : text) {
        hash ^= static_cast<uint32_t>(c);
        hash *= 16777619u;
    }
    return hash;
}

// --- API ---

crow::response handle_root() {
    std::ifstream file("editor/index.html");

    if (!file.is_open()) {
        return crow::response(404, "index.html not found in editor folder");
    }

    std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());

    // Create response and set Content-Type to HTML
    crow::response res(content);
    res.set_header("Content-Type", "text/html");
    return res;
}

crow::response handle_styles(std::string filename) {
    std::string filepath = "editor/styles/" + filename;
    std::ifstream file(filepath);
    if (!file.is_open()) return crow::response(404);
    std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    crow::response res(content);
    res.set_header("Content-Type", "text/css");
    return res;
}

crow::response handle_scripts(std::string filename) {
    std::string filepath = "editor/scripts/" + filename;
    std::ifstream file(filepath);
    if (!file.is_open()) return crow::response(404);
    std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    crow::response res(content);
    res.set_header("Content-Type", "application/javascript");
    return res;
}

crow::response handle_api_connect(const crow::request& req) {
    std::string ip = req.remote_ip_address;
    if (ip.empty()) {
        return crow::response(400, "Invalid client IP address");
    }

    std::lock_guard<std::mutex> lock(users_mutex);

    auto it = std::find_if(active_users.begin(), active_users.end(), [&](const User& u) {
        return u.ip == ip;
    });

    if (it == active_users.end()) {
        std::string default_name = "User-" + ip.substr(ip.find_last_of('.') + 1);
        active_users.push_back({
            ip,
            default_name,
            "",
            0
        });
        std::cout << "[USER JOINED] " << ip << " registered as " << default_name << "\n";
    }

    return crow::response(200, "Connected successfully");
}

crow::response handle_api_tree() {
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
}

crow::response handle_open_file(const crow::request& req) {
    char* filepath_param = req.url_params.get("path");
    if (!filepath_param) {
        return crow::response(400, "Missing 'path' query parameter");
    }

    fs::path target_file = HOST_DIR / filepath_param;

    if (!is_safe_path(target_file) || !fs::exists(target_file) || fs::is_directory(target_file)) {
        return crow::response(403, "Access denied or file not found");
    }

    std::string ip = req.remote_ip_address;
    if (ip.empty()) {
        return crow::response(400, "Invalid client IP address");
    }

    std::string rel_path = filepath_param;

    std::lock_guard<std::mutex> lock(users_mutex);
    auto it = std::find_if(active_users.begin(), active_users.end(), [&](const User& u) {
        return u.ip == ip;
    });

    if (it != active_users.end()) {
        it->current_file = rel_path;
        it->current_file_hash = hash_str_to_int(rel_path);
    } else {
        std::string default_name = "User-" + ip.substr(ip.find_last_of('.') + 1);
        active_users.push_back({
            ip,
            default_name,
            rel_path,
            hash_str_to_int(rel_path)
        });
    }

    std::ifstream file(target_file);
    if (!file.is_open()) {
        return crow::response(500, "Failed to open file");
    }

    std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    return crow::response(content);
}

crow::response handle_save_file(const crow::request& req) {
    char* filepath_param = req.url_params.get("path");
    if (!filepath_param) {
        return crow::response(400, "Missing 'path' query parameter");
    }

    fs::path target_file = HOST_DIR / filepath_param;

    if (!is_safe_path(target_file) || fs::is_directory(target_file)) {
        return crow::response(403, "Access denied or invalid path");
    }

    // If parent directories were somehow deleted, recreate them
    try {
        if (target_file.has_parent_path() && !fs::exists(target_file.parent_path())) {
            fs::create_directories(target_file.parent_path());
        }
    } catch (...) {
        return crow::response(500, "Failed to create parent directories");
    }

    // Write the request body (the file content) to disk
    std::ofstream out_file(target_file, std::ios::out | std::ios::trunc);
    if (!out_file.is_open()) {
        return crow::response(500, "Failed to open file for writing");
    }

    out_file << req.body;
    out_file.close();

    return crow::response(200, "File saved successfully");
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

    CROW_ROUTE(app, "/")(handle_root);
    CROW_ROUTE(app, "/styles/<string>")(handle_styles);
    CROW_ROUTE(app, "/scripts/<string>")(handle_scripts);
    CROW_ROUTE(app, "/api/connect").methods(crow::HTTPMethod::POST)(handle_api_connect);
    CROW_ROUTE(app, "/api/tree")(handle_api_tree);
    CROW_ROUTE(app, "/api/file").methods(crow::HTTPMethod::GET)(handle_open_file);
    CROW_ROUTE(app, "/api/save").methods(crow::HTTPMethod::POST)(handle_save_file);

    std::cout << "[INFO] Starting web server on http://localhost:" << SERVER_PORT << "\n";
    app.port(SERVER_PORT).multithreaded().run();

    return 0;
}
