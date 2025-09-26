import { UrlReplacer } from "./parser";
import { getProxyUrl, createDownloadProcess, showError } from "./user-interact";
import mime from 'mime-types';

export const MainReplacer: UrlReplacer = async (urls: string[]): Promise<string[]> => {
    let userProxy: string | null = null;
    userProxy = await getProxyUrl();

    const progressDialog = createDownloadProcess();
    let current_percent = 0;
    const total = urls.length;

    function downloadImagesViaProxy(originalUrl: string, proxyUrlTemplate: string): Promise<Blob | null> {
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

    let imageBlobs: (Blob | null)[] = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        imageBlobs.push(await downloadImagesViaProxy(url, userProxy as string));
    }

    progressDialog.updateProgress(100, "Done!");
    await new Promise(resolve => setTimeout(resolve, 500)); // 等待半秒以便用户看到完成状态
    progressDialog.close();

    console.debug("SampleParser called with URLs:", urls);
    let res: string[] = [];
    urls.forEach(url => {
        res.push("BEGIN: " + url + " :END");
    });
    return res;
}

function blobsToFiles(blobs: Blob[]) {
    return blobs.map((blob, index) => {
        // 为当前 Blob 创建一个文件名
        const filename = `asset-${index}`; // 如果没提供文件名，就用一个默认的

        // 使用 File 构造函数创建新的 File 对象
        return new File(
            [blob],         // 文件内容
            filename,       // 文件名
            { type: blob.type } // 文件类型，从原始 Blob 继承
        );
    });
}

