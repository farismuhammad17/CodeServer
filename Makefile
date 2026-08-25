CXX = g++
CXXFLAGS = -std=c++17 -pthread -O3 -Iinclude
TARGET = server
INCLUDES = include

all: deps $(TARGET) config

deps:
	@if [ ! -d "$(INCLUDES)" ]; then \
		mkdir -p $(INCLUDES); \
	fi

	@if [ ! -f "$(INCLUDES)/crow.h" ]; then \
		echo "[DEPENDENCY] Downloading Crow release archive..."; \
		curl -sL https://github.com/CrowCpp/Crow/archive/refs/tags/v1.2.0.tar.gz -o crow.tar.gz; \
		mkdir -p crow_temp; \
		tar -xzf crow.tar.gz -C crow_temp --strip-components=1; \
		cp -r crow_temp/include/* $(INCLUDES)/; \
		rm -rf crow_temp crow.tar.gz; \
	fi

	@if [ ! -d "$(INCLUDES)/asio" ]; then \
		echo "[DEPENDENCY] Downloading standalone Asio networking library..."; \
		curl -sL https://github.com/chriskohlhoff/asio/archive/refs/tags/asio-1-28-0.tar.gz -o asio.tar.gz; \
		mkdir -p asio_temp; \
		tar -xzf asio.tar.gz -C asio_temp --strip-components=1; \
		cp -r asio_temp/asio/include/* $(INCLUDES)/; \
		rm -rf asio_temp asio.tar.gz; \
		echo "[SUCCESS] Dependencies installed successfully"; \
	fi

$(TARGET): server.cpp
	@echo "[C++] Compiling $(TARGET) (this may take a while) ..."
	$(CXX) $(CXXFLAGS) server.cpp -o $(TARGET)
	@echo "[SUCCESS] Build complete"

config:
	@if [ ! -f "config.txt" ]; then \
		echo "[CONFIG] Generating default config.txt..."; \
		echo "# CodeServer Configuration" > config.txt; \
		echo "# https://github.com/farismuhammad17/CodeServer\n" >> config.txt; \
		echo "# Refers to the path to the folder that you want to stream." >> config.txt; \
		echo "# Note that this should be an absolute path. Anything outside" >> config.txt; \
		echo "# this directory will not be accessible to the clients." >> config.txt; \
		echo "PATH=$$(pwd)\n" >> config.txt; \
		echo "# The network port on which the HTTP server will listen for" >> config.txt; \
		echo "# incoming connections. The port number is used by the server" >> config.txt; \
		echo "# to bind to for the hosting web interface." >> config.txt; \
		echo "PORT=8000\n" >> config.txt; \
		echo "# The set of folders/files to ignore, i.e. not let any client" >> config.txt; \
		echo "# have access to them. This is applicable for directory specific" >> config.txt; \
		echo "# binaries (.git, python caches), as well as the built-in" >> config.txt; \
		echo "# .codeserver folder. Note that the program will NOT hide" >> config.txt; \
		echo "# anything except what is specified here." >> config.txt; \
		echo "IGNORE=.git,.codeserver" >> config.txt; \
		echo "[SUCCESS] Default config.txt created successfully!"; \
	fi

clean:
	rm -f $(TARGET)

.PHONY: all deps config run clean fclean
