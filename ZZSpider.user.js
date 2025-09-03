// ==UserScript==
// @name         转转商品爬虫
// @namespace    https://github.com/RichieMay/WebTools/raw/master/ZZSpider.user.js
// @version      1.0.0
// @description  转转商品爬虫
// @author       RichieMay
// @match        https://m.zhuanzhuan.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const global = {'queue': [], 'unique': [], 'pull': true};
    const worker = new Worker(URL.createObjectURL(new Blob([`self.onmessage=(e)=>{setInterval(()=>{self.postMessage(null)},1000)}`],{type: 'application/javascript'})));
    worker.onmessage = (e) => {
        if (global.queue.length != 0) {
            try {
                global.pull = false;
                parse_os_version(global.unique, global.queue.shift());
            } catch{}
        } else {
            if (!global.pull) {
                global.pull = true;
                window.scrollTo(0, document.body.scrollHeight);
            }
        }
    };

    function add_to_favorites(id, metric) {
        fetch('https://app.zhuanzhuan.com/zz/transfer/addLoveInfo?infoId=' + id + '&metric=' + metric, {method: 'GET',credentials: 'include'});
    }

    async function parse_os_version(unique, good) {
        const id = good.getAttribute('zz-infoid')
        if (id == null || unique.includes(id)) {
            if (id != null) {
                console.error('重复商品ID: ' + id + ', 标题: ' + good.getAttribute('zz-sortname'));
            }
            return;
        }

        unique.push(id)
        const response = await fetch('https://app.zhuanzhuan.com/zzopen/waresshow/moreInfo?infoId=' + id, {method: 'GET',credentials: 'include'});
        const result = await response.json();
        for (const param of result.respData.report.params) {
            if (param.key === '系统版本') {
                if (/.+17\.0$/.test(param.value)) {
                    console.warn('商品链接: https://m.zhuanzhuan.com/u/streamline_detail/new-goods-detail?infoId=' + id);
                    add_to_favorites(id, good.getAttribute('data-metric'));
                    break;
                }
            }
        }
    }

    function setup_goods_node(node)
    {
        new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType == Node.ELEMENT_NODE) {
                        global.queue.push(node);
                    }
                })
            });
        }).observe(node, {childList : true});

        console.clear();
        worker.postMessage(null);
    }

    new MutationObserver(function(mutations, observer) {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                try {
                    setup_goods_node(node.querySelector('div[zz-sectionid="111"]'));
                    observer.disconnect();
                    return;
                } catch{}
            }
        }
    }).observe(document.getElementById('app'), {childList : true});
})();
