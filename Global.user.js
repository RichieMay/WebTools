// ==UserScript==
// @name         全局工具集
// @namespace    https://github.com/RichieMay/WebTools/raw/master/Global.user.js
// @version      1.1
// @description  全局工具集，包含视频全屏、禁止浏览器自动添加搜索引擎
// @author       RichieMay
// @grant        none
// @include      *
// ==/UserScript==

(function() {
    'use strict';

    function EnableFullScreen() {
        [].forEach.call(document.getElementsByTagName('iframe'), function(iframe){
            iframe.setAttribute('allowFullScreen', 'true');
        });
    }

    function DisableAddSearchEngines() {
        [].forEach.call(document.querySelectorAll('[type="application/opensearchdescription+xml"]'), function(openSearch) {
            openSearch.remove();
        });
    }

    EnableFullScreen();

    DisableAddSearchEngines();

})();