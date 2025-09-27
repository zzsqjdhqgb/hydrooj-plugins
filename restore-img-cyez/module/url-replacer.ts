import { UrlReplacer } from "./parser";
import { getProxyUrl, createDownloadProcess, showError } from "./user-interact";
import { uploadFiles } from "@hydrooj/ui-default";

// 声明 UserContext 的类型，避免隐式 any 和全局变量的直接使用。
// 实际项目中，这应该从一个类型定义文件中导入。
declare const UserContext: { _id: string };

// --- 步骤 1: 将页面相关的逻辑提取并集中管理 ---

const PAGE_TYPES = {
    PROBLEM_CREATE: 'problem_create',
    PROBLEM_EDIT: 'problem_edit',
};

/**
 * 根据当前页面名称，生成与文件处理相关的配置。
 * @returns {object} 包含上传目标、参数和最终URL前缀的配置对象。
 */
function getPageContextConfig() {
    const pagename = document.documentElement.getAttribute('data-page') || '';
    const isProblemEdit = pagename === PAGE_TYPES.PROBLEM_EDIT;
    const isProblemPage = [PAGE_TYPES.PROBLEM_CREATE, PAGE_TYPES.PROBLEM_EDIT].includes(pagename);

    return {
        uploadUrl: isProblemEdit ? "./files" : "/file",
        uploadType: isProblemEdit ? "additional_file" : undefined,
        resultUrlPrefix: isProblemPage ? 'file://' : `/file/${UserContext._id}/`,
        isProblemPage // 保留此标志位以便将来可能的其他逻辑
    };
}

// --- 步骤 2: 创建一个独立的、可复用的并行下载函数 ---

/**
 * 并行下载所有提供的 URL，并通过回调报告进度。
 * @param {string[]} urls - 需要下载的 URL 列表。
 * @param {string} proxyTemplate - 代理 URL 模板，必须包含 "<url>" 占位符。
 * @param {(completed: number, total: number, url: string) => void} onProgress - 进度回调函数。
 * @returns {Promise<Blob[]>} 返回一个包含所有下载内容的 Blob 数组。
 */
async function downloadAllWithProgress(
    urls: string[],
    proxyTemplate: string,
    onProgress: (completed: number, total: number, url: string) => void
): Promise<Blob[]> {
    let completedCount = 0;
    const totalCount = urls.length;

    const downloadPromises = urls.map(async (originalUrl) => {
        const proxyUrl = proxyTemplate.replace("<url>", originalUrl);
        
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`Network response error: ${response.status} for ${proxyUrl}`);
            }
            const blob = await response.blob();
            
            // 任务完成后报告进度
            completedCount++;
            onProgress(completedCount, totalCount, originalUrl);

            return blob;
        } catch (error) {
            // 将错误包装，使其包含更多上下文信息
            throw new Error(`Failed to download ${originalUrl} via proxy. Reason: ${error.message}`);
        }
    });

    // 使用 Promise.all 等待所有下载任务完成
    return Promise.all(downloadPromises);
}

// --- `convertBlobsToFilesWithRandomNames` 函数本身设计得很好，我们保留它并为其添加 JSDoc ---

/**
 * 将 Blob 对象数组转换为带有随机名称的 File 对象数组。
 * @param {Blob[]} blobs - 需要转换的 Blob 数组。
 * @param {string} [fallbackExt=".bin"] - 当无法从 MIME 类型推断扩展名时的后备扩展名。
 * @returns {File[]} 转换后的 File 对象数组。
 */
function convertBlobsToFilesWithRandomNames(blobs: Blob[], fallbackExt = ".bin"): File[] {
    const MIME_TYPE_MAP: { [key: string]: string } = {
        "image/jpeg": ".jpeg", "image/jpg": ".jpg", "image/png": ".png",
        "image/gif": ".gif", "image/webp": ".webp", "image/bmp": ".bmp",
        "image/svg+xml": ".svg", "application/pdf": ".pdf", "text/plain": ".txt",
    };

    return blobs.map((blob) => {
        const extension = MIME_TYPE_MAP[blob.type] || fallbackExt;
        const randomName = crypto.randomUUID();
        const filename = `${randomName}${extension}`;
        return new File([blob], filename, { type: blob.type });
    });
}

// --- 步骤 3: 重构主函数，使其成为清晰的流程协调器 ---

export const MainReplacer: UrlReplacer = async (urls: string[]): Promise<string[]> => {
    // 将 progressDialog 的引用放在顶层，以便 finally 块可以访问
    let progressDialog: ReturnType<typeof createDownloadProcess> | null = null;

    try {
        console.debug("MainReplacer started with URLs:", urls);

        // 1. 获取配置
        const config = getPageContextConfig();
        console.debug("Page context config:", config);

        let userProxy: string;
        try {
            // 2. 获取代理 URL
            userProxy = await getProxyUrl();
        } catch (error) {
            // .1 如果用户取消，则不进行任何操作
           throw new Error(`User canceled operation.`);
        }

        // 3. 初始化 UI
        progressDialog = createDownloadProcess();
        const total = urls.length;

        // 4. 执行核心逻辑：并行下载
        progressDialog.updateProgress(0, `Starting download of ${total} files...`);
        const imageBlobs = await downloadAllWithProgress(urls, userProxy, (completed, total, url) => {
            const percent = (completed / total) * 100;
            progressDialog?.updateProgress(percent, `Downloaded ${completed}/${total}: ${url.substring(0, 50)}...`);
        });

        // 5. 数据处理
        progressDialog.updateProgress(95, "Processing downloaded data...");
        const files = convertBlobsToFilesWithRandomNames(imageBlobs);
        console.debug("Converted blobs to files:", files);

        // 6. 上传文件
        progressDialog.updateProgress(98, "Uploading files to server...");
        await uploadFiles(config.uploadUrl, files, { type: config.uploadType });

        // 7. 构建最终结果
        const resultUrls = files.map(file => `${config.resultUrlPrefix}${file.name}`);
        
        // 8. 完成并给予用户反馈
        progressDialog.updateProgress(100, "Done!");
        await new Promise((resolve) => setTimeout(resolve, 500)); // 短暂显示完成状态

        return resultUrls;

    } catch (error) {
        // 统一的错误处理
        console.error("An error occurred in MainReplacer:", error);
        await showError(error instanceof Error ? error.message : "An unknown error occurred.");
        // 向上抛出异常或返回空数组，取决于调用方的期望
        return urls;
    } finally {
        // 确保无论成功还是失败，对话框都会被关闭
        progressDialog?.close();
    }
};