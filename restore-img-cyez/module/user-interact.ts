import { ActionDialog, Dialog, InfoDialog } from '@hydrooj/ui-default/components/dialog';
import { $ } from '@hydrooj/ui-default';
import { tpl } from '@hydrooj/ui-default/utils';

export function getProxyUrl(): Promise<string> {
    console.log("getProxyUrl called");
    return new Promise(async (resolve, reject) => {
        const inputDialog = new ActionDialog({
            $body: tpl`
                <div class="typo">
                    <label>
                        Proxy:
                        <div class="textbox-container">
                            <input 
                                name="proxyUrl"
                                type="text"
                                class="textbox"
                                placeholder="https://proxy.example.com/<url>"
                                data-autofocus
                            />
                        </div>
                        <!-- 1. 在这里添加红色的提示语元素 -->
                    </label>
                    <span
                      id="proxy-error-message" 
                      style="color: red; display: none;"
                    >
                      Proxy can not be empty!
                    </span>
                </div>
             `,
            onDispatch(action) {
                if (action === 'ok') {
                    // 为了方便复用，先获取 jQuery 对象
                    const $input = inputDialog.$dom.find('[name="proxyUrl"]');
                    const $error = inputDialog.$dom.find('#proxy-error-message');
                    const inputValue = $input.val();

                    // 检查输入值是否为空 (使用 trim() 移除前后空格)
                    if (!inputValue || inputValue.trim() === '') {
                        // 2. 如果为空，显示错误提示
                        $error.show(); // 或者使用 $error.show();

                        $input.focus();
                        return false; // 阻止关闭弹窗  
                    } else {
                        // 3. 如果不为空，确保错误提示是隐藏的
                        $error.hide(); // 或者使用 $error.hide();
                    }
                }
                return true;
            }
        });
        const action = await inputDialog.open();
        if (action === 'ok') {
            const userInput = inputDialog.$dom.find('[name="proxyUrl"]').val();
            resolve(userInput as string);
        } else {
            reject('User cancelled the input dialog');
        }
    });
}

export async function showError(message: string): Promise<void> {
    await new InfoDialog({
        $body: tpl.typoMsg(message)
    }).open();
}

export function createDownloadProcess() {
    const dialog = new Dialog({
        $body: `  
            <div class="file-label" style="text-align: center; margin-bottom: 5px; color: gray; font-size: small;">准备中...</div>
            <div class="bp5-progress-bar bp5-intent-primary bp5-no-stripes">
                <div class="file-progress bp5-progress-meter" style="width: 0"></div>
            </div>
        `,
    });

    dialog.open();

    // 获取进度条元素  
    const $fileLabel = dialog.$dom.find('.dialog__body .file-label');
    const $fileProgress = dialog.$dom.find('.dialog__body .file-progress');

    return {
        dialog,
        updateProgress: (filePercent: number, fileText: string,) => {
            $fileLabel.text(fileText);
            $fileProgress.width(`${filePercent}%`);
        },
        close: (): void => dialog.close()
    };
}