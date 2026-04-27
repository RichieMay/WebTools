// ==UserScript==
// @name         智谱 GLM Coding 购买助手
// @namespace    https://github.com/RichieMay/WebTools/raw/master/GLMCoding.user.js
// @version      1.0.18
// @description  智谱 GLM Coding 自动购买工具
// @author       RichieMay
// @match        https://*.bigmodel.cn/glm-coding*
// @icon         https://bigmodel.cn/img/icons/favicon-32x32.png
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 重定向到推广链接: https://bigmodel.cn/glm-coding?ic=DVXGFYTBNN
    // ==========================================
    function redirect_promotion() {
        if (!window.location.search.includes('DVXGFYTBNN')) {
            window.location.href = '/glm-coding?ic=DVXGFYTBNN';
        }
    }
    redirect_promotion();

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
                        headers: response.headers,
                        statusText: response.statusText
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
                //检查验证码是否正确
                if (this._reqUrl.includes('/cap_union_new_verify')) {
                    try {
                        const error = parseInt(originalJSONParse(this.responseText)?.errorCode);
                        if (error !== 0) {
                            setTimeout(() => { refreshCaptcha(); }, 200);
                        }
                    } catch(e) {}

                    return;
                }

                //检查订单状态
                if (this._reqUrl.includes('/pay/preview')) {
                    let respJson = originalJSONParse(this.responseText);
                    const jsonData = respJson?.data;
                    if (jsonData?.bizId) {
                        console.log(`[购买助手] 🚀 拦截到 XHR 购买成功(bizId=${jsonData.bizId}), 请尽快支付！`);
                        return;
                    }

                    // 用劫持 getter 的方式修改 this.responseText
                    Object.defineProperty(this, 'response', { get: function() { return respJson; } });
                    Object.defineProperty(this, 'responseText', { get: function() { return JSON.stringify(respJson); } });

                    // 直接返回系统繁忙,避免发起bizId=null的check请求
                    respJson.code = 555;
                    respJson.data = null;
                    respJson.msg = '系统繁忙,请稍后再试';

                    console.log('[购买助手] 🚀 拦截到 XHR 购买失败，正在重新购买！');

                    continueToBuy();
                }
            } catch (e) {
                console.log('[购买助手] 🚀 拦截到 XHR 购买异常，正在重新购买！');

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
    async function processCaptcha(captchaObject, jsonObject) {
       try {
           console.log('[购买助手] 🚀 点击验证码', JSON.stringify(jsonObject));

           const rect = captchaObject.target.getBoundingClientRect();
           for (const word of captchaObject.text.split(' ')) {
               const coords = jsonObject[word];
               const clientX = rect.left + coords[0];
               const clientY = rect.top + coords[1];
               captchaObject.target.dispatchEvent(new MouseEvent('click', {clientX, clientY, bubbles: true}));

               await sleep(100);
           };

           confirmCaptcha(captchaObject);
       } catch(e) {
           refreshCaptcha(captchaObject);
       }
    }

    // 提交确认验证码
    function confirmCaptcha(captchaObject) {
        console.log('[购买助手] 🚀 提交验证码');

        captchaObject.done = true;
        captchaObject.image = captchaObject.text = null;

        document.querySelector('.tencent-captcha-dy__verify-confirm-btn')?.click()
    }

    // 刷新验证码
    function refreshCaptcha(captchaObject = null) {
        console.log('[购买助手] 🚀 刷新验证码');

        if (captchaObject) {
            captchaObject.done = true;
            captchaObject.image = captchaObject.text = null;
        }

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
                processCaptcha(captchaObject, originalJSONParse(res.responseText));
            },
            onabort: function(err) {
                refreshCaptcha(captchaObject);
            },
            onerror: function(err) {
                refreshCaptcha(captchaObject);
            },
            ontimeout: function(err) {
                refreshCaptcha(captchaObject);
            }
        });
    }

    // ==========================================
    // 监控验证码弹窗
    // 通过记录用户最新点击的套餐对应按钮事件
    // ==========================================
    function watch_captcha_area(captchaNode) {
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
                    captchaObject.width = Math.round(parseFloat(style.width));
                    captchaObject.height = Math.round(parseFloat(style.height));
                }
            },
            'aria-label': (elementNode, captchaObject) => {
                 if (elementNode.textContent?.startsWith('请依次点击')) {
                    captchaObject.text = elementNode.textContent.trim().split('：')?.[1];
                 }
            }
        }

        let captcha = { image: null, text: null, width: 0, height: 0, done: true, target: null };
        new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (!captcha.done) {
                    return;
                }

                mapper[mutation.attributeName](mutation.target, captcha);
                if (captcha.image && captcha.text) {
                    request_captcha_service(captcha);
                }
            }
        }).observe(captchaNode, {subtree: true, attributes: true, attributeFilter:['style', 'aria-label']});
    }

    // ==========================================
    // 获取用户当前购买的套餐
    // 通过记录用户最新点击的套餐对应按钮事件
    // ==========================================
    function watch_card_box_area(cardBoxNodes) {
        cardBoxNodes.forEach((card) => {
            const button = card.querySelector('.buy-btn');
            const title = card.querySelector('.package-card-title .font-prompt')?.textContent?.trim();

            button.addEventListener('click', function(e) {
                wantedBuyPlan.plan = title;
                wantedBuyPlan.button = button;

                console.log(`[购买助手] 🚀 正在购买套餐: ${wantedBuyPlan.plan}`);
            });

            new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (!wantedBuyPlan.continued) {
                        return;
                    }

                    if (!wantedBuyPlan.button.disabled) {
                        wantedBuyPlan.continued = false;
                        wantedBuyPlan.button.click();
                    }
                }
            }).observe(button, {attributes: true, attributeFilter:['disabled']});
        });
    }

    // ==========================================
    // 加载主流程逻辑
    // 通过监控购买套餐及验证码节点加载主流程逻辑
    // ==========================================
    new MutationObserver((mutations, observer) => {
        for (const mutation of mutations) {
            const captchaNode = mutation.target?.querySelector('#tCaptchaDyMainWrap');
            if (!captchaNode) {
                continue;
            }

            const cardBoxNodes = mutation.target?.querySelectorAll('.glm-coding-package-list .package-card-box');
            if (!cardBoxNodes?.length) {
                continue;
            }

            watch_captcha_area(captchaNode);
            watch_card_box_area(cardBoxNodes);

            observer.takeRecords();
            observer.disconnect();

            console.log('[购买助手] 🚀 已在页面加载成功');
            return;
        }
    }).observe(document.body, {childList : true, subtree: true});
})();
