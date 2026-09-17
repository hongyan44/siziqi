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
        alert.setAttribute('variant', variant);
        alert.setAttribute('closable', 'true');
        alert.setAttribute('duration', this.duration);
        alert.innerHTML = `
        <sl-icon slot='icon' name='${this.icon}'></sl-icon>
        ${message}
        `;

        alert.addEventListener('sl-after-hide', () => {
            // alert.remove();
            if (this.e === alert) this.e = null;
        });

        this.e = alert;

        return alert.toast();
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