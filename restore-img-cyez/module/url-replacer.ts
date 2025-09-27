import { UrlReplacer } from "./parser";
import { getProxyUrl, createDownloadProcess, showError } from "./user-interact";
import { uploadFiles }   from '@hydrooj/ui-default';

export const MainReplacer: UrlReplacer = async (urls: string[]): Promise<string[]> => {
    let userProxy: string | null = null;
    userProxy = await getProxyUrl();

    const progressDialog = createDownloadProcess();
    let current_percent = 0;
    const total = urls.length;

    function downloadImagesViaProxy(originalUrl: string, proxyUrlTemplate: string): Promise<Blob> {
        // 2. 对原始URL进行编码，以安全地将其作为另一URL的一部分
        const encodedUrl = originalUrl; //encodeURIComponent(originalUrl);

        // 3. 将编码后的URL插入到代理模板中，创建最终的请求URL
        const proxyUrl = proxyUrlTemplate.replace('<url>', encodedUrl);

        progressDialog.updateProgress(
            current_percent / total * 100,
            "GET: " + proxyUrl
        );

        // 4. 使用 fetch 发起请求
        return fetch(proxyUrl)
            .then(response => {
                // 检查请求是否成功
                if (!response.ok) {
                    throw new Error(`网络响应错误: ${response.status} ${response.statusText} for URL: ${proxyUrl}`);
                }
                current_percent++;
                progressDialog.updateProgress(
                    current_percent / total * 100,
                    "Success: " + proxyUrl
                );
                // 5. 将响应体转换为 Blob 对象
                return response.blob();
            })
            .catch(async error => {
                await showError(`${error.message}`);
                progressDialog.close();
                throw error;
            });
    }

    let imageBlobs: (Blob)[] = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        imageBlobs.push(await downloadImagesViaProxy(url, userProxy as string));
    }

    progressDialog.updateProgress(95, "Processing image data...");
    const files = convertBlobsToFilesWithRandomNames(imageBlobs);
    console.debug("Converted files:", files);

    progressDialog.updateProgress(100, "Done!");
    await new Promise(resolve => setTimeout(resolve, 500)); // 等待半秒以便用户看到完成状态
    progressDialog.close();

    // here strange error occurs
    await uploadFiles('/file', files)

    console.debug("SampleParser called with URLs:", urls);
    let res: string[] = [];
    urls.forEach(url => {
        res.push("BEGIN: " + url + " :END");
    });
    return res;
}

function convertBlobsToFilesWithRandomNames(blobs: Blob[], fallbackExt = '.bin') {
    // 1. 定义一个从 MIME 类型到文件扩展名的映射表
    //    您可以根据自己的需求自由增删。
    const MIME_TYPE_MAP: { [key: string]: string } = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
        'application/pdf': '.pdf',
        'text/plain': '.txt',
        'text/html': '.html',
        'application/json': '.json',
        // ... 添加更多你可能需要的类型
    };

    // 2. 使用 Array.prototype.map 遍历并转换每个 Blob
    return blobs.map(blob => {
        // a. 从 Blob 的 .type 属性推断文件扩展名
        const extension = MIME_TYPE_MAP[blob.type] || fallbackExt;

        // b. 使用 crypto.randomUUID() 生成一个高度唯一的字符串作为主文件名
        const randomName = crypto.randomUUID();

        // c. 组合成完整的文件名
        const filename = `${randomName}${extension}`;

        // d. 使用 File 构造函数创建新的 File 对象
        //    - 第一个参数是包含 Blob 内容的数组: [blob]
        //    - 第二个参数是新的文件名
        //    - 第三个参数是选项，我们在这里保留原始的 MIME 类型
        return new File([blob], filename, { type: blob.type });
    });
}