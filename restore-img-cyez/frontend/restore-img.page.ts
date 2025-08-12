import { $, addPage, AutoloadPage } from '@hydrooj/ui-default';

const customEditorPage = new AutoloadPage('customEditor', () => {
    console.log('Custom editor page loaded');
    // 监听编辑器初始化完成事件  
    $(document).on('vjContentNew', () => {
        updateUI();
    });
});

addPage(customEditorPage);
function updateUI() {
    $(() => {
        console.log($('.md-editor-footer-right'));
        for (let footer_container of $('.md-editor-footer-right')) {
            addEntryButton(footer_container);
        }
    });
}

function addEntryButton(footer_container) {
    if (footer_container.querySelector('#restore-img-item')) return;
    let item_container = $('<div class="md-editor-footer-item" id="restore-img-item"></div>');
    item_container.prependTo(footer_container);
    let btn = $('<label class="md-editor-footer-label">外链转存</label>');
    btn.click(async () => {
        //禁止图标
        btn.css({
            'cursor': 'wait',
            'pointer-events': 'none'
        });
        await mainProcesser();
        btn.css({
            'cursor': 'pointer',
            'pointer-events': 'auto'
        });
    });
    btn.css({ 'cursor': 'pointer' });
    btn.appendTo(item_container);
}

async function mainProcesser() {
    let tmp = new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(void 0);
        }, 5000);
    });
    await tmp;
    alert("finished")
}