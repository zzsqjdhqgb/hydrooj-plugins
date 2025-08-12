#!/bin/bash

# 脚本一旦发生错误，就终止执行
set -e
set -o pipefail

# --- 全局变量和配置 ---
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly RED='\033[0;31m'
readonly NC='\033[0m' # No Color

readonly PID_FILE="http_server.pid"

# --- 辅助函数 ---
log_info() {
    echo -e "${GREEN}[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}[WARN] $(date '+%Y-%m-%d %H:%M:%S') - $1${NC}"
}

log_error() {
    echo -e "${RED}[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1${NC}" >&2
}

# 检查命令是否存在，如果不存在则退出
ensure_command_exists() {
    if ! command -v "$1" &> /dev/null; then
        log_error "Command not found: '$1'. Please install it to continue."
        log_error "On Debian/Ubuntu, try: sudo apt install python3-pip"
        log_error "On RHEL/CentOS, try: sudo yum install python3-pip"
        exit 1
    fi
}

# --- 主要逻辑 ---
main() {
    # --- Step 1: Check and receive the package name ---
    if [ "$#" -ne 1 ]; then
        log_error "Invalid number of arguments provided."
        echo "Usage: $0 <package_name>"
        exit 1
    fi

    local package_name="$1"
    local source_dir="./${package_name}"
    local output_dir="./build"
    local output_zip="${output_dir}/${package_name}.zip"
    local exclude_pattern="${source_dir}/node_modules/*"

    # --- Step 2: Validate source directory and create output directory ---
    if [ ! -d "$source_dir" ]; then
        log_error "Source directory not found: '${source_dir}'"
        exit 1
    fi
    
    # Create the output directory if it doesn't exist
    mkdir -p "$output_dir"

    log_info "Starting packaging process..."
    log_info "Package Name:     ${package_name}"
    log_info "Source Directory:   ${source_dir}"
    log_info "Output ZIP File:    ${output_zip}"

    ensure_command_exists "zip"
    
    log_info "Removing old archive if it exists: ${output_zip}"
    rm -f "$output_zip"
    # --- 第3步: 执行核心打包命令 ---
    zip -r "$output_zip" "$source_dir" -x "$exclude_pattern"
    log_info "Packaging complete!"

    echo ""

    # Server configuration
    local server_port="48485"
    local install_url="http://127.0.0.1:${server_port}/${package_name}.zip"

    cleanup() {
        log_info "Executing cleanup..."
        if [ -f "$PID_FILE" ]; then
            local pid_to_kill
            pid_to_kill=$(cat "$PID_FILE")
            log_info "Shutting down temporary HTTP server (PID: ${pid_to_kill})..."
            
            # Use kill -0 to check if process exists before trying to kill
            if ps -p "$pid_to_kill" > /dev/null; then
                 kill "$pid_to_kill"
            fi
            rm -f "$PID_FILE" # Remove the PID file regardless
        fi
    }
    
    # Set the trap: call the 'cleanup' function when the script exits for any reason.
    trap cleanup EXIT

    log_info "Starting temporary HTTP server..."
    (python3 -m http.server --directory "$output_dir" "$server_port" &> /dev/null & echo $! > "$PID_FILE")
    
    # Check if PID file was created and contains a number
    if ! [ -s "$PID_FILE" ] || ! grep -q '[0-9]' "$PID_FILE"; then
        log_error "Failed to start HTTP server or capture its PID."
        exit 1
    fi
    
    # Give the server a second to start up to avoid a race condition
    sleep 1

    echo ""

    log_info "Executing hydrooj install..."
    echo "=================================================="

    # Execute the installation command
    hydrooj install "$install_url"
    
    echo "=================================================="
    log_info "Successfully installed package: ${package_name}"

    echo "" # Add a blank line for better spacing
    
    # A single, highlighted block for the complete uninstall instruction
    echo -e "${YELLOW}------------------------------------------${NC}"
    echo -e "${YELLOW} You can uninstall the package by running:${NC}"
    echo -e "${YELLOW}                                          ${NC}" # Spacer for visual clarity
    echo -e "${YELLOW}   hydrooj uninstall ${package_name}${NC}"
    echo -e "${YELLOW}------------------------------------------${NC}"
    echo ""
}

# --- 脚本入口 ---
main "$@"