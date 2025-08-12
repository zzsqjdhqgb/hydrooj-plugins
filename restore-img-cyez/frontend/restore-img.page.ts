import { $, addPage, AutoloadPage } from '@hydrooj/ui-default';

const customEditorPage = new AutoloadPage('customEditor', () => {
    console.log('Custom editor page loaded');
    // 监听编辑器初始化完成事件  
    $(document).on('vjContentNew', () => {
        $(() => {
            console.log($('.md-editor-footer-right'));
            for (let footer_container of $('.md-editor-footer-right')) {
                addCustomButton(footer_container);
            }
        });
    });
});

addPage(customEditorPage);

function addCustomButton(footer_container) {
    let item_container = $('<div class="md-editor-footer-item"></div>');
    item_container.prependTo(footer_container);
    let btn = $('<label class="md-editor-footer-label">外链转存</label>');
    btn.click(() => {
        alert('点击了按钮');
    });
    btn.css({ 'cursor': 'pointer' });
    btn.appendTo(item_container);
}