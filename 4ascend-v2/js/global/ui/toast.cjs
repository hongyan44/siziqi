/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 提示
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
class ShToast {
    /**
     * @description: 创建
     * @param {string} duration
     * @param {string} icon
     * @return {ShToast}
     */
    constructor(duration = 1200, icon = 'info-circle') {
        this.duration = duration;
        this.icon = icon;

        /** @type {HTMLElement} */
        this.e = null;
    };

    /**
     * @description: 弹出
     * @param {'success'|'danger'|'primary'} variant
     * @param {string} message
     * @return {void}
     */
    toast(variant, message) {
        if (this.e && this.e.isConnected) {
            this.e.remove();
            this.e = null;
        }

        const alert = document.createElement('sl-alert');
        alert.variant = variant;
        alert.closable = true;
        alert.duration = Number(this.duration) || 1200;
        // Shoelace toast() 会把已在 DOM 中的 alert 挪到 toast stack；未先挂载时不会显示。
        alert.innerHTML = `
        <sl-icon slot='icon' name='${this.icon}'></sl-icon>
        ${message}
        `;

        alert.addEventListener('sl-after-hide', () => {
            if (this.e === alert) this.e = null;
        });

        this.e = alert;
        document.body.append(alert);

        // 自定义元素尚未升级完成时，等 sl-alert 定义后再弹出，避免 toast 方法不存在。
        if (typeof alert.toast === 'function') return alert.toast();
        return customElements.whenDefined('sl-alert').then(() => alert.toast());
    };

    /**
     * @description: 成功
     * @param {string} message
     * @return {void}
     */
    success(message) {
        this.toast('success', message);
    };

    /**
     * @description: 失败
     * @param {string} message
     * @return {void}
     */
    error(message) {
        this.toast('danger', message);
    };

    /**
     * @description: 信息
     * @param {string} message
     * @return {void}
     */
    info(message) {
        this.toast('primary', message);
    };
}


export { ShToast };