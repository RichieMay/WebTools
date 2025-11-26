// ==UserScript==
// @name         俄罗斯去广告
// @namespace    https://github.com/RichieMay/WebTools/raw/master/RemoveAd.user.js
// @version      1.4
// @description  俄罗斯去广告
// @author       RichieMay
// @include      http*://*.pornhub.*/*
// @grant        none
// @run-at       document-body
// ==/UserScript==

(function() {
    'use strict';

    function removeNodesById(ids) {
        ids.forEach(function(id) {
            let item = document.getElementById(id);
            if (null !== item) {
                item.parentNode.removeChild(item);
            }
        });
    }

    removeNodesById(['ageVerificationOverlay', 'age-verification-container', 'age-verification-wrapper']);
})();
