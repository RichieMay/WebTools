// ==UserScript==
// @name         智谱 GLM Coding 购买助手
// @namespace    https://github.com/RichieMay/WebTools/raw/master/GLMCoding.user.js
// @version      1.0.7
// @description  智谱 GLM Coding 自动购买工具
// @author       RichieMay
// @match        https://bigmodel.cn/glm-coding*
// @match        https://www.bigmodel.cn/glm-coding*
// @icon         https://bigmodel.cn/img/icons/favicon-32x32.png
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 关闭无效的支付弹窗并继续购买
    // ==========================================
    let wantedBuyPlan = {button: null, plan: null, continued: false};
    function continueToBuy() {
        console.log(`[购买助手] 🚀 自动继续购买套餐: ${wantedBuyPlan.plan}`);

        document.querySelector('.white-mask-bg .el-dialog__headerbtn')?.click();
        wantedBuyPlan.continued = true; setTimeout(() => {
            if (!wantedBuyPlan.button.disabled) {
                wantedBuyPlan.button.click();
            }
        }, 200);
    }

    // ==========================================
    // 战术一：拦截 SSR 页面初始注入数据与内部方法解析
    // 通过劫持浏览器的 JSON 解析器，任何带有"售罄"属性的对象强制改为"有货"
    // ==========================================
    const originalJSONParse = JSON.parse;
    JSON.parse = function(text, reviver) {
        let result = originalJSONParse(text, reviver);

        // 递归遍历所有解析出的对象属性
        function deepModify(obj) {
            if (!obj || typeof obj !== 'object') return;

            // 篡改核心售罄标识
            if (obj.isSoldOut === true) obj.isSoldOut = false;
            if (obj.soldOut === true) obj.soldOut = false;
            // 如果遇到 disabled，且该对象看起来是个商品(包含 price/id 等)，则强制启用
            if (obj.disabled === true && (obj.price !== undefined || obj.productId || obj.title)) {
                obj.disabled = false;
            }
            // 有些系统会下发库存数量，顺手给它改大
            if (obj.stock === 0) obj.stock = 999;

            for (let key in obj) {
                if (obj[key] && typeof obj[key] === 'object') {
                    deepModify(obj[key]);
                }
            }
        }

        try { deepModify(result); } catch (e) {}
        return result;
    };

    // ==========================================
    // 战术二：拦截 Fetch 接口请求
    // 针对用户在页面停留时，前端向后端发起的存量/价格二次检查
    // ==========================================
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        // 我们只处理 JSON 接口
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const clone = response.clone();
            try {
                let text = await clone.text();
                // 粗暴地全局替换响应体文字中的售罄状态
                if (text.includes('"isSoldOut":true') || text.includes('"disabled":true') || text.includes('"soldOut":true')) {
                    console.log('[购买助手] 🚀 拦截到 Fetch 售罄数据，正在执行篡改！', args[0]);
                    text = text.replace(/"isSoldOut":true/g, '"isSoldOut":false')
                               .replace(/"disabled":true/g, '"disabled":false')
                               .replace(/"soldOut":true/g, '"soldOut":false')
                               .replace(/"stock":0/g, '"stock":999');
                    // 构造并返回一份假的响应给 Vue
                    return new Response(text, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                }
            } catch (e) {}
        }
        return response;
    };

    // ==========================================
    // 战术三：拦截老式的 XMLHttpRequest (兜底)
    // ==========================================
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._reqUrl = url;
        return originalXHROpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function(...args) {
        this.addEventListener('readystatechange', function() {
            if (this.readyState !== 4) {
                return;
            }

            try {
                if (this._reqUrl.includes('/cap_union_new_verify')) {
                    try {
                        const error = parseInt(originalJSONParse(this.responseText)?.errorCode);
                        if (error !== 0) {
                            setTimeout(() => { refreshCaptcha(); }, 200);
                        }
                    } catch(e) {}

                    return;
                }

                if (this._reqUrl.includes('/pay/check')) {
                    if (originalJSONParse(this.responseText).data?.toUpperCase() === "EXPIRE") {
                        console.log('[购买助手] 🚀 拦截到 XHR 服务器确认无效，正在重新购买！', this._reqUrl);

                        continueToBuy();
                    } else {
                        console.log('[购买助手] 🚀 拦截到 XHR 服务器确认似乎有效，请尽快确认支付！', this._reqUrl);
                    }

                    return;
                }

                if (this._reqUrl.includes('/pay/preview')) {
                    let respJson = originalJSONParse(this.responseText);
                    // 用劫持 getter 的方式修改 this.responseText 给框架层消化
                    Object.defineProperty(this, 'response', { get: function() { return respJson; } });
                    Object.defineProperty(this, 'responseText', { get: function() { return JSON.stringify(respJson); } });

                    let jsonData = respJson.data;
                    if (jsonData.soldOut || jsonData.disabled || jsonData.isSoldOut) {
                        console.log('[购买助手] 🚀 拦截到 XHR 售罄数据，正在执行篡改！', this._reqUrl);

                        jsonData.soldOut !== undefined && (jsonData.soldOut = false);
                        jsonData.disabled !== undefined && (jsonData.disabled = false);
                        jsonData.isSoldOut !== undefined && (jsonData.isSoldOut = false);
                    }

                    if (!jsonData.bizId) {
                        console.log('[购买助手] 🚀 拦截到 XHR 购买失败，正在重新购买！', this._reqUrl);

                        // 直接返回系统繁忙,避免发起bizId=null的check请求
                        respJson.code = 555;
                        respJson.data = null;
                        respJson.msg = '系统繁忙,请稍后再试';

                        continueToBuy();
                    } else {
                        console.log(`[购买助手] 🚀 拦截到 XHR 购买有效(bizId=${jsonData.bizId})，正在向服务器确认！`, this._reqUrl);
                    }
                }
            } catch (e) {
                console.log('[购买助手] 🚀 拦截到 XHR 购买异常，正在重新购买！', this._reqUrl);

                continueToBuy();
            }
        });

        originalXHRSend.apply(this, args);
    };

    // ==========================================
    // 验证码相关操作,包括点击、刷新、确认等
    // 通过AI服务识别并确认验证码,失败则刷新
    // ==========================================
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 点击验证码坐标
    async function clickAtCaptcha(elementNode, jsonObject) {
       try {
           console.log('[购买助手] 🚀 点击验证码', jsonObject);

           const rect = elementNode.target.getBoundingClientRect();
           for (const word of elementNode.text.split(' ')) {
               const coords = jsonObject[word];
               const clientX = rect.left + coords[0];
               const clientY = rect.top + coords[1];
               elementNode.target.dispatchEvent(new MouseEvent('click', {clientX, clientY, bubbles: true}));

               await sleep(100);
           };

           confirmCaptcha();
       } catch(e) {
           refreshCaptcha();
       }
    }

    // 提交确认验证码
    function confirmCaptcha() {
        console.log('[购买助手] 🚀 提交验证码');

        document.querySelector('.tencent-captcha-dy__verify-confirm-btn')?.click()
    }

    // 刷新验证码
    function refreshCaptcha() {
        console.log('[购买助手] 🚀 刷新验证码');

        //验证码弹窗未关闭
        const opacity = parseInt(getComputedStyle(document.querySelector('#tcaptcha_transform_dy'))?.opacity);
        if (opacity === 1) {
            document.querySelector('.tencent-captcha-dy__footer-icon--refresh')?.click()
        }
    }

    // 识别验证码
    function request_captcha_service(captchaObject) {
        console.log('[购买助手] 🚀 识别验证码');

        captchaObject.done = false; GM_xmlhttpRequest({
            method: "POST",
            url: "http://127.0.0.1:8000/extract",
            headers: {
                "Content-Type": "application/json"
            },
            data: JSON.stringify(captchaObject),
            onload: function (res) {
                clickAtCaptcha(captchaObject, originalJSONParse(res.responseText));
            },
            onabort: function(err) {
                captchaObject.done = true;
                captchaObject.image = captchaObject.text = null;
                refreshCaptcha();
            },
            onerror: function(err) {
                captchaObject.done = true;
                captchaObject.image = captchaObject.text = null;
                refreshCaptcha();
            },
            ontimeout: function(err) {
                captchaObject.done = true;
                captchaObject.image = captchaObject.text = null;
                refreshCaptcha();
            },
            onloadend: function(err) {
                captchaObject.done = true;
                captchaObject.image = captchaObject.text = null;
            }
        });
    }

    // ==========================================
    // 监控验证码弹窗
    // 通过记录用户最新点击的套餐对应按钮事件
    // ==========================================
    function watch_captcha_warp() {
        let captcha = { image: null, text: null, width: 0, height: 0, done: true, target: null };
        const mapper = {
            'style': (elementNode, captchaObject) => {
                const style = getComputedStyle(elementNode);
                let imageUrl = style?.backgroundImage;
                if (imageUrl === 'none') {
                    return;
                }

                imageUrl = imageUrl.match(/url\(["']?(.*?)["']?\)/)?.[1];
                if (imageUrl !== captchaObject.image) {
                    captchaObject.target = elementNode;
                    captchaObject.image = imageUrl;
                    captchaObject.width = parseInt(style.width);
                    captchaObject.height = parseInt(style.height);
                }
            },
            'aria-label': (elementNode, captchaObject) => {
                 if (elementNode.textContent?.includes('请依次点击')) {
                    captchaObject.text = elementNode.textContent.trim().split('：')?.[1];
                 }
            }
        }

        new MutationObserver(function(mutations){
            mutations.forEach(function(mutation) {
                if (!captcha.done) {
                    return;
                }

                mapper[mutation.attributeName](mutation.target, captcha);
                if (captcha.image && captcha.text) {
                    request_captcha_service(captcha);
                }
            });
        }).observe(document.querySelector('.tencent-captcha-dy__warp'), {subtree: true, attributes: true, attributeFilter:['style', 'aria-label']});
    }

    // ==========================================
    // 获取用户当前购买的套餐
    // 通过记录用户最新点击的套餐对应按钮事件
    // ==========================================
    setTimeout(() => {
        try {
            //监控验证码窗口
            watch_captcha_warp();

            const cards = document.querySelectorAll('.glm-coding-package-list .package-card-box');
            if (!cards?.length) {
                throw null;
            }

            for (const card of cards) {
                const button = card.querySelector('.buy-btn');
                const title = (card.querySelector('.package-card-title .font-prompt')?.textContent || '').trim();
                button?.addEventListener('click', function(e) {
                    wantedBuyPlan.plan = title;
                    wantedBuyPlan.button = button;

                    console.log(`[购买助手] 🚀 正在购买套餐: ${wantedBuyPlan.plan}`);
                });

                new MutationObserver(function(mutations){
                    mutations.forEach(function(mutation) {
                        if (!wantedBuyPlan.continue) {
                            return;
                        }

                        wantedBuyPlan.continued = false;
                        if (!wantedBuyPlan.button.disabled) {
                            wantedBuyPlan.button.click();
                        }
                    })
                }).observe(button, {attributes: true, attributeFilter:['disabled']})
            }

            console.log('[购买助手] 🚀 已在页面加载成功');
        } catch (e) {
            console.log('[购买助手] 🚀 已在页面加载失败');
            alert('请注意：插件加载失败，请刷新页面！')
        }
    }, 3000)
})();
