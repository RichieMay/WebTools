// ==UserScript==
// @name         ExtendCozeChat
// @namespace    https://github.com/RichieMay/WebTools/raw/master/ExtendCoze.user.js
// @version      1.0.2
// @description  扩展Coze聊天页
// @author       RichieMay
// @match        http*://*.coze.com/*
// @icon         data:image/png;base64,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
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
              let containers = mutation.addedNodes[i].getElementsByClassName('sidesheet-container')
              if (containers.length > 0) {
                  if (containers[0].getAttribute('extend') == null) {
                      containers[0].setAttribute('extend', true)
                      containers[0].setAttribute('style', 'grid-template-columns:25fr 70fr 5fr;')

                      containers[0].children[0].style.position = 'fixed'
                      containers[0].children[0].style.visibility = 'hidden'
                  }
              }
          }
      });
    }).observe(document.getElementById('root'), {childList : true, subtree: true});
})();