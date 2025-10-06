// ==UserScript==
// @name         转转/爱回收爬虫
// @version      1.0.32
// @author       RichieMay
// @namespace    https://github.com/RichieMay/WebTools/raw/master/SecondHandSpider.user.js
// @description  转转/爱回收二手商品爬取
// @match        https://m.aihuishou.com/*
// @match        https://m.zhuanzhuan.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

// 爱回收入口: https://m.aihuishou.com
// 转转入口: https://m.zhuanzhuan.com/u/b2c_list_page/list?keyword=iPhone15Pro

(function() {
    'use strict';

    window.backend = new Worker(URL.createObjectURL(new Blob([`
        class Platform {
            constructor(entry) {
                this.entry = entry
                this.completed = true
            }

            is_completed() {
                return this.completed
            }

            load_more_goods() {}

            parse_os_version(good) {}

            add_to_favorites(good) {}
        }

        class ZZ_Platform extends Platform {
            constructor(entry) {
                entry.body = Object.fromEntries(new URLSearchParams(entry.body));
                entry.body.param = JSON.parse(entry.body.param);
                if (entry.body.param.pageIndex !== 1) {
                    throw "must be initialized with the first page (pageIndex = 1)"
                }

                entry.body.param.pageIndex -= 1
                super(entry)
            }

            load_more_goods() {
                this.entry.body.param.pageIndex += 1;
                this.entry.body.param.rstmark = Date.now();
                this.entry.request_headers.zzreqt = Date.now();
                const formData = new URLSearchParams({
                    param: JSON.stringify(this.entry.body.param)
                });

                this.completed = false;
                return fetch(this.entry.url, {
                    method: this.entry.method,
                    headers: this.entry.request_headers,
                    body: formData,
                    credentials: 'include'
                }).then(res => res.json()).then(body => Array.from(body.respData.datas).map(good => ({
                    id: good.infoId,
                    title: good.title,
                    metric: good.metricValue
                }))).catch(e => null).finally( () => this.completed = true)
            }

            parse_os_version(good) {
                this.completed = false;
                return fetch('https://app.zhuanzhuan.com/zzopen/waresshow/moreInfo?infoId=' + good.id, {
                    method: 'GET',
                    credentials: 'include'
                }).then(res => res.json()).then(body => ({
                    matched: !!Array.from(body.respData.report.params).find(param => param.key === '系统版本' && /.+17.0$/.test(param.value))
                })).catch(e => ({
                    matched: null
                })).finally( () => this.completed = true)
            }

            add_to_favorites(good) {
                console.warn('收藏商品: https://m.zhuanzhuan.com/u/streamline_detail/new-goods-detail?infoId=' + good.id);

                this.completed = false;
                return fetch('https://app.zhuanzhuan.com/zz/transfer/addLoveInfo?infoId=' + good.id + '&metric=' + good.metric, {
                    method: 'GET',
                    credentials: 'include'
                }).catch(e => null).finally( () => this.completed = true)
            }
        }

        class AHS_Platform extends Platform {
            constructor(entry) {
                entry.body = JSON.parse(entry.body);
                if (entry.body.pageIndex !== 0) {
                    throw "must be initialized with the first page (pageIndex = 0)"
                }

                entry.body.pageIndex -= 1
                super(entry)
            }

            load_more_goods() {
                this.entry.body.pageIndex += 1;
                this.entry.request_headers["Ahs-Timestamp"] = Math.floor(Date.now() / 1000);

                this.completed = false;
                return fetch(this.entry.url, {
                    method: this.entry.method,
                    headers: this.entry.request_headers,
                    body: JSON.stringify(this.entry.body),
                    credentials: 'include'
                }).then(res => res.json()).then(body => Array.from(body.data).map(good => ({
                    id: good.saleGoodsNo,
                    title: good.name,
                    metric: null
                }))).catch(e => null).finally( () => this.completed = true)
            }

            parse_os_version(good) {
                this.completed = false;
                return fetch('https://dubai.aihuishou.com/ahs-yanxuan-service/products/goods-tag-param?saleGoodsNo=' + good.id, {
                    method: 'GET',
                    credentials: 'include'
                }).then(res => res.json()).then(body => ({
                    matched: !!Array.from(body.data.machineConditionList).find(param => param.name === '系统版本' && /17.0$/.test(param.value))
                })).catch(e => ({
                    matched: null
                })).finally( () => this.completed = true)
            }

            add_to_favorites(good) {
                console.warn('收藏商品: https://m.aihuishou.com/n/ofn/strict-selected/product/detail?saleGoodsNo=' + good.id);

                this.completed = false;
                this.entry.request_headers["Ahs-Timestamp"] = Math.floor(Date.now() / 1000);
                return fetch('https://dubai.aihuishou.com/ahs-yanxuan-service/collect/save', {
                    method: 'POST',
                    headers: this.entry.request_headers,
                    body: JSON.stringify({
                        "type": 1,
                        "itemNo": good.id
                    }),
                    credentials: 'include'
                }).catch(e => null).finally( () => this.completed = true)
            }
        }

        const BackendInterfaces = {
            worker: -1,
            platform: null,
            duplicates: [],
            good_queues: [],

            start(caches) {
                if (this.worker != -1) {
                    return;
                }

                if (Array.isArray(caches) && caches.length > 0) {
                    this.duplicates = caches;
                }

                this.worker = setInterval( () => {
                    if (!this.platform?.is_completed()) {
                        return;
                    }

                    while (this.good_queues.length) {
                        const good = this.good_queues.shift();
                        if (!this.duplicates.includes(good.id)) {
                            return this.platform.parse_os_version(good).then( ({matched}) => {
                                if (matched == null) {
                                    return;
                                }
                                this.duplicates.push(good.id);
                                if (matched) {
                                    this.platform.add_to_favorites(good);
                                }
                            }
                            );
                        }
                    }

                    this.platform.load_more_goods().then(goods => {
                        if (!goods) {
                            return;
                        }

                        if (goods.length) {
                            this.good_queues.push(...goods);
                        } else {
                            this.platform = null;
                            self.postMessage({
                                method: 'save',
                                args: [this.duplicates]
                            });

                            console.debug(new Date().toLocaleString(), 'spider idle ...');
                        }
                    }
                    );
                }
                , 1000);

                console.clear();
                console.debug(new Date().toLocaleString(), 'spider start ...');
            },

            stop() {
                if (this.worker == -1) {
                    return;
                }

                clearInterval(this.worker);
                this.worker = -1;
                self.postMessage({
                    method: 'save',
                    args: [this.duplicates]
                });

                console.debug(new Date().toLocaleString(), 'spider stop ...');
            },

            sync(platform, entry) {
                try {
                    switch (platform) {
                    case "zhuanzhuan":
                        this.platform = new ZZ_Platform(entry)
                        break
                    case "aihuishou":
                        this.platform = new AHS_Platform(entry)
                        break
                    default:
                        throw "unsupported platform: " + name
                    }

                    console.debug(new Date().toLocaleString(), 'spider sync ...')
                } catch {}
            }
        }

        self.onmessage = (e) => {
            BackendInterfaces[e.data.method].apply(BackendInterfaces, 'args'in e.data ? e.data.args : []);
        }
    `], {type: 'application/javascript'})));

    const FrontInterfaces = {
        injected: false,

        load: () => {
            return JSON.parse(localStorage.getItem('goods')) || [];
        },

        save: (caches) => {
            if (Array.isArray(caches) && caches.length > 0) {
                localStorage.setItem('goods', JSON.stringify(caches));

                console.debug(new Date().toLocaleString(), 'spider save ...');
            }
        },

        inject() {
            if (!this.injected) {
                this.injected = true;

                const button = document.createElement("button");
                button.type = "button";
                button.value = "start";
                button.textContent = "开始";
                button.style.cssText = "position: fixed;top: 58px;right: 2%;z-index: 100;font: caption;font-weight: bold;background-color: blanchedalmond;";
                button.addEventListener("click", (event) => {
                    if (event.target.value == "stop") {
                        event.target.value = "start";
                        event.target.textContent = "开始";
                        window.backend.postMessage({method: 'stop'});
                    } else {
                        event.target.value = "stop";
                        event.target.textContent = "停止";
                        window.backend.postMessage({method: 'start', args: [this.load()]});
                    }
                });

                document.body.appendChild(button);
            }
        }
    }

    window.backend.onmessage = (e) => {
        FrontInterfaces[e.data.method].apply(FrontInterfaces, 'args' in e.data ? e.data.args : []);
    }

    XMLHttpRequest.prototype._send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(content) {
        try {
            let platform;
            if (this.__sentry_xhr_v3__.url.includes('/zzopen/ypmall/listData')) {
                platform='zhuanzhuan'
            } else if (this.__sentry_xhr_v3__.url.includes('ahs-yanxuan-service/products/search-goods-v2')) {
                platform='aihuishou'     
                this.__sentry_xhr_v3__.request_headers = this.__send_headers;
            } else {
                return
            }

            FrontInterfaces.inject();
            this.__sentry_xhr_v3__.body = content;
            window.backend.postMessage({method: 'sync', args: [platform, this.__sentry_xhr_v3__]});
        } finally {
            return this._send(content);
        }
    }
})();
