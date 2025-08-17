import { $, addPage, AutoloadPage } from '@hydrooj/ui-default';
import { processMarkdownImages } from "../module/parser.ts"
import { BADHINTS } from 'dns';


const customEditorPage = new AutoloadPage('customEditor', () => {
    console.log("restore-img loaded.")
    $(document).on('vjContentNew', () => {
        entry();
    });
});

addPage(customEditorPage);
function entry() {
    $(() => {
        function getAllEditorInstances() {
            const editors = [];
            $('textarea[data-editor], textarea[data-markdown], textarea[data-yaml]').each((index, element) => {
                const editorInstance = $(element).data('vjEditorInstance');
                if (!editorInstance) return;
                if (!editorInstance.markdownEditor) return;
                editors.push(editorInstance)
                console.debug("Markdown editor found:", element, editorInstance);
            });
            return editors;
        }
        const editors = getAllEditorInstances();
        console.debug("editors:", editors);
        editors.forEach(editor => editorHandler(editor));
    });
}


function editorHandler(editor_instance): void {
    // jQuery element!!
    const textarea_element = editor_instance.$dom;
    const editor_root = textarea_element.parent()
    const footer_container = editor_root.find('.md-editor-footer-right');
    const editor_container = editor_root.children().has(footer_container);
    console.log({
        editor_instance,
        textarea_element,
        editor_root,
        editor_container,
        footer_container
    });
    const entry_button = addEntryButton(footer_container);
    if (!entry_button) return;
    console.log({ entry_button });
    entry_button.click(async () => {
        console.log('entry button clicked');
        // ===========================================================
        // BEGIN: FIX FOR https://github.com/hydro-dev/Hydro/pull/1042
        if (editor_instance.value() == undefined) {
            alert('由于 <https://github.com/hydro-dev/Hydro/pull/1042>，Hydro发行此修复前，用户需要先任意编辑markdown内容（例如：添加一个空格再删掉），才可以使用外链转存功能。');
            return;
        }
        // END: FIX FOR https://github.com/hydro-dev/Hydro/pull/1042
        // ===========================================================
        const original_mdstring = editor_instance.value();
        console.log({ original_mdstring });
        const replaced_mdstring = await mdStringProcesser(original_mdstring);
        console.log({ replaced_mdstring });
        editor_instance.value(replaced_mdstring);
    });

    async function mdStringProcesser(mdstring: string): Promise<string> {
        // TODO
        return mdstring + "\n\n484858";
    }

    function blockUI() {
        // TODO
    }
    function unblockUI() {
        // TODO
    }
}

function addEntryButton(footer_container) {
    if (footer_container.find('#restore-img-item').length) return null;
    let btn = $('<div class="md-editor-footer-item" id="restore-img-item"></div>');
    btn.prependTo(footer_container);
    let item_label = $('<label class="md-editor-footer-label">外链转存</label>');
    item_label.css({ 'cursor': 'pointer' });
    item_label.appendTo(btn);
    return btn;
}
