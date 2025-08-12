#!/bin/bash

# --- 脚本配置 ---
# 脚本一旦发生错误，就终止执行
set -e
# 管道中任何一个命令失败，整个管道都算失败
set -o pipefail

# --- 全局变量和配置 ---
# 使用 readonly 来确保这些变量的值在脚本中不会被意外修改
# 颜色代码，用于美化输出
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly RED='\033[0;31m'
readonly NC='\033[0m' # No Color

# 使用全局变量来存储PID文件名，以避免在trap中出现变量作用域问题
readonly PID_FILE="http_server.pid"

# --- 辅助函数 ---

# 日志函数，方便输出带有时间戳和颜色的信息
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
        exit 1
    fi
}

# 清理函数，由 trap 在脚本退出时调用，确保后台进程被关闭
cleanup() {
    log_info "Executing cleanup..."
    if [ -f "$PID_FILE" ]; then
        local pid_to_kill
        pid_to_kill=$(cat "$PID_FILE")
        # 确保PID文件中有内容，并且该进程确实存在
        if [ -n "$pid_to_kill" ] && ps -p "$pid_to_kill" > /dev/null; then
            log_info "Shutting down temporary HTTP server (PID: ${pid_to_kill})..."
            kill "$pid_to_kill"
        fi
        # 无论如何都移除PID文件
        rm -f "$PID_FILE"
    fi
}

# --- 主要逻辑 ---
main() {
    # 设置 trap，确保无论脚本如何退出，cleanup 函数都会被执行
    trap cleanup EXIT

    # --- Step 1: 解析参数并定义路径 ---
    if [ "$#" -ne 1 ]; then
        log_error "Invalid number of arguments provided."
        echo "Usage: $0 <package_name>"
        exit 1
    fi

    local package_name="$1"
    local source_dir="./${package_name}"
    local output_dir="./build"
    local output_zip_path="${output_dir}/${package_name}.zip"

    # --- Step 2: 环境验证 (Fail-Fast) ---
    log_info "Step 1: Checking for required commands..."
    ensure_command_exists "zip"
    ensure_command_exists "python3"
    ensure_command_exists "hydrooj"

    if [ ! -d "$source_dir" ]; then
        log_error "Source directory not found: '$source_dir'"
        exit 1
    fi
    mkdir -p "$output_dir"

    # --- Step 3: 打包应用 ---
    log_info "Step 2: Starting packaging process..."
    log_info "Removing old archive if it exists: ${output_zip_path}"
    rm -f "$output_zip_path"

    zip -r "$output_zip_path" "$source_dir" -x "${source_dir}/node_modules/*"
    log_info "Packaging complete!"
    
    # --- Step 4: 启动临时服务器并执行安装 ---
    local server_port="48485"
    local install_url="http://127.0.0.1:${server_port}/${package_name}.zip"

    log_info "Step 3: Starting temporary HTTP server..."
    # 使用子 shell 启动服务器，并将所有输出重定向到/dev/null，然后将其 PID 写入文件
    (python3 -m http.server --directory "$output_dir" "$server_port" &> /dev/null & echo $! > "$PID_FILE")
    
    # 验证服务器是否成功启动并捕获到PID
    if ! [ -s "$PID_FILE" ] || ! grep -q '[0-9]' "$PID_FILE"; then
        log_error "Failed to start HTTP server or capture its PID."
        exit 1
    fi
    
    log_info "Server started with PID $(cat "$PID_FILE"). Waiting a moment for it to be ready..."
    sleep 1

    log_info "Step 4: Executing hydrooj install..."
    echo "=================================================="

    # 显式检查 hydrooj 命令的成功与否，并给出不同反馈
    if hydrooj install "$install_url"; then
        echo "=================================================="
        # 成功路径
        log_info "Successfully installed package: ${package_name}"
        
        echo ""
        echo -e "${YELLOW}------------------------------------------${NC}"
        echo -e "${YELLOW} You can uninstall this package by running:${NC}"
        echo -e "${YELLOW}                                          ${NC}"
        echo -e "${YELLOW}   hydrooj uninstall ${package_name}${NC}"
        echo -e "${YELLOW}------------------------------------------${NC}"
        echo ""

    else
        echo "=================================================="
        # 失败路径
        log_error "Hydro-OJ installation failed!"
        log_warn "Please check the output above for error details from hydrooj."
        exit 1 # 主动以失败状态退出，这也会触发 trap
    fi
}

# --- 脚本入口 ---
main "$@"