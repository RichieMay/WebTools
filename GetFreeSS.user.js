// ==UserScript==
// @name         获取SS账号
// @namespace    https://github.com/RichieMay/GetFreeSS/raw/master/GetFreeSS.user.js
// @version      1.6
// @description  获取SS账号
// @author       RichieMay
// @match        https://free-ss.site
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    var tableItem = document.getElementsByTagName('table')[1];

    new MutationObserver(function(mutations){
      mutations.forEach(function(mutation) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
              let configs = {shadowsocksConfigs: [], shadowRocketConfigs: []};
              processTbodyNode(mutation.addedNodes[i], configs);
              addSaveLink(configs.shadowRocketConfigs, 'Shadowrocket.txt');
              showHtmlText(configs.shadowsocksConfigs);
              break;
          }
      });
    }).observe(tableItem, {childList : true});

    function processTbodyNode(addedNode, configs) {
      let childNodes = addedNode.childNodes;
      for(let i = 0, length = childNodes.length; i < length; i++) {
          processConfigNode(childNodes[i].childNodes, configs);
      }
    }

    function processConfigNode(configNode, configs) {
      configs.shadowsocksConfigs.push(genShadowsocksConfig(configNode));
      configs.shadowRocketConfigs.push(genShadowRocketConfig(configNode));
    }

    function genGuid() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          let r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
          return v.toString(16).toUpperCase();
      });
    }

    function genShadowsocksConfig(configNode) {
      let select_indexs = new Array(1,2,3,4);
      let config_fill_fields = new Array("server","server_port","method","password");
      let config = {"plugin":"","plugin_opts":"","plugin_args":"","remarks":"","timeout":10};
      for (let i = 0, length = select_indexs.length; i < length; i++) {
          config[config_fill_fields[i]] = configNode[select_indexs[i]].innerText;
      }
      return config;
    }

    function genShadowRocketConfig(configNode) {
      let select_indexs = new Array(1,2,3,4,6);
      let config_fill_fields = new Array("host","port","method","password","flag");
      let config = {"obfsParam":"","weight":0,"allowInsecure":false,"title":"","ota":false,"file":"","updated":0,"obfs":"none","type":"Shadowsocks","user":"","protoParam":"","tls":false,"selected":false,"proto":"none","data":"","ping":-1,"created":0};
      for (let i = 0, length = select_indexs.length; i < length; i++) {
          config[config_fill_fields[i]] = configNode[select_indexs[i]].innerText;
      }
      config.uuid = genGuid();
      return config;
    }

    function showHtmlText(shadowsocksConfig) {
      let tx = document.createElement("textarea");
      tx.rows = 35;
      tx.style.width = "100%";
      tx.innerText = JSON.stringify(shadowsocksConfig);
      tableItem.style.display = "none";
      tableItem.parentNode.appendChild(tx);
    }

    function addSaveLink(shadowRocketConfig, fileName) {
      let data = new Blob([JSON.stringify(shadowRocketConfig)],{type:"application/json;charset=UTF-8"});
      let downloadUrl = window.URL.createObjectURL(data);
      let anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = fileName;
      anchor.innerHTML = "保存为" + fileName;
      anchor.style.color = "red";
      document.getElementsByTagName('h3')[1].appendChild(anchor);
    }
})();
