// ==UserScript==
// @name         启用视频全屏
// @namespace    https://github.com/RichieMay/WebTools/raw/master/FullScreen.user.js
// @version      1.1
// @description  启用视频全屏
// @author       RichieMay
// @match        http*://*.pupudy.com/*
// @match        http*://*.tt27.tv/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var iframe = document.getElementsByTagName('iframe');
    for (var i = 0; i < iframe.length; i++) {
        iframe[i].setAttribute('allowFullScreen', 'true');
    }
})();
