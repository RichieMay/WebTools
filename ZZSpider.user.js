// ==UserScript==
// @name         转转商品爬虫
// @namespace    https://github.com/RichieMay/WebTools/raw/master/ZZSpider.user.js
// @version      1.0.12
// @description  转转商品爬虫
// @author       RichieMay
// @match        https://m.zhuanzhuan.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    window.backend = new Worker(URL.createObjectURL(new Blob([`
            function add_to_favorites(good) {
                fetch('https://app.zhuanzhuan.com/zz/transfer/addLoveInfo?infoId=' + good.id + '&metric=' + good.metric, {method: 'GET', credentials: 'include'});
            }

            function parse_os_version(unique, good) {
                if (unique.includes(good.id)) {
                    console.error('重复商品ID: ' + good.id + ', 标题: ' + good.title);
                    return;
                }

                unique.push(good.id);
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

            const global = {queue:[], unique:[], entry: {}, timer:-1, complete: true};
            const methods = {
                start: () => {
                    if (global.timer != -1) { return; };
                    console.clear();
                    console.debug(new Date().toLocaleString(), 'spider start ...');

                    global.timer = setInterval(() => {
                        if (global.complete) {
                            try {
                                global.complete = false;
                                if (global.queue.length != 0) {
                                    parse_os_version(global.unique, global.queue.shift()).then(good => {global.complete = true;});
                                } else {
                                    load_more_goods(global.entry).then(goods => {
                                        global.complete = true;
                                        if (!goods) {
                                            return;
                                        }

                                        global.queue.push(...goods);
                                        if (goods.length == 0) {
                                            global.entry = {};
                                        }

                                    });
                                }
                            } catch {
                                global.complete = true;
                            }
                        }
                    }, 1000);
                },

                stop: () => {
                    if (global.timer == -1) { return; }
                    console.debug(new Date().toLocaleString(), 'spider stop ...');

                    clearInterval(global.timer);
                    global.timer = -1;
                },

                sync: (entry) => {
                    console.debug(new Date().toLocaleString(), 'spider sync ...');

                    entry.body = Object.fromEntries(new URLSearchParams(entry.body));
                    entry.body.param = jSON.parse(entry.body.param);
                    if (entry.body.param.pageIndex == 1) {
                        global.queue = [];
                        global.entry = entry;
                        global.entry.body.param.pageIndex = 0;
                    }
                }
            };

            self.onmessage = (e) => {
                methods[e.data.method].apply(methods, 'args' in e.data ? e.data.args : []);
            };
        `], {type: 'application/javascript'})));

    XMLHttpRequest.prototype._send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...args) {
        if (this.__sentry_xhr_v3__.url.includes('/zzopen/ypmall/listData')) {
            window.backend.postMessage({method: 'sync', args: [this.__sentry_xhr_v3__]});
        }

        return this._send(...args);
    };

    window.backend.postMessage({method: 'start'});
})();
