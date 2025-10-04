import { UrlReplacer } from "./parser";
import { getProxyUrl, createDownloadProcess } from "./user-interact";
import { uploadFiles } from "@hydrooj/ui-default";
import { Notification } from '@hydrooj/ui-default/components/dialog';
// +++ 新增引入 nanoid +++
import { nanoid } from 'nanoid';

// 假设的全局 UserContext 类型定义
declare const UserContext: { _id: string };

// --- 实用工具函数 ---

const PAGE_TYPES = {
    PROBLEM_CREATE: 'problem_create',
    PROBLEM_EDIT: 'problem_edit',
};

const CURRENT_HOST = window.location.hostname;

/**
 * 决定一个 URL 是否应该被跳过，不进行转存。
 * @param {string} url - 要检查的 URL。
 * @returns {boolean} 如果为 true，则跳过该 URL。
 */
function shouldSkipUrl(url: string): boolean {
    // 规则 1: 永远不要跳过 `data:` URIs，它们需要被特殊处理。
    if (url.startsWith('data:')) {
        return false;
    }

    // --- 从这里开始，都是“跳过”的规则 ---

    // 规则 2: 跳过 `file://` URIs。
    if (url.startsWith('file://')) {
        return true;
    }

    // 规则 3: 跳过无效的 URL 或已经指向本站的 URL。
    try {
        const parsedUrl = new URL(url);
        // 如果 URL 指向当前站点，则跳过
        if (parsedUrl.hostname === CURRENT_HOST) {
            return true;
        }
    } catch (e) {
        // 如果 new URL() 解析失败，说明它不是一个有效的、可处理的 URL，跳过。
        return true;
    }

    // 默认行为：如果以上所有跳过规则都未命中，则不跳过。
    return false;
}

/**
 * 将 Base64 Data URI 字符串转换为 Blob 对象。
 * @param {string} dataUri - `data:` 开头的 URI 字符串。
 * @returns {Promise<Blob>} 转换后的 Blob 对象。
 */
async function dataUriToBlob(dataUri: string): Promise<Blob> {
    const response = await fetch(dataUri);
    return response.blob();
}

/**
 * 根据当前页面名称，生成与文件处理相关的配置。
 */
function getPageContextConfig() {
    const pagename = document.documentElement.getAttribute('data-page') || '';
    const isProblemEdit = pagename === PAGE_TYPES.PROBLEM_EDIT;
    const isProblemPage = [PAGE_TYPES.PROBLEM_CREATE, PAGE_TYPES.PROBLEM_EDIT].includes(pagename);

    return {
        uploadUrl: isProblemEdit ? "./files" : "/file",
        uploadType: isProblemEdit ? "additional_file" : undefined,
        resultUrlPrefix: isProblemPage ? 'file://' : `/file/${UserContext._id}/`,
    };
}

/**
 * 并行获取所有 URL 的内容（通过代理下载或解码Base64）
 * @param {string[]} urls - 需要处理的 URL 列表。
 * @param {string} proxyTemplate - 代理 URL 模板。
 * @param {(completed: number, total: number, url: string) => void} onProgress - 进度回调。
 * @returns {Promise<Blob[]>} 返回包含所有内容的 Blob 数组。
 */
async function fetchAllUrlContents(
    urls: string[],
    proxyTemplate: string,
    onProgress: (completed: number, total: number, url: string) => void
): Promise<Blob[]> {
    let completedCount = 0;
    const totalCount = urls.length;

    const contentPromises = urls.map(async (originalUrl) => {
        try {
            let blob: Blob;
            if (originalUrl.startsWith('data:')) {
                blob = await dataUriToBlob(originalUrl);
            } else {
                // 为了兼容可能无法解码的简单代理，我们暂时移除 encodeURIComponent。
                // 如果代理服务器能处理编码后的URL，建议还是加上 `encodeURIComponent(originalUrl)` 以增加健壮性。
                const proxyUrl = proxyTemplate.replace("<url>", originalUrl);
                
                // [CORS 关键点]
                // 下面的 fetch 请求是一个跨域请求。
                // 如果 `proxyUrl` 所在的服务器没有配置正确的 CORS 响应头
                // (例如 Access-Control-Allow-Origin)，浏览器将在此处拦截请求并报错。
                // 这个问题需要通过配置代理服务器来解决，而不是修改前端代码。
                const response = await fetch(proxyUrl);

                if (!response.ok) {
                    throw new Error(`Network response error: ${response.status} for ${proxyUrl}`);
                }
                blob = await response.blob();
            }
            
            completedCount++;
            onProgress(completedCount, totalCount, originalUrl);
            return blob;
        } catch (error) {
            throw new Error(`Failed to process ${originalUrl}. Reason: ${error.message}`);
        }
    });

    return Promise.all(contentPromises);
}

