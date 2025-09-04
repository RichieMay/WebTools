// ==UserScript==
// @name         转转商品爬虫
// @namespace    https://github.com/RichieMay/WebTools/raw/master/ZZSpider.user.js
// @version      1.0.7
// @description  转转商品爬虫
// @author       RichieMay
// @match        https://m.zhuanzhuan.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const methods = {refresh: () => { console.debug(new Date().toLocaleString(), 'spider refresh ...'); window.scrollTo(0, document.body.scrollHeight); }};
    const worker = new Worker(URL.createObjectURL(new Blob([`
            function add_to_favorites(good) {
                fetch('https://app.zhuanzhuan.com/zz/transfer/addLoveInfo?infoId=' + good.id + '&metric=' + good.metric, {method: 'GET',credentials: 'include'});
            }

            async function parse_os_version(unique, good) {
                if (unique.includes(good.id)) {
                    console.error('重复商品ID: ' + good.id + ', 标题: ' + good.title);
                    return;
                }

                unique.push(good.id);
                const response = await fetch('https://app.zhuanzhuan.com/zzopen/waresshow/moreInfo?infoId=' + good.id, {method: 'GET',credentials: 'include'});
                const result = await response.json();
                for (const param of result.respData.report.params) {
                    if (param.key === '系统版本') {
                        if (/.+17\.0$/.test(param.value)) {
                            console.warn('商品链接: https://m.zhuanzhuan.com/u/streamline_detail/new-goods-detail?infoId=' + good.id);
                            add_to_favorites(good.id, good.metric);
                            break;
                        }
                    }
                }
            }

            const global = {queue:[],  unique:[], refresh: true};
            const methods = {
                start: () => {
                    console.debug(new Date().toLocaleString(), 'spider start ...');

                    setInterval(() => {
                        if (global.queue.length != 0) {
                            try {
                                global.refresh = false;
                                parse_os_version(global.unique, global.queue.shift());
                            } catch {}
                        } else if (!global.refresh) {
                            global.refresh = true;
                            self.postMessage({method: 'refresh', args: []});
                        }
                    }, 1000);
                },

                update: (goods) => {
                    console.debug(new Date().toLocaleString(), 'spider update ...', global.queue.length, goods.length);

                    global.queue.push(...goods);
                }
            };

            self.onmessage = (e) => {
                methods[e.data.method].apply(methods, e.data.args);
            };

        `], {type: 'application/javascript'})));

    worker.onmessage = (e) => {
        methods[e.data.method].apply(methods, e.data.args);
    };

    function setup_goods_node(node)
    {
        new MutationObserver(function(mutations) {
            worker.postMessage({
                method: 'update',
                args: [
                    Array.from(mutations)
                    .flatMap(mutation => Array.from(mutation.addedNodes))
                    .filter(node => node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('zz-infoid'))
                    .map(node => ({
                        id: node.getAttribute('zz-infoid'),
                        title: node.getAttribute('zz-sortname'),
                        metric: node.getAttribute('data-metric')
                    }))
                ]
            });
        }).observe(node, {childList : true});

        console.clear();
        worker.postMessage({method: 'start', args: []});
    }

    new MutationObserver(function(mutations, observer) {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                try {
                    setup_goods_node(node.querySelector('div[zz-sectionid="111"]'));
                    observer.disconnect();
                    return;
                } catch {}
            }
        }
    }).observe(document.getElementById('app'), {childList : true});
})();
