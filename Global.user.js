// ==UserScript==
// @name         全局工具集
// @namespace    https://github.com/RichieMay/WebTools/raw/master/Global.user.js
// @version      1.2
// @description  全局工具集，包含视频全屏、禁止浏览器自动添加搜索引擎、it1352.com网站免登录查看问题答案
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

    function ShowAnswer() {
        document.cookie="olduser=1;domain=it1352.com";
    }

    ShowAnswer();

    EnableFullScreen();

    DisableAddSearchEngines();

})();
