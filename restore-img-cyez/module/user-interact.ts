import { ActionDialog, Dialog, InfoDialog } from '@hydrooj/ui-default/components/dialog';
import { $ } from '@hydrooj/ui-default';
import { tpl } from '@hydrooj/ui-default/utils';

/**
 * 弹出一个对话框，让用户输入代理 URL。
 * @returns {Promise<string>} 如果用户确认，则返回输入的 URL；如果用户取消，则 Promise 会被拒绝。
 */
export async function getProxyUrl(): Promise<string> {
    const dialog = new ActionDialog({
        // 使用模板字符串构建更清晰的 HTML 结构
        $body: tpl`
            <div class="typo">
                <label for="proxyUrlInput">Proxy:</label>
                <div class="textbox-container">
                    <input 
                        id="proxyUrlInput"
                        name="proxyUrl"
                        type="text"
                        class="textbox"
                        placeholder="https://proxy.example.com/<url>"
                        data-autofocus
                    />
                </div>
                <div class="proxy-error-message" style="color: red; display: none;">
                    Proxy URL cannot be empty.
                </div>
            </div>
        `,
        // onDispatch 钩子用于在对话框按钮被点击时进行处理
        onDispatch(action) {
            // 我们只关心确认操作
            if (action !== 'ok') {
                return true; // 允许关闭对话框
            }

            // 在分发事件时进行验证
            const $input = dialog.$dom.find('[name="proxyUrl"]');
            const $error = dialog.$dom.find('.proxy-error-message');
            const url = $input.val()?.toString().trim() || '';

            if (!url) {
                $error.show(); // 显示错误信息
                $input.focus(); // 让输入框重新获得焦点
                return false; // 返回 false 来阻止对话框关闭
            }

            $error.hide(); // 如果验证通过，隐藏错误信息
            return true; // 允许关闭对话框
        }
    });

    // 打开对话框并等待用户操作
    const action = await dialog.open();

    // 根据用户的操作决定是返回URL还是抛出错误
    if (action === 'ok') {
        // 从对话框的 DOM 中获取最终的输入值
        const finalUrl = dialog.$dom.find('[name="proxyUrl"]').val() as string;
        return finalUrl.trim();
    } else {
        // 如果用户取消，则拒绝 Promise，让调用方可以捕获这个行为
        return Promise.reject('User cancelled the proxy input dialog.');
    }
}

/**
 * 显示一个简单的信息提示对话框。
 * @param {string} message - 需要显示的信息内容。
 * @returns {Promise<void>} 对话框关闭后 resolve。
 */
export async function showInfo(message: string): Promise<void> {
    await new InfoDialog({
        $body: tpl.typoMsg(message)
    }).open();
}

/**
 * 创建并管理一个文件下载进度对话框。
 * @returns {{
 *   dialog: Dialog,
 *   updateProgress: (percent: number, text: string) => void,
 *   close: () => void
 * }} 返回一个包含对话框实例、更新进度方法和关闭方法的对象。
 */
export function createDownloadProcess() {
    const dialog = new Dialog({
        // 使用更具语义的 class 名称
        $body: `  
            <div class="download-status" style="text-align: center; margin-bottom: 5px; color: gray; font-size: small;">
                Initializing...
            </div>
            <div class="bp5-progress-bar bp5-intent-primary bp5-no-stripes">
                <div class="download-progress-bar bp5-progress-meter" style="width: 0%"></div>
            </div>
        `,
    });

    // 提前缓存 DOM 元素的引用，避免重复查询
    const $statusText = dialog.$dom.find('.download-status');
    const $progressBar = dialog.$dom.find('.download-progress-bar');

    // 打开对话框
    dialog.open();

    return {
        dialog, // 暴露对话框实例，以备不时之需

        /**
         * 更新进度条的显示状态。
         * @param {number} percent - 进度百分比 (0-100)。
         * @param {string} text - 显示在进度条上方的状态文本。
         */
        updateProgress: (percent: number, text: string) => {
            $statusText.text(text);
            $progressBar.width(`${percent}%`);
        },

        /**
         * 关闭进度对话框。
         */
        close: (): void => {
            dialog.close();
        }
    };
}