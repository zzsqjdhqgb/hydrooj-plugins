import { ActionDialog, Dialog, InfoDialog } from '@hydrooj/ui-default/components/dialog';
import { $ } from '@hydrooj/ui-default';
import { tpl } from '@hydrooj/ui-default/utils';

// 用于在 localStorage 中存储代理 URL。
const PROXY_STORAGE_KEY = 'user-last-used-proxy-url';

/**
 * 弹出一个对话框，让用户输入代理 URL。
 * 自动记住用户上一次的输入，并在下次打开时作为默认值填充。
 * @returns {Promise<string>} 如果用户确认，则返回输入的 URL；如果用户取消，则 Promise 会被拒绝。
 */
export async function getProxyUrl(): Promise<string> {
    // 2. 在创建对话框之前，尝试从 localStorage 中读取上次保存的值。
    //    如果找不到（例如第一次使用），则默认为一个空字符串。
    const lastUsedProxy = localStorage.getItem(PROXY_STORAGE_KEY) || '';

    const dialog = new ActionDialog({
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
                        autocomplete="url"
                        value="${lastUsedProxy}"
                    />
                </div>
                <div class="proxy-error-message" style="color: red; display: none;">
                    Proxy URL cannot be empty.
                </div>
            </div>
        `,
        onDispatch(action) {
            if (action !== 'ok') {
                return true; // 允许关闭
            }

            const $input = dialog.$dom.find('[name="proxyUrl"]');
            const $error = dialog.$dom.find('.proxy-error-message');
            const url = $input.val()?.toString().trim() || '';

            if (!url) {
                $error.show();
                $input.focus();
                return false; // 阻止关闭
            }

            $error.hide();
            return true;
        }
    });

    // 等待用户操作 (点击 "OK" 或 "Cancel")
    const action = await dialog.open();

    if (action === 'ok') {
        const userInput = (dialog.$dom.find('[name="proxyUrl"]').val() as string).trim();
        
        // 4. 当用户成功确认输入后，将新的值保存到 localStorage 中，以备下次使用。
        localStorage.setItem(PROXY_STORAGE_KEY, userInput);

        // 返回用户输入的值
        return userInput;
    } else {
        // 如果用户取消，则拒绝 Promise
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