/**
 * 生成一个对用户友好的、简短的、基于时间的唯一ID。
 * 格式: [base36时间戳]-[4位随机字符]
 * @returns {string} 例如: "l6i42ixo-b3k4"
 */
function generateId(): string {
  // 1. 获取当前时间的毫秒数，并将其转换为 Base36 编码。
  // Base36 (0-9, a-z) 是一种非常紧凑的方式来表示数字。
  const timestampPart = Date.now().toString(36);

  // 2. 生成一小段随机字符串，用于防止同一毫秒内的冲突。
  const randomPart = nanoid(4);

  return `${timestampPart}-${randomPart}`;
}


/**
 * 将 Blob 对象数组转换为带有随机名称的 File 对象数组。
 */
function convertBlobsToFilesWithRandomNames(blobs: Blob[], fallbackExt = ".bin"): File[] {
    const MIME_TYPE_MAP: { [key: string]: string } = { "image/jpeg": ".jpeg", "image/jpg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp", "image/bmp": ".bmp", "image/svg+xml": ".svg", "application/pdf": ".pdf", "text/plain": ".txt" };
    return blobs.map((blob) => {
        const extension = MIME_TYPE_MAP[blob.type] || fallbackExt;
        const randomName = "MD-ASSET-" + generateId();
        const filename = `${randomName}${extension}`;
        return new File([blob], filename, { type: blob.type });
    });
}

// --- 主流程协调器 ---

export const MainReplacer: UrlReplacer = async (urls: string[]): Promise<string[]> => {
    let progressDialog: ReturnType<typeof createDownloadProcess> | null = null;
    
    // --- 步骤 1: 任务分类 ---
    const jobsToProcess: { url: string, originalIndex: number }[] = [];
    const resultUrls: string[] = new Array(urls.length);

    urls.forEach((url, index) => {
        if (shouldSkipUrl(url)) {
            // 对于要跳过的 URL，直接将其放入结果数组的正确位置
            resultUrls[index] = url;
        } else {
            // 否则，将其加入待处理任务列表
            jobsToProcess.push({ url, originalIndex: index });
        }
    });

    // 如果没有任何需要处理的 URL，直接返回
    if (jobsToProcess.length === 0) {
        Notification.info("No URLs to process.");
        return resultUrls;
    }

    // --- 步骤 2: 获取用户输入（如果需要处理任务） ---
    let userProxy: string;
    try {
        userProxy = await getProxyUrl();
    } catch (rejectionReason) {
        Notification.info("User canceled.");
        return urls; // 用户取消，返回原始数组
    }

    // --- 步骤 3: 执行核心工作流 ---
    try {
        const config = getPageContextConfig();
        progressDialog = createDownloadProcess();
        
        const urlsToProcess = jobsToProcess.map(job => job.url);
        const total = urlsToProcess.length;

        // 3.1. 获取内容 (下载或解码)
        progressDialog.updateProgress(0, `Starting processing of ${total} items...`);
        const blobs = await fetchAllUrlContents(urlsToProcess, userProxy, (completed, total, url) => {
            const percent = (completed / total) * 100;
            progressDialog?.updateProgress(percent, `Processed ${completed}/${total}: ${url.substring(0, 50)}...`);
        });

        // 3.2. 数据处理与上传
        progressDialog.updateProgress(95, "Converting data and uploading...");
        const files = convertBlobsToFilesWithRandomNames(blobs);
        await uploadFiles(config.uploadUrl, files, { type: config.uploadType });

        // 3.3. 将新生成的 URL 插入结果数组的正确位置
        files.forEach((file, i) => {
            const job = jobsToProcess[i];
            const newUrl = `${config.resultUrlPrefix}${file.name}`;
            resultUrls[job.originalIndex] = newUrl;
        });
        
        progressDialog.updateProgress(100, "Done!");
        await new Promise((resolve) => setTimeout(resolve, 500));

        return resultUrls; // 成功！

    } catch (error) {
        console.error("An error occurred in MainReplacer's workflow:", error);
        await Notification.error(error instanceof Error ? error.message : "An unknown error occurred.");
        return urls; // 发生错误，返回原始数组
    } finally {
        progressDialog?.close();
    }
};