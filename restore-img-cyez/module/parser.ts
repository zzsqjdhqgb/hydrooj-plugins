import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Root, Image } from 'mdast';

/**
 * 定义 URL 替换函数的类型签名。
 * 它接收一个字符串数组，并返回一个解析为字符串数组的 Promise。
 */
export type UrlReplacer = (urls: string[]) => Promise<string[]>;

/**
 * 解析 Markdown，使用 AST 安全地识别图片，并使用传入的替换函数来更新 URL。
 * 此函数保留了原始 Markdown 的格式。
 *
 * @param markdownContent 原始 Markdown 字符串。
 * @param urlReplacer 一个异步函数，接收原始 URL 数组，返回处理后的一一对应的新 URL 数组。
 * @returns 一个 Promise，解析为处理过的新 Markdown 字符串。
 */
export async function processMarkdownImages(
    markdownContent: string,
    urlReplacer: UrlReplacer
): Promise<string> {
    const imageNodes: Image[] = [];

    const tree: Root = unified().use(remarkParse).parse(markdownContent);

    visit(tree, 'image', (node: Image) => {
        imageNodes.push(node);
    });

    if (imageNodes.length === 0) {
        return markdownContent; // 没有图片，直接返回
    }

    // 从收集到的节点中提取原始 URL
    const originalUrls = imageNodes.map(node => node.url);

    // 调用作为参数传入的 URL 替换函数
    const newUrls = await urlReplacer(originalUrls);

    if (originalUrls.length !== newUrls.length) {
        throw new Error("urlReplacer 函数返回的 URL 数量与原始数量不匹配。");
    }

    const patches = imageNodes.map((node, index) => ({
        node,
        newUrl: newUrls[index],
    }));



    // 按位置倒序排序，以进行安全的字符串替换
    patches.sort((a, b) => {
        if (!a.node.position || !b.node.position) {
            // 如果某个节点没有位置信息，我们认为它们相等，不改变顺序
            return 0;
        } else {
            return b.node.position!.start.offset - a.node.position!.start.offset
        }
    });

    // 从后往前应用补丁
    let processedMarkdown = markdownContent;
    for (const patch of patches) {
        const { node, newUrl } = patch;
        const start = node.position!.start.offset;
        const end = node.position!.end.offset;
        const newImageMarkdown = `![${node.alt || ''}](${newUrl}${node.title ? ` "${node.title}"` : ''})`;

        processedMarkdown =
            processedMarkdown.slice(0, start) +
            newImageMarkdown +
            processedMarkdown.slice(end);
    }

    return processedMarkdown;
}