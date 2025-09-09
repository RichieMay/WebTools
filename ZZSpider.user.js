// ==UserScript==
// @name         转转商品爬虫
// @namespace    https://github.com/RichieMay/WebTools/raw/master/ZZSpider.user.js
// @version      1.0.17
// @description  转转商品爬虫
// @author       RichieMay
// @match        https://m.zhuanzhuan.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const methods = {
        save: (goods) => {
            localStorage.setItem('goods', JSON.stringify(goods));
            console.debug(new Date().toLocaleString(), 'spider save ...');
        },

        load: () => {
            return JSON.parse(localStorage.getItem('goods')) || [];
        }
    };

    window.backend = new Worker(URL.createObjectURL(new Blob([`
            function add_to_favorites(good) {
                fetch('https://app.zhuanzhuan.com/zz/transfer/addLoveInfo?infoId=' + good.id + '&metric=' + good.metric, {method: 'GET', credentials: 'include'});
            }

            function parse_os_version(good) {
                return fetch('https://app.zhuanzhuan.com/zzopen/waresshow/moreInfo?infoId=' + good.id, {method: 'GET', credentials: 'include'})
                    .then(res => res.json())
                    .then(body => {
                            if (!Array.from(body.respData.report.params).find(param => param.key === '系统版本' && /.+17\.0$/.test(param.value))) {
                                return null;
                            }

                            console.warn('商品链接: https://m.zhuanzhuan.com/u/streamline_detail/new-goods-detail?infoId=' + good.id);
                            add_to_favorites(good);
                            return good;
                    }).catch(e => null);
            }

            function load_more_goods(entry) {
                entry.body.param.pageIndex += 1;
                entry.body.param.rstmark = Date.now();
                entry.request_headers.zzreqt = Date.now();
                const formData = new URLSearchParams({param: JSON.stringify(entry.body.param)});
                return fetch(entry.url, {method: entry.method, headers: entry.request_headers, body: formData, credentials: 'include'})
                    .then(res => res.json())
                    .then(body => {
                        return Array.from(body.respData.datas).map(good => {
                            return {id: good.infoId, title: good.title, metric: good.metricValue};
                        });
                    }).catch(e => null);
            }

            const global = {queue: [], unique: [], entry: null, timer: -1, complete: true};
            const methods = {
                start: (caches) => {
                    if (global.timer != -1) { return; }

                    global.unique = caches;
                    global.timer = setInterval(() => {
                        if (!global.complete) { return; }

                        try {
                            global.complete = false;
                            while (global.queue.length != 0) {
                                const good = global.queue.shift();
                                if (!global.unique.includes(good.id)) {
                                    parse_os_version(good).then(good => {global.complete = true;});
                                    global.unique.push(good.id);
                                    return;
                                }

                                console.error('重复商品ID: ' + good.id + ', 标题: ' + good.title);
                            }

                            load_more_goods(global.entry).then(goods => {
                                    global.complete = true;
                                    if (!goods) { return; }

                                    if (goods.length == 0) {
                                        global.entry = null;
                                        self.postMessage({method: 'save', args: [global.unique]});

                                        console.debug(new Date().toLocaleString(), 'spider idle ...');
                                    } else {
                                        global.queue.push(...goods);
                                    }
                                });
                        } catch {
                            global.complete = true;
                        }
                    }, 1000);

                    console.clear();
                    console.debug(new Date().toLocaleString(), 'spider start ...');
                },

                stop: () => {
                    if (global.timer == -1) { return; }
                    clearInterval(global.timer);
                    global.timer = -1;

                    console.debug(new Date().toLocaleString(), 'spider stop ...');
                },

                sync: (entry) => {
                    entry.body = Object.fromEntries(new URLSearchParams(entry.body));
                    entry.body.param = JSON.parse(entry.body.param);
                    if (entry.body.param.pageIndex == 1) {
                        global.queue = [];
                        global.entry = entry;
                        global.entry.body.param.pageIndex = 0;
                        self.postMessage({method: 'save', args: [global.unique]});

                        console.debug(new Date().toLocaleString(), 'spider sync ...');
                    }
                }
            };

            self.onmessage = (e) => {
                methods[e.data.method].apply(methods, 'args' in e.data ? e.data.args : []);
            };
        `], {type: 'application/javascript'})));

    window.backend.onmessage = (e) => {
        methods[e.data.method].apply(methods, 'args' in e.data ? e.data.args : []);
    };

    XMLHttpRequest.prototype._send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...args) {
        if (this.__sentry_xhr_v3__.url.includes('/zzopen/ypmall/listData')) {
            window.backend.postMessage({method: 'sync', args: [this.__sentry_xhr_v3__]});
        }

        return this._send(...args);
    };

    window.backend.postMessage({method: 'start', args: [methods.load()]});
})();
