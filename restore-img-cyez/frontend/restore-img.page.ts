import { $, addPage, AutoloadPage } from '@hydrooj/ui-default';
import { processMarkdownImages } from "../module/parser.ts";
import { MainReplacer } from "../module/url-replacer.ts";
import { showInfo } from "../module/user-interact.ts";

/**
 * 管理单个 Markdown 编辑器实例的图片转存功能。
 * 封装了按钮的创建、事件处理、UI 状态管理和核心业务逻辑。
 */
class EditorImageProcessor {
    private editor: any;
    private $textarea: JQuery;
    private $footer: JQuery;
    private $button: JQuery | null = null;
    private buttonId: string;

    /**
     * @param editorInstance HydroOJ 的编辑器实例对象。
     */
    constructor(editorInstance: any) {
        this.editor = editorInstance;
        this.$textarea = editorInstance.$dom; // 编辑器关联的 <textarea>
        // HydroOJ 编辑器的 footer 通常在这个位置
        this.$footer = this.$textarea.parent().find('.md-editor-footer-right');
        // 为按钮创建一个唯一的 ID，以防页面上有多个编辑器
        this.buttonId = `restore-img-item-${Math.random().toString(36).substring(2)}`;
    }

    /**
     * 初始化处理器：创建按钮并附加事件监听器。
     */
    public initialize(): void {
        // 如果 footer 不存在或按钮已存在，则不进行任何操作
        if (this.$footer.length === 0 || this.$footer.find(`#${this.buttonId}`).length > 0) {
            return;
        }

        this._createButton();
        this._attachClickListener();
        console.debug("Image processor initialized for editor:", this.editor);
    }

    /**
     * 创建“外链转存”按钮并将其添加到编辑器 footer。
     * @private
     */
    private _createButton(): void {
        this.$button = $(`
            <div class="md-editor-footer-item" id="${this.buttonId}" title="将Markdown中的所有外部图片链接转存到本站">
                <label class="md-editor-footer-label" style="cursor: pointer;">外链转存</label>
            </div>
        `);
        this.$footer.prepend(this.$button);
    }

    /**
     * 为按钮绑定点击事件。
     * @private
     */
    private _attachClickListener(): void {
        this.$button?.on('click', async () => {
            await this._handleButtonClick();
        });
    }

    /**
     * 处理按钮点击事件的核心逻辑。
     * @private
     */
    private async _handleButtonClick(): Promise<void> {
        // 临时修复 Hydro 的一个 bug
        if (this.editor.value() === undefined) {
            showInfo("由于 Hydro 的一个已知问题，您需要先对内容进行任意编辑（如添加一个空格再删掉），才能使用此功能。");
            return;
        }

        try {
            const originalContent = this.editor.value();
            const newContent = await processMarkdownImages(originalContent, MainReplacer);
            this.editor.value(newContent);
        } catch (error) {
            // 在 MainReplacer 内部已经 showError，这里只在控制台记录
            console.error("Failed to process Markdown images:", error);
        }
    }
}

/**
 * 查找页面上所有符合条件的 Markdown 编辑器并初始化图片处理器。
 */
function initializeMarkdownProcessors(): void {
    const selector = 'textarea[data-editor], textarea[data-markdown], textarea[data-yaml]';
    
    $(selector).each((index, element) => {
        const $element = $(element);
        
        // 使用 data 属性检查，确保每个编辑器只被初始化一次
        if ($element.data('image-processor-initialized')) {
            return;
        }

        const editorInstance = $element.data('vjEditorInstance');
        
        // 确保获取到的是有效的 Markdown 编辑器实例
        if (editorInstance?.markdownEditor) {
            new EditorImageProcessor(editorInstance).initialize();
            $element.data('image-processor-initialized', true); // 标记为已处理
        }
    });
}

// HydroOJ 页面加载逻辑
const customEditorPage = new AutoloadPage('customEditor', () => {
    // 监听 HydroOJ 的内容更新事件，以支持动态加载的编辑器
    $(document).on('vjContentNew', initializeMarkdownProcessors);

    // 页面首次加载时也执行一次，以处理静态存在的编辑器
    initializeMarkdownProcessors();
});

addPage(customEditorPage